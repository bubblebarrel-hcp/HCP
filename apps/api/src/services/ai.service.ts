import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

// D7/D14: Claude is the platform's only AI provider. This is the one place
// that talks to it — every caller goes through `draftTrailReport`, never the
// SDK directly, so "AI assists, humans decide" (CLAUDE.md) stays true by
// construction: this module returns text, and only a human action
// (report.service#decideAiDraft) ever writes it into a TrailReport.
const MODEL = 'claude-opus-5';
const PROMPT_VERSION = 'trail-report-draft-v1';

let client: Anthropic | null = null;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface DraftContext {
  run: { runNumber: number; title: string; theme: string | null; startsAt: string; timeZone: string; kennelName: string };
  hares: string[];
  attendance: number;
  timeline: { category: string; body: string; occurredAt: string }[];
  circle: {
    songs: string[];
    announcements: string | null;
    awards: { title: string; recipientName: string | null; isDownDown: boolean; reason: string | null }[];
  } | null;
}

const SYSTEM_PROMPT = `You draft Hash House Harriers trail reports for the Hash Community Platform.

Rules:
- Use only the facts given in the JSON context. Never invent a hasher's name, a joke, an injury, weather, or any detail not present in the data.
- Write 2-4 short paragraphs in the informal, self-deprecating voice of a hash newsletter ("On-On", "shiggy", "down-down" are fine hash slang if the data supports them).
- Open with the run number, kennel and date. Mention the hare(s) and attendance if given. Weave in circle awards and songs if present.
- If the timeline is sparse, write a short, honest report rather than padding it with invented color.
- Output only the report body text — no title, no markdown headers, no preamble like "Here is a draft".`;

export async function draftTrailReport(context: DraftContext): Promise<{ output: string; model: string; promptVersion: string }> {
  const anthropic = getClient();

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      // A drafting task grounded entirely in supplied facts, not open-ended
      // reasoning — medium effort balances voice quality against cost.
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(context, null, 2) }],
    });
  } catch (err) {
    // What the provider said (account holds, key problems, request ids) is for
    // whoever runs the platform, so it goes to the log. The scribe who pressed
    // the button gets a plain sentence, not a pasted API response.
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error('Claude is busy right now. Try again shortly.');
    }
    if (err instanceof Anthropic.APIError) {
      logger.error('Claude request failed', { status: err.status, message: err.message, requestId: err.requestID });
      throw new Error("AI drafting isn't available right now. You can write the report yourself, or try again later.");
    }
    throw err;
  }

  const output = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!output) throw new Error('Claude returned an empty draft.');

  return { output, model: MODEL, promptVersion: PROMPT_VERSION };
}
