import { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BookOpen, Check, History, MessageSquare, Send, Sparkles, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EngagementBar } from '@/components/social/engagement-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatRunDate } from '@/lib/format';
import { EMPTY_ENGAGEMENT } from '@/lib/reactions';
import { nextActions, reportStatusLabel, reportStatusTone, storyCategoryLabel } from '@/lib/reports';
import type { AiDraftSuggestion, ReportComment, ReportRevision, StoryItem, TrailReport } from '@/lib/types';

// Scribe Studio, as the web has it (app/reports/[id]/ReportDetailPage.tsx): one screen
// that is a reader for most people and a writing desk for the Scribe. The rules about who
// may do what are the API's (D29); this only shows what it was told.
const AUTOSAVE_MS = 1200;

function Article({ report }: { report: TrailReport }) {
  const theme = useTheme();
  return (
    <View style={styles.article}>
      {(report.body ?? '').split(/\n{2,}/).map((para, i) => (
        <ThemedText key={i} style={styles.para}>{para}</ThemedText>
      ))}
      {report.citation ? (
        <ThemedText themeColor="textSecondary" testID="report-citation" style={[styles.citation, { borderTopColor: theme.border }]}>
          {report.citation}
        </ThemedText>
      ) : null}
    </View>
  );
}

export default function TrailReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { loading } = useAuth();
  const [report, setReport] = useState<TrailReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [comments, setComments] = useState<ReportComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [revisions, setRevisions] = useState<ReportRevision[]>([]);
  const [story, setStory] = useState<StoryItem[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiDraftSuggestion | null>(null);
  const [aiEditedText, setAiEditedText] = useState('');

  useEffect(() => {
    if (loading) return;
    let alive = true;
    api<{ report: TrailReport }>(`/reports/${id}`)
      .then((data) => {
        if (!alive) return;
        const next = data.report;
        setReport(next);
        setTitle(next.title);
        setBody(next.body ?? '');
        if (next.pendingAiSuggestion) {
          setAiSuggestion(next.pendingAiSuggestion);
          setAiEditedText(next.pendingAiSuggestion.output);
        }
        setError(null);
      })
      .catch((err) => alive && setError(errorMessage(err, 'Trail Report not found')));
    return () => {
      alive = false;
    };
  }, [id, loading]);

  // The editorial extras only exist for the circle; a reader gets 403/404 and simply sees
  // nothing.
  const canReview = report?.viewer.canReview;
  useEffect(() => {
    if (!canReview) return;
    let alive = true;
    api<{ items: ReportComment[] }>(`/reports/${id}/comments`).then((d) => alive && setComments(d.items)).catch(() => undefined);
    api<{ items: ReportRevision[] }>(`/reports/${id}/revisions`).then((d) => alive && setRevisions(d.items)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, canReview]);

  const runId = report?.runId;
  const canEdit = report?.viewer.canEdit;
  useEffect(() => {
    if (!canEdit || !runId) return;
    let alive = true;
    api<{ items: StoryItem[] }>(`/runs/${runId}/story`).then((d) => alive && setStory(d.items)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [runId, canEdit]);

  // FR-EDITOR-008: continuous auto-save. Saving happens on the keystroke's timer, never in
  // an effect, so a render can never trigger a write.
  function queueSave(next: { title?: string; body?: string }) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const data = await api<{ report: TrailReport }>(`/reports/${id}`, { method: 'PATCH', body: next });
        setReport(data.report);
        setSavedAt(new Date().toISOString());
      } catch (err) {
        Alert.alert('Could not save', errorMessage(err, 'Could not save'));
      }
    }, AUTOSAVE_MS);
  }

  // Leaving the screen with a save still pending would lose the last words.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const data = await api<{ report: TrailReport }>(`/reports/${id}/actions/${action}`, { method: 'POST', body: payload });
      setReport(data.report);
      setReason('');
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  async function revise() {
    setBusy(true);
    try {
      const data = await api<{ report: TrailReport }>(`/reports/${id}/revise`, { method: 'POST', body: { body, reason } });
      setReport(data.report);
      setReason('');
      Alert.alert('Correction published');
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    if (!commentDraft.trim()) return;
    try {
      const data = await api<{ comment: ReportComment }>(`/reports/${id}/comments`, { method: 'POST', body: { body: commentDraft } });
      setComments((c) => [...c, data.comment]);
      setCommentDraft('');
    } catch (err) {
      Alert.alert('Could not add the comment', errorMessage(err, 'Could not add the comment'));
    }
  }

  async function resolveComment(commentId: string) {
    try {
      const data = await api<{ items: ReportComment[] }>(`/reports/${id}/comments/${commentId}/resolve`, { method: 'POST', body: {} });
      setComments(data.items);
    } catch (err) {
      Alert.alert('Could not resolve it', errorMessage(err, 'Could not resolve it'));
    }
  }

  async function aiDraft() {
    setAiBusy(true);
    try {
      const data = await api<{ report: TrailReport; suggestion: AiDraftSuggestion }>(`/reports/${id}/ai-draft`, { method: 'POST', body: {} });
      setReport(data.report);
      setAiSuggestion(data.suggestion);
      setAiEditedText(data.suggestion.output);
    } catch (err) {
      // Expected until ANTHROPIC_API_KEY is set (CODEX/PROVIDERS.md): say so rather than
      // fail silently.
      Alert.alert(errorMessage(err, 'AI drafting is not switched on yet'));
    } finally {
      setAiBusy(false);
    }
  }

  // `keepEdited` distinguishes ACCEPTED (the Scribe kept Claude's words as written) from
  // PARTIALLY_ACCEPTED (the Scribe changed them first): both write `text`, only the audit
  // trail differs.
  async function decideAiDraft(text: string | null, keepEdited: boolean) {
    if (!aiSuggestion) return;
    setAiBusy(true);
    try {
      const decision = text === null ? 'REJECTED' : keepEdited ? 'PARTIALLY_ACCEPTED' : 'ACCEPTED';
      const data = await api<{ report: TrailReport }>(`/reports/${id}/ai-draft/${aiSuggestion.id}/decision`, {
        method: 'POST',
        body: { decision, body: text ?? undefined },
      });
      setReport(data.report);
      if (text !== null) setBody(text);
      setAiSuggestion(null);
      Alert.alert(text === null ? 'Draft dismissed' : 'Draft applied');
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
    } finally {
      setAiBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.safe}>
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );

  if (error) {
    return shell(
      <Card style={styles.notFound}>
        <ThemedText testID="report-not-found" style={styles.bold}>{error}</ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.sm, styles.centerText, styles.mt4]}>
          Drafts are private to the Scribe and their reviewers until they are published.
        </ThemedText>
        <Button variant="outline" style={styles.mt16} onPress={() => router.replace('/trail-reports' as never)}>Back to trail reports</Button>
      </Card>,
    );
  }
  if (!report) return shell(<Skeleton height={384} />);

  const editing = report.viewer.canEdit;

  return shell(
    <>
      <Card>
        <View testID="report-page">
          <CardHeader style={styles.headerPad}>
            <View style={styles.wrapRow}>
              <View testID="report-status"><Badge tone={reportStatusTone(report.status)}>{reportStatusLabel[report.status]}</Badge></View>
              <Pressable accessibilityRole="link" onPress={() => router.push(`/run/${report.runId}`)}>
                <ThemedText style={[styles.sm, styles.medium]}>#{report.run.runNumber} · {report.run.kennel.shortName}</ThemedText>
              </Pressable>
              <ThemedText themeColor="textSecondary" style={styles.sm}>{formatRunDate(report.run.startsAt, report.run.timeZone)}</ThemedText>
            </View>
            {editing ? (
              <Input
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  queueSave({ title: text });
                }}
                accessibilityLabel="Report title"
                testID="report-title-input"
                style={styles.titleInput}
              />
            ) : (
              <View testID="report-title"><CardTitle style={styles.reportTitle}>{report.title}</CardTitle></View>
            )}
            <CardDescription>
              Scribe: {report.scribe}
              {report.reviewers.length > 0 ? ` · Reviewers: ${report.reviewers.join(', ')}` : ''}
              {report.publishedAt ? ` · Published ${formatDate(report.publishedAt)}` : ''}
            </CardDescription>
          </CardHeader>

          {/* The run's own flyer, read-only here: editing it belongs on the run page. */}
          {report.run.posterUrl ? (
            <Image
              source={{ uri: report.run.posterUrl }}
              testID="report-poster"
              accessibilityLabel={`Flyer for ${report.run.kennel.shortName} run #${report.run.runNumber}`}
              style={[styles.poster, { backgroundColor: theme.backgroundElement }]}
              resizeMode="contain"
            />
          ) : null}

          <CardContent style={styles.content}>
            {editing ? (
              <>
                <Input
                  value={body}
                  onChangeText={(text) => {
                    setBody(text);
                    queueSave({ body: text });
                  }}
                  multiline
                  placeholder="Three checks, one beer stop, and a hare who swears the flour ran out…"
                  accessibilityLabel="Report body"
                  testID="report-body-input"
                  style={styles.bodyInput}
                />
                <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite" style={styles.sm}>
                  {savedAt ? `Saved ${formatDate(savedAt)}` : 'Saves as you write.'}
                </ThemedText>
              </>
            ) : (
              <Article report={report} />
            )}

            <View style={styles.wrapRow}>
              {report.viewer.canEdit &&
                nextActions(report.status).map((a) => (
                  <Button
                    key={a.action}
                    variant={a.primary ? 'default' : 'outline'}
                    disabled={busy || (a.action === 'publish' && !report.viewer.canPublish)}
                    testID={`report-action-${a.action}`}
                    onPress={() => void act(a.action)}>
                    {a.action === 'submit-review' ? <Send size={16} color={theme.text} /> : null}
                    <ThemedText style={[styles.buttonText, { color: a.primary ? theme.onPrimary : theme.text }]}>{a.label}</ThemedText>
                  </Button>
                ))}
              {editing && !aiSuggestion ? (
                <Button variant="outline" disabled={aiBusy} testID="report-ai" onPress={() => void aiDraft()}>
                  <Sparkles size={16} color={theme.text} />
                  <ThemedText style={styles.buttonText}>{aiBusy ? 'Asking Claude…' : 'Draft with AI'}</ThemedText>
                </Button>
              ) : null}
            </View>

            {aiSuggestion ? (
              <View testID="report-ai-suggestion" style={[styles.ai, { borderColor: theme.primary + '4d', backgroundColor: theme.primary + '0d' }]}>
                <View style={styles.aiHead}>
                  <Sparkles size={16} color={theme.primaryStrong} />
                  <ThemedText style={[styles.sm, styles.medium, styles.flex]}>
                    Claude’s draft — grounded only in what this run recorded. Read it before keeping any of it.
                  </ThemedText>
                </View>
                <Input
                  value={aiEditedText}
                  onChangeText={setAiEditedText}
                  multiline
                  accessibilityLabel="AI draft"
                  testID="report-ai-output"
                  style={styles.aiInput}
                />
                <View style={styles.wrapRow}>
                  <Button disabled={aiBusy} testID="report-ai-accept" onPress={() => void decideAiDraft(aiEditedText, aiEditedText !== aiSuggestion.output)}>
                    <Check size={16} color={theme.onPrimary} />
                    <ThemedText style={[styles.buttonText, { color: theme.onPrimary }]}>Use this draft</ThemedText>
                  </Button>
                  <Button variant="outline" disabled={aiBusy} testID="report-ai-reject" onPress={() => void decideAiDraft(null, false)}>
                    <X size={16} color={theme.text} />
                    <ThemedText style={styles.buttonText}>Discard</ThemedText>
                  </Button>
                </View>
              </View>
            ) : null}

            {report.viewer.canRevise ? (
              <View style={[styles.section, { borderTopColor: theme.border }]}>
                <ThemedText style={[styles.sm, styles.medium]}>Correcting a published report creates a revision.</ThemedText>
                <Input
                  value={body}
                  onChangeText={setBody}
                  multiline
                  accessibilityLabel="Corrected text"
                  testID="report-revise-body"
                  style={styles.reviseInput}
                />
                <Field label="Why this correction">
                  <Input testID="report-revise-reason" value={reason} onChangeText={setReason} placeholder="Counted the checks again" />
                </Field>
                <Button style={styles.start} disabled={busy || reason.trim().length < 3} onPress={() => void revise()}>
                  Publish the correction
                </Button>
              </View>
            ) : null}

            {report.status === 'PUBLISHED' && report.viewer.canGovern ? (
              <View style={[styles.section, { borderTopColor: theme.border }]}>
                <Field label="Archive this report">
                  <Input testID="report-archive-reason" value={reason} onChangeText={setReason} placeholder="Replaced by the anniversary edition" />
                </Field>
                <Button
                  variant="outline"
                  style={styles.start}
                  disabled={busy || reason.trim().length < 3}
                  testID="report-action-archive"
                  onPress={() => void act('archive', { reason })}>
                  Archive
                </Button>
              </View>
            ) : null}
          </CardContent>
        </View>
      </Card>

      {/* The conversation after publication (D50). Deliberately separate from the Review
          panel below, which is editorial and happens before it. */}
      {(report.status === 'PUBLISHED' || report.status === 'ARCHIVED') && (
        <Card style={styles.noPad}>
          <View testID="report-engagement">
            <EngagementBar segment="reports" id={report.id} initial={EMPTY_ENGAGEMENT} countViewOnMount authorId={null} />
          </View>
        </Card>
      )}

      {report.viewer.canReview && (
        <Card>
          <View testID="report-comments">
            <CardHeader style={styles.tight}>
              <View style={styles.titleRow}>
                <MessageSquare size={16} color={theme.text} />
                <CardTitle style={styles.h3}>Review</CardTitle>
              </View>
              <CardDescription>Suggestions stay separate until the Scribe takes them.</CardDescription>
            </CardHeader>
            <CardContent style={styles.gap12}>
              {comments.length === 0 && <ThemedText themeColor="textSecondary" style={styles.sm}>Nothing raised yet.</ThemedText>}
              {comments.map((c) => (
                <View key={c.id} style={[styles.comment, { borderColor: theme.border, opacity: c.resolvedAt ? 0.6 : 1 }]}>
                  <ThemedText style={styles.sm}>{c.body}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={[styles.xs, styles.mt4]}>
                    {c.author} · {formatDate(c.createdAt)}
                    {c.resolvedAt ? ' · settled' : ''}
                  </ThemedText>
                  {!c.resolvedAt && (report.viewer.isScribe || report.viewer.canGovern) ? (
                    <Button variant="outline" size="sm" style={[styles.start, styles.mt8]} onPress={() => void resolveComment(c.id)}>
                      <Check size={16} color={theme.text} />
                      <ThemedText style={styles.buttonText}>Settle</ThemedText>
                    </Button>
                  ) : null}
                </View>
              ))}
              <View style={styles.addRow}>
                <View style={styles.flex}>
                  <Input
                    testID="report-comment-input"
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    placeholder="Was it three checks or four?"
                    accessibilityLabel="New comment"
                  />
                </View>
                <Button disabled={!commentDraft.trim()} onPress={() => void addComment()}>Add</Button>
              </View>
            </CardContent>
          </View>
        </Card>
      )}

      {report.viewer.canEdit && (
        <Card>
          <View testID="report-story">
            <CardHeader style={styles.tight}>
              <View style={styles.titleRow}>
                <BookOpen size={16} color={theme.text} />
                <CardTitle style={styles.h3}>What the run collected</CardTitle>
              </View>
              <CardDescription>Gathered as it happened. Yours to shape.</CardDescription>
            </CardHeader>
            <CardContent>
              {story.length === 0 ? (
                <ThemedText themeColor="textSecondary" style={styles.sm}>Nothing collected for this run.</ThemedText>
              ) : (
                <View style={[styles.timeline, { borderLeftColor: theme.border }]}>
                  {story.map((s) => (
                    <View key={s.id}>
                      <ThemedText style={styles.sm}>
                        <ThemedText style={[styles.sm, styles.medium]}>{storyCategoryLabel[s.category]}</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.sm}> · {formatDate(s.occurredAt)}</ThemedText>
                      </ThemedText>
                      <ThemedText style={styles.sm}>{s.body}</ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </CardContent>
          </View>
        </Card>
      )}

      {report.viewer.canReview && revisions.length > 0 && (
        <Card>
          <View testID="report-revisions">
            <CardHeader style={styles.tight}>
              <View style={styles.titleRow}>
                <History size={16} color={theme.text} />
                <CardTitle style={styles.h3}>History</CardTitle>
              </View>
              <CardDescription>Nothing is ever overwritten.</CardDescription>
            </CardHeader>
            <CardContent style={styles.gap12}>
              {revisions.map((v) => (
                <View key={v.id}>
                  <View style={styles.wrapRow}>
                    <ThemedText style={[styles.sm, styles.medium]}>Version {v.version}</ThemedText>
                    {v.isPublication ? <Badge>Published</Badge> : null}
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>{v.author} · {formatDate(v.createdAt)}</ThemedText>
                  {v.reason ? <ThemedText themeColor="textSecondary" style={styles.sm}>“{v.reason}”</ThemedText> : null}
                </View>
              ))}
            </CardContent>
          </View>
        </Card>
      )}
    </>,
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  notFound: { padding: 32, alignItems: 'center' },
  noPad: { overflow: 'hidden' },
  bold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  medium: { fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  centerText: { textAlign: 'center' },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  start: { alignSelf: 'flex-start' },
  headerPad: { paddingBottom: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  reportTitle: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  titleInput: { marginTop: 8, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  poster: { width: '100%', height: 360 },
  content: { gap: 16, paddingTop: 16 },
  article: { gap: 16 },
  para: { fontSize: 16, lineHeight: 26, fontWeight: '400' },
  citation: { borderTopWidth: 1, paddingTop: 16, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodyInput: { minHeight: 432, textAlignVertical: 'top', paddingTop: 10 },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  ai: { borderWidth: 1, borderRadius: 8, padding: 16, gap: 12 },
  aiHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  aiInput: { minHeight: 240, textAlignVertical: 'top', paddingTop: 10 },
  section: { borderTopWidth: 1, paddingTop: 16, gap: 8 },
  reviseInput: { minHeight: 144, textAlignVertical: 'top', paddingTop: 10 },
  tight: { paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h3: { fontSize: 18, lineHeight: 28 },
  gap12: { gap: 12 },
  comment: { borderWidth: 1, borderRadius: 8, padding: 12 },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timeline: { borderLeftWidth: 2, paddingLeft: 16, gap: 12 },
});
