import { z } from 'zod';

// Mirrors apps/api/src/validators/run.validator.ts. Changing one means changing
// the other. Numbers stay strings in the form and are converted on submit.
export const RUN_TYPES = [
  'REGULAR',
  'FULL_MOON',
  'RED_DRESS',
  'CAMPOUT',
  'CHARITY',
  'INTERHASH',
  'NASH_HASH',
  'THEMED',
  'SPECIAL',
] as const;

export const RUN_VISIBILITIES = ['PUBLIC', 'MEMBERS_ONLY', 'INVITE_ONLY'] as const;

export const runFormSchema = z.object({
  runNumber: z.string().regex(/^[1-9]\d{0,6}$/, 'Run number is a whole number from 1'),
  title: z.string().trim().min(2, 'Give the run a title').max(120, 'Keep the title under 120 characters'),
  runType: z.enum(RUN_TYPES),
  theme: z.string().trim().max(120, 'Keep the theme under 120 characters'),
  description: z.string().trim().max(4000, 'Keep the description under 4000 characters'),
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Choose the date and start time'),
  timeZone: z.string().trim().min(1, 'Time zone is required').max(60),
  meetingPointName: z.string().trim().min(2, 'Where does the pack meet?').max(160),
  meetingAddress: z.string().trim().max(300, 'Keep the address under 300 characters'),
  visibility: z.enum(RUN_VISIBILITIES),
  capacity: z.string().regex(/^(|[1-9]\d{0,3}|10000)$/, 'Leave empty for no limit, or a number from 1 to 10000'),
  hashCash: z.string().trim().max(60, 'Keep hash cash under 60 characters'),
  allowGuests: z.boolean(),
  allowVisitors: z.boolean(),
  leadHareId: z.string(),
  coHareIds: z.array(z.string()).max(9, 'A run has at most 10 hares'),
});

export type RunFormValues = z.infer<typeof runFormSchema>;
