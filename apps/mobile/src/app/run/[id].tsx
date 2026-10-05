import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  Archive,
  ArrowRight,
  Award,
  Ban,
  Banknote,
  BookOpen,
  CalendarDays,
  Check,
  Footprints,
  Megaphone,
  MapPin,
  Music,
  Pause,
  PenLine,
  Play,
  StickyNote,
  UserPlus,
  Users,
  Beer,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { AwardDialog, CircleEditDialog } from '@/components/runs/circle-dialogs';
import { GuestDialog } from '@/components/runs/guest-dialog';
import { RunMedia } from '@/components/runs/run-media';
import { RunPoster } from '@/components/runs/run-poster';
import { RunPosts } from '@/components/runs/run-posts';
import { TrailsPanel } from '@/components/trails/trails-panel';
import { EngagementBar } from '@/components/social/engagement-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { brandColor, formatDate, formatRunDate, reportStatusLabel } from '@/lib/format';
import { EMPTY_ENGAGEMENT } from '@/lib/reactions';
import {
  formatClock,
  runHeading,
  runStatusLabel,
  runTimelineLabel,
  runTypeLabel,
  runVisibilityLabel,
  rsvpLabel,
} from '@/lib/runs';
import type {
  CapsuleStatus,
  HareOffer,
  HareOffers,
  RsvpStatus,
  RunCapsule,
  RunDetail,
  RunStatus,
  TrailReport,
} from '@/lib/types';

// A run, as the web app lays it out on a phone (app/runs/[id]/RunDetailPage.tsx
// and components/runs/*): the header card with its progress stepper, then the
// RSVP panel, the flyer, haring offers, who is coming, the run's posts, the
// Circle, the trail report, the capsule and the timeline. Trail maps and photo
// uploads are desk work and stay on the web.

const LIFECYCLE: RunStatus[] = [
  'DRAFT',
  'SCHEDULED',
  'PLANNING',
  'TRAIL_HIDDEN',
  'TRAIL_RELEASED',
  'CHECK_IN_OPEN',
  'LIVE',
  'CIRCLE',
  'REPORTING',
  'ARCHIVED',
];

const capsuleStatusLabel: Record<CapsuleStatus, string> = {
  PLANNED: 'Planned',
  PREPARING: 'Preparing',
  LIVE: 'Live',
  DRAFT: 'Gathering',
  PENDING_PUBLICATION: 'Ready to publish',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
  LEGACY: 'Legacy',
};

const stepHelp: Record<string, string> = {
  schedule: 'Members see the run and can RSVP.',
  'start-planning': 'The hares start preparing the trail.',
  'hide-trail': 'Planning is locked. The trail stays secret until it is released.',
  'release-trail': 'The trail is released to the pack.',
  'open-check-in': 'Hashers can check in.',
  start: 'The run goes live.',
  end: 'The run ends and the Circle begins.',
  'close-circle': 'The Circle record is kept and the run moves to reporting.',
  archive: 'Attendance is locked for good and the run becomes part of its Run Capsule.',
};

const rsvpOrder: Record<RsvpStatus, number> = { GOING: 0, MAYBE: 1, NOT_GOING: 2, CANCELLED: 3 };

type Send = (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: object) => Promise<void>;

function statusTone(status: RunStatus) {
  if (status === 'LIVE' || status === 'CHECK_IN_OPEN' || status === 'CIRCLE') return 'soft-primary' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  if (status === 'DRAFT') return 'soft-accent' as const;
  if (status === 'ARCHIVED' || status === 'REPORTING') return 'muted' as const;
  return 'plain' as const;
}

function Stepper({ status }: { status: RunStatus }) {
  const theme = useTheme();
  const current = LIFECYCLE.indexOf(status);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Run progress"
      testID="run-stepper"
      style={[styles.stepper, { borderTopColor: theme.border }]}
      contentContainerStyle={styles.stepperRow}>
      {LIFECYCLE.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const ink = active ? theme.onPrimary : done ? theme.primaryStrong : theme.textSecondary;
        return (
          <View key={step} style={[styles.step, active && { backgroundColor: theme.primary }]}>
            {done && <Check size={14} color={ink} />}
            <ThemedText style={[styles.stepText, { color: ink }]}>{runStatusLabel[step]}</ThemedText>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Notice({ tone, icon: Icon, lead, text, testID }: { tone: 'danger' | 'accent'; icon: typeof Ban; lead: string; text?: string | null; testID: string }) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : theme.accentStrong;
  const base = tone === 'danger' ? theme.danger : theme.accent;
  return (
    <View
      accessibilityRole="alert"
      testID={testID}
      style={[styles.notice, { borderColor: base + '4d', backgroundColor: base + '1a' }]}>
      <Icon size={20} color={color} />
      <ThemedText style={[styles.noticeText, { color }]}>
        <ThemedText style={[styles.noticeText, styles.semibold, { color }]}>{lead}</ThemedText> {text}
      </ThemedText>
    </View>
  );
}

function RsvpPanel({ run, send, onRun }: { run: RunDetail; send: Send; onRun: (run: RunDetail) => void }) {
  const theme = useTheme();
  const router = useRouter();
  const v = run.viewer;
  const p = v.participation;
  const responded = p && p.rsvpStatus !== 'CANCELLED';
  const spotsLeft = run.capacity ? Math.max(0, run.capacity - run.counts.going) : null;

  return (
    <Card style={styles.panel} >
      <View testID="rsvp-panel" style={styles.panelGap}>
        <View>
          <ThemedText style={styles.panelTitle}>Are you coming?</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.sm} testID="rsvp-counts">
            {run.counts.going} going · {run.counts.maybe} maybe
            {spotsLeft !== null && ` · ${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}
            {run.counts.checkedIn > 0 && ` · ${run.counts.checkedIn} checked in`}
          </ThemedText>
        </View>

        {!v.signedIn ? (
          <View style={styles.panelGap}>
            {v.canRegisterAsGuest && (
              <GuestDialog
                runId={run.id}
                onDone={onRun}
                trigger={(open) => (
                  <Button onPress={open} testID="register-guest">
                    Register as a guest
                  </Button>
                )}
              />
            )}
            <Button variant={v.canRegisterAsGuest ? 'outline' : 'default'} onPress={() => router.push('/account')}>
              Log in to RSVP
            </Button>
          </View>
        ) : (
          <View style={styles.panelGap}>
            {p?.checkedInAt && (
              <View style={[styles.checkedIn, { backgroundColor: theme.primary + '1a' }]} testID="checked-in">
                <Check size={16} color={theme.primaryStrong} />
                <ThemedText style={[styles.sm, styles.semibold, { color: theme.primaryStrong }]}>
                  Checked in at {formatClock(p.checkedInAt, run.timeZone)}
                </ThemedText>
              </View>
            )}
            {v.canCheckIn && (
              <Button testID="self-check-in" onPress={() => void send('POST', `/runs/${run.id}/check-in`).catch(() => undefined)}>
                Check in
              </Button>
            )}
            {v.canRespond && (
              <>
                <View accessibilityLabel="RSVP" style={styles.rsvpRow}>
                  {(['GOING', 'MAYBE', 'NOT_GOING'] as RsvpStatus[]).map((status) => {
                    const selected = p?.rsvpStatus === status;
                    return (
                      <Button
                        key={status}
                        variant={selected ? 'default' : 'outline'}
                        disabled={status === 'GOING' && Boolean(v.goingBlockedReason)}
                        testID={`rsvp-${status}`}
                        style={styles.rsvpButton}
                        onPress={() => void send('PUT', `/runs/${run.id}/rsvp`, { status }).catch(() => undefined)}>
                        {rsvpLabel[status]}
                      </Button>
                    );
                  })}
                </View>
                {v.goingBlockedReason ? (
                  <ThemedText themeColor="textSecondary" style={styles.xs}>{v.goingBlockedReason}</ThemedText>
                ) : null}
                {responded && (
                  <Button variant="ghost" size="sm" style={styles.start} onPress={() => void send('DELETE', `/runs/${run.id}/rsvp`).catch(() => undefined)}>
                    Withdraw RSVP
                  </Button>
                )}
              </>
            )}
            {!v.canRespond && !v.canCheckIn && !p?.checkedInAt && (
              <ThemedText themeColor="textSecondary" style={styles.sm} testID="rsvp-blocked">
                {v.rsvpBlockedReason}
              </ThemedText>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

const CHECK_IN_ALLOWED: RunStatus[] = ['CHECK_IN_OPEN', 'LIVE', 'CIRCLE', 'REPORTING'];

function OrganiserPanel({ run, send, onRun }: { run: RunDetail; send: Send; onRun: (run: RunDetail) => void }) {
  const theme = useTheme();
  const router = useRouter();
  const v = run.viewer;
  if (!v.canOperate) return null;
  const next = v.nextStep;

  return (
    <Card style={styles.panel}>
      <View testID="organiser-panel" style={styles.panelGap}>
        <View>
          <ThemedText style={styles.panelTitle}>Run the run</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.sm}>
            You are {v.isHare ? 'a hare on this run' : 'a kennel officer with run permissions'}.
          </ThemedText>
        </View>

        {next ? (
          <ActionDialog
            title={`${next.label}?`}
            description={stepHelp[next.action]}
            confirmLabel={next.label}
            onConfirm={() => send('POST', `/runs/${run.id}/actions/${next.action}`, {})}
            trigger={(open) => (
              <Button testID="run-next-step" onPress={open}>
                {next.label}
              </Button>
            )}
          />
        ) : (
          ['DRAFT', 'REPORTING'].includes(run.status) && (
            <ThemedText themeColor="textSecondary" style={styles.sm}>
              A kennel officer with run permissions {run.status === 'DRAFT' ? 'publishes' : 'archives'} this run.
            </ThemedText>
          )
        )}

        <View style={styles.wrapRow}>
          {v.canPause && (
            <ActionDialog
              title="Pause the run?"
              description="Use this for weather, an emergency or a lost hasher. The pause is recorded."
              confirmLabel="Pause run"
              text={{ label: 'Reason', required: true, placeholder: 'Thunderstorm at the second check' }}
              onConfirm={({ text }) => send('POST', `/runs/${run.id}/actions/pause`, { reason: text })}
              trigger={(open) => (
                <Button variant="outline" testID="run-pause" onPress={open}>
                  <Pause size={16} color={theme.text} />
                  <ThemedText style={styles.buttonLabel}>Pause</ThemedText>
                </Button>
              )}
            />
          )}
          {v.canResume && (
            <Button variant="outline" testID="run-resume" onPress={() => void send('POST', `/runs/${run.id}/actions/resume`, {}).catch(() => undefined)}>
              <Play size={16} color={theme.text} />
              <ThemedText style={styles.buttonLabel}>Resume</ThemedText>
            </Button>
          )}
          {v.canEdit && (
            <Button variant="outline" onPress={() => router.push(`/run/${run.id}/edit` as never)}>
              Edit
            </Button>
          )}
          {v.canAddGuest && (
            <GuestDialog
              runId={run.id}
              officer
              allowCheckIn={CHECK_IN_ALLOWED.includes(run.status)}
              onDone={onRun}
              trigger={(open) => (
                <Button variant="outline" testID="add-guest" onPress={open}>
                  <UserPlus size={16} color={theme.text} />
                  <ThemedText style={styles.buttonLabel}>Add guest</ThemedText>
                </Button>
              )}
            />
          )}
          {v.canSkipCircle && (
            <ActionDialog
              title="Skip the Circle?"
              description="The run moves straight to reporting. A reason is required (BR-RUN-005)."
              confirmLabel="Skip the Circle"
              text={{ label: 'Reason', required: true }}
              onConfirm={({ text }) => send('POST', `/runs/${run.id}/actions/skip-circle`, { reason: text })}
              trigger={(open) => (
                <Button variant="ghost" onPress={open}>
                  Skip the Circle
                </Button>
              )}
            />
          )}
          {v.canCancel && (
            <ActionDialog
              title="Cancel this run?"
              description="The run stays visible as cancelled with your reason. RSVPs are kept for the record. This can't be undone."
              confirmLabel="Cancel run"
              destructive
              text={{ label: 'Reason', required: true, placeholder: 'Venue flooded' }}
              onConfirm={({ text }) => send('POST', `/runs/${run.id}/actions/cancel`, { reason: text })}
              trigger={(open) => (
                <Button variant="ghost" testID="run-cancel" onPress={open}>
                  <ThemedText style={[styles.buttonLabel, { color: theme.danger }]}>Cancel run</ThemedText>
                </Button>
              )}
            />
          )}
        </View>
      </View>
    </Card>
  );
}

function HarePanel({ run, onChanged }: { run: RunDetail; onChanged: () => Promise<void> | void }) {
  const theme = useTheme();
  const { user } = useAuth();
  const [offers, setOffers] = useState<HareOffers | null>(null);

  const load = useCallback(async () => {
    try {
      setOffers(await api<HareOffers>(`/runs/${run.id}/hare-offers`));
    } catch {
      // Not everyone may read these; the panel simply does not appear.
      setOffers(null);
    }
  }, [run.id]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [user, load]);

  if (!user || !offers) return null;

  const hasHares = (run.hares ?? []).length > 0;
  const waiting = offers.items.filter((o) => o.status === 'OFFERED');
  const answered = offers.items.filter((o) => o.status !== 'OFFERED');
  const mineWaiting = waiting.find((o) => o.isMine);
  if (hasHares && !offers.canAnswer && !mineWaiting && offers.items.length === 0) return null;

  async function refresh() {
    await load();
    await onChanged();
  }

  const label: Record<HareOffer['status'], string> = {
    OFFERED: 'Waiting on the kennel',
    ACCEPTED: 'Haring it',
    DECLINED: 'Not this time',
    WITHDRAWN: 'Withdrawn',
  };
  const tone = (s: HareOffer['status']) => (s === 'OFFERED' ? ('accent' as const) : s === 'ACCEPTED' ? ('primary' as const) : ('plain' as const));

  return (
    <Card>
      <View testID="hare-panel">
        <CardHeader style={styles.headerTight}>
          <View style={styles.titleRow}>
            <Footprints size={20} color={theme.text} />
            <CardTitle>{hasHares ? 'Haring this run' : 'This run needs a hare'}</CardTitle>
          </View>
          <CardDescription>
            {hasHares
              ? 'The hares are set. Offers stay on the record either way.'
              : 'The kennel has the date. Somebody still has to lay the trail.'}
          </CardDescription>
        </CardHeader>
        <CardContent style={styles.contentGap}>
          {offers.canOffer && (
            <ActionDialog
              title={`Offer to hare run #${run.runNumber}?`}
              description="The mismanagement answers. If they say yes the trail is yours to set, and nobody sees it until you release it."
              confirmLabel="Send the offer"
              text={{ label: 'Anything they should know', placeholder: 'I know a good route from the bar, and I can get the flour' }}
              onConfirm={async ({ text }) => {
                try {
                  await api(`/runs/${run.id}/hare-offers`, { method: 'POST', body: { message: text || null, wantsLead: !hasHares } });
                  await refresh();
                } catch (err) {
                  Alert.alert('Could not send that offer', errorMessage(err));
                  throw err;
                }
              }}
              trigger={(open) => (
                <Button testID="hare-offer" onPress={open}>
                  {hasHares ? 'Offer to co-hare' : 'I’ll hare this one'}
                </Button>
              )}
            />
          )}

          {offers.items.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.sm}>
              {offers.canOffer ? 'Nobody has offered yet. Be the one.' : 'No offers on this run.'}
            </ThemedText>
          ) : (
            <View testID="hare-offers" style={styles.offerList}>
              {[...waiting, ...answered].map((offer, index) => (
                <View key={offer.id} style={[styles.offer, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }]}>
                  <Avatar name={offer.hasher.name} size={36} src={offer.hasher.avatarUrl} />
                  <View style={styles.offerMain}>
                    <View style={styles.offerName}>
                      <ThemedText style={styles.medium}>{offer.isMine ? 'You' : offer.hasher.name}</ThemedText>
                      <Badge tone={tone(offer.status)}>{label[offer.status]}</Badge>
                      {offer.wantsLead && offer.status === 'OFFERED' && (
                        <ThemedText themeColor="textSecondary" style={styles.xs}>wants to lead</ThemedText>
                      )}
                    </View>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>Offered {formatDate(offer.createdAt)}</ThemedText>
                    {offer.message ? (
                      <View style={[styles.quote, { backgroundColor: theme.backgroundElement }]}>
                        <ThemedText style={styles.sm}>“{offer.message}”</ThemedText>
                      </View>
                    ) : null}
                    {offer.reason && offer.status === 'DECLINED' ? (
                      <ThemedText style={styles.sm}>
                        <ThemedText themeColor="textSecondary" style={styles.sm}>Reason:</ThemedText> {offer.reason}
                      </ThemedText>
                    ) : null}
                    {offer.status === 'OFFERED' && offers.canAnswer && !offer.isMine && (
                      <View style={styles.answer}>
                        <ActionDialog
                          title={`${offer.hasher.name} hares run #${run.runNumber}?`}
                          description="They get the trail tools for this run straight away, and are told the trail is theirs."
                          confirmLabel="Yes, they hare it"
                          onConfirm={async () => {
                            try {
                              await api(`/hare-offers/${offer.id}/accept`, { method: 'POST' });
                              await refresh();
                            } catch (err) {
                              Alert.alert('Could not accept that offer', errorMessage(err));
                              throw err;
                            }
                          }}
                          trigger={(open) => (
                            <Button size="sm" testID="hare-accept" onPress={open}>Accept</Button>
                          )}
                        />
                        <ActionDialog
                          title={`Turn down ${offer.hasher.name}?`}
                          description="They are told, with your reason. They can offer on another date."
                          confirmLabel="Turn it down"
                          destructive
                          text={{ label: 'Reason', required: true, placeholder: 'We have someone lined up for this one' }}
                          onConfirm={async ({ text }) => {
                            try {
                              await api(`/hare-offers/${offer.id}/decline`, { method: 'POST', body: { reason: text } });
                              await refresh();
                            } catch (err) {
                              Alert.alert('Could not decline that offer', errorMessage(err));
                              throw err;
                            }
                          }}
                          trigger={(open) => (
                            <Button size="sm" variant="outline" testID="hare-decline" onPress={open}>Not this time</Button>
                          )}
                        />
                      </View>
                    )}
                    {offer.status === 'OFFERED' && offer.isMine && (
                      <ActionDialog
                        title="Withdraw your offer?"
                        description="The kennel sees that you pulled it, so they know to look for someone else."
                        confirmLabel="Withdraw it"
                        destructive
                        text={{ label: 'Reason (optional)', placeholder: 'Something came up that weekend' }}
                        onConfirm={async ({ text }) => {
                          try {
                            await api(`/hare-offers/${offer.id}/withdraw`, { method: 'POST', body: { reason: text || null } });
                            await refresh();
                          } catch (err) {
                            Alert.alert('Could not withdraw that offer', errorMessage(err));
                            throw err;
                          }
                        }}
                        trigger={(open) => (
                          <Button size="sm" variant="ghost" testID="hare-withdraw" style={styles.start} onPress={open}>Withdraw</Button>
                        )}
                      />
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </CardContent>
      </View>
    </Card>
  );
}

function AttendanceCard({ run, send }: { run: RunDetail; send: Send }) {
  const theme = useTheme();
  if (!run.participants) return null;
  const correct = run.viewer.canCorrectAttendance;
  const people = [...run.participants].sort(
    (a, b) => Number(Boolean(b.checkedInAt)) - Number(Boolean(a.checkedInAt)) || rsvpOrder[a.rsvpStatus] - rsvpOrder[b.rsvpStatus],
  );
  return (
    <Card>
      <View testID="attendance-card">
        <CardHeader style={styles.headerTight}>
          <CardTitle>Who&apos;s coming</CardTitle>
          <CardDescription>
            {run.counts.going} going · {run.counts.maybe} maybe · {run.counts.checkedIn} checked in · {run.counts.visitors}{' '}
            {run.counts.visitors === 1 ? 'visitor' : 'visitors'} · {run.counts.guests} {run.counts.guests === 1 ? 'guest' : 'guests'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.sm}>Nobody has RSVP&apos;d yet.</ThemedText>
          ) : (
            people.map((person, index) => (
              <View
                key={person.id}
                testID="participant"
                style={[
                  styles.person,
                  index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                  index === 0 && { paddingTop: 0 },
                  index === people.length - 1 && { paddingBottom: 0 },
                ]}>
                <Avatar name={person.displayName} size={36} />
                <View style={styles.personMain}>
                  <ThemedText style={styles.medium}>{person.displayName}</ThemedText>
                  <View style={styles.badges}>
                    {person.kind === 'guest' && <Badge>Guest</Badge>}
                    {person.isVisitor && person.kind === 'hasher' && (
                      <Badge>{`Visitor${person.homeKennel ? ` · ${person.homeKennel}` : ''}`}</Badge>
                    )}
                    {person.isVirginRun && <Badge tone="soft-accent">Virgin</Badge>}
                  </View>
                  {/* D23: only present at all if the API decided this viewer may contact a guest. */}
                  {person.contact ? (
                    <ThemedText themeColor="textSecondary" style={styles.xs} testID="guest-contact">
                      {person.contact.email}
                      {person.contact.phone ? ` · ${person.contact.phone}` : ''}
                    </ThemedText>
                  ) : null}
                </View>
                {person.checkedInAt ? (
                  <View style={styles.checkedTime}>
                    <Check size={16} color={theme.primaryStrong} />
                    <ThemedText style={[styles.sm, styles.medium, { color: theme.primaryStrong }]}>
                      {formatClock(person.checkedInAt, run.timeZone)}
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText themeColor="textSecondary" style={styles.sm}>{rsvpLabel[person.rsvpStatus]}</ThemedText>
                )}
                {correct &&
                  (person.checkedInAt ? (
                    <ActionDialog
                      title={`Undo ${person.displayName}'s check-in?`}
                      description="The correction is recorded in the audit log."
                      confirmLabel="Undo check-in"
                      destructive
                      text={{ label: 'Reason', marked: true }}
                      onConfirm={({ text }) => send('DELETE', `/runs/${run.id}/participants/${person.id}/check-in`, { reason: text })}
                      trigger={(open) => (
                        <Button variant="ghost" size="sm" testID="participant-undo-check-in" onPress={open}>Undo</Button>
                      )}
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      testID="participant-check-in"
                      onPress={() => void send('POST', `/runs/${run.id}/participants/${person.id}/check-in`).catch(() => undefined)}>
                      Check in
                    </Button>
                  ))}
              </View>
            ))
          )}
        </CardContent>
      </View>
    </Card>
  );
}

function Heading({ icon: Icon, label }: { icon: typeof Music; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHead}>
      <Icon size={16} color={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.sectionHeadText}>{label}</ThemedText>
    </View>
  );
}

function CircleCard({ run, send }: { run: RunDetail; send: Send }) {
  const theme = useTheme();
  const v = run.viewer;
  const c = run.circle;
  if (!v.canSeeNames || (!c && !v.canRecordCircle && !run.circleSkipReason)) return null;

  return (
    <Card>
      <View testID="circle-card">
        <CardHeader style={[styles.headerTight, styles.headerRow]}>
          <CardTitle>Circle</CardTitle>
          {v.canRecordCircle ? (
            <View style={styles.wrapRow}>
              <CircleEditDialog run={run} send={send} />
              <AwardDialog run={run} send={send} />
            </View>
          ) : null}
        </CardHeader>
        <CardContent style={styles.circleBody}>
          {run.circleSkipReason ? (
            <View style={[styles.quote, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.sm}>
                <ThemedText style={[styles.sm, styles.medium]}>Circle skipped:</ThemedText> {run.circleSkipReason}
              </ThemedText>
            </View>
          ) : null}
          <View>
            <Heading icon={Music} label="Songs" />
            {c?.songs.length ? (
              c.songs.map((song, i) => (
                <ThemedText key={`${song}-${i}`} style={styles.body}>•  {song}</ThemedText>
              ))
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.sm}>No songs recorded.</ThemedText>
            )}
          </View>
          {c?.announcements ? (
            <View>
              <Heading icon={Megaphone} label="Announcements" />
              <ThemedText style={styles.body}>{c.announcements}</ThemedText>
            </View>
          ) : null}
          {c?.notes ? (
            <View>
              <Heading icon={StickyNote} label="Notes" />
              <ThemedText style={styles.body}>{c.notes}</ThemedText>
            </View>
          ) : null}
          <View>
            <Heading icon={Award} label="Awards and down-downs" />
            {c?.awards.length ? (
              <View testID="award-list" style={styles.awards}>
                {c.awards.map((award) => (
                  <View key={award.id} style={[styles.award, { borderColor: theme.border }]}>
                    {award.isDownDown ? <Beer size={20} color={theme.accentStrong} /> : <Award size={20} color={theme.primaryStrong} />}
                    <View style={styles.personMain}>
                      <ThemedText style={styles.body}>
                        <ThemedText style={[styles.body, styles.semibold]}>{award.title}</ThemedText>
                        {award.recipient ? ` · ${award.recipient}` : ''}
                      </ThemedText>
                      {award.reason ? <ThemedText themeColor="textSecondary" style={styles.sm}>{award.reason}</ThemedText> : null}
                    </View>
                    {v.canRecordCircle ? (
                      <ActionDialog
                        title={`Remove "${award.title}"?`}
                        description="Corrections before archive are recorded in the audit log."
                        confirmLabel="Remove"
                        destructive
                        onConfirm={() => send('DELETE', `/runs/${run.id}/circle/awards/${award.id}`)}
                        trigger={(open) => (
                          <Button variant="ghost" size="sm" testID="award-remove" onPress={open}>Remove</Button>
                        )}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.sm}>No awards recorded.</ThemedText>
            )}
          </View>
        </CardContent>
      </View>
    </Card>
  );
}

function ReportPanel({ runId }: { runId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const [starting, setStarting] = useState(false);
  const [report, setReport] = useState<TrailReport | null>(null);
  const [canStart, setCanStart] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ report: TrailReport | null; canStart: boolean }>(`/runs/${runId}/report`)
      .then((data) => {
        if (!alive) return;
        setReport(data.report);
        setCanStart(data.canStart);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [runId]);

  async function start() {
    setStarting(true);
    try {
      const data = await api<{ report: TrailReport }>(`/runs/${runId}/report`, { method: 'POST', body: {} });
      router.push(`/trail-reports/${data.report.id}` as never);
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
    } finally {
      setStarting(false);
    }
  }

  if (!loaded) return null;
  if (!report && !canStart) return null;

  return (
    <Card>
      <View testID="report-panel">
        <CardHeader style={styles.headerTight}>
          <CardTitle>Trail Report</CardTitle>
          <CardDescription>
            {report
              ? report.status === 'PUBLISHED' || report.status === 'ARCHIVED'
                ? `Written by ${report.scribe}.`
                : `${report.scribe} is writing it.`
              : 'Nobody has written up this run yet.'}
          </CardDescription>
        </CardHeader>
        <CardContent style={styles.contentGap}>
          {report ? (
            <>
              <View style={styles.wrapRow}>
                <Badge tone={report.status === 'PUBLISHED' ? 'primary' : report.status === 'REVIEW' ? 'accent' : 'plain'}>
                  {reportStatusLabel[report.status]}
                </Badge>
                <ThemedText style={styles.medium}>{report.title}</ThemedText>
              </View>
              {report.viewer.canEdit ? (
                <Button testID="report-open" onPress={() => router.push(`/trail-reports/${report.id}` as never)}>
                  <PenLine size={16} color={theme.onPrimary} />
                  <ThemedText style={[styles.buttonLabel, { color: theme.onPrimary }]}>Open in Scribe Studio</ThemedText>
                </Button>
              ) : (
                <Button variant="outline" testID="report-open" onPress={() => router.push(`/trail-reports/${report.id}` as never)}>
                  <BookOpen size={16} color={theme.text} />
                  <ThemedText style={styles.buttonLabel}>Read the report</ThemedText>
                </Button>
              )}
            </>
          ) : (
            <Button testID="report-start" disabled={starting} onPress={() => void start()}>
              <PenLine size={16} color={theme.onPrimary} />
              <ThemedText style={[styles.buttonLabel, { color: theme.onPrimary }]}>{starting ? 'Starting…' : 'Write the Trail Report'}</ThemedText>
            </Button>
          )}
        </CardContent>
      </View>
    </Card>
  );
}

function CapsulePanel({ runId }: { runId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const [capsule, setCapsule] = useState<RunCapsule | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ capsule: RunCapsule | null }>(`/runs/${runId}/capsule`)
      .then((data) => alive && setCapsule(data.capsule))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [runId]);

  if (!capsule) return null;
  const worthOpening = capsule.timeline.length > 0 || capsule.status === 'PUBLISHED' || capsule.status === 'ARCHIVED';
  const tone =
    capsule.status === 'PUBLISHED' ? ('primary' as const) : capsule.status === 'PENDING_PUBLICATION' ? ('accent' as const) : capsule.status === 'ARCHIVED' || capsule.status === 'LEGACY' ? ('muted' as const) : ('plain' as const);

  return (
    <Card>
      <View testID="capsule-panel">
        <CardHeader style={styles.headerTight}>
          <View style={styles.titleRow}>
            <Archive size={16} color={theme.text} />
            <CardTitle>Run Capsule</CardTitle>
          </View>
          <CardDescription>{capsule.summary ?? 'The archive builds itself while the run happens.'}</CardDescription>
        </CardHeader>
        <CardContent style={styles.contentGap}>
          <View style={styles.wrapRow}>
            <Badge tone={tone}>{capsuleStatusLabel[capsule.status]}</Badge>
            {capsule.viewer.awaitingReport && (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Waiting on the Trail Report.</ThemedText>
            )}
          </View>
          {worthOpening && (
            <Button variant="outline" testID="capsule-open" onPress={() => router.push(`/capsules/${capsule.id}` as never)}>
              <ThemedText style={styles.buttonLabel}>Open the Run Capsule</ThemedText>
              <ArrowRight size={16} color={theme.text} />
            </Button>
          )}
        </CardContent>
      </View>
    </Card>
  );
}

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ run: RunDetail }>(`/runs/${id}`);
      setRun(data.run);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Run not found'));
    }
  }, [id]);

  // Reload when the session changes: what a viewer may see and do depends on who they are.
  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, loading, user]);

  const send: Send = useCallback(async (method, path, body) => {
    try {
      const data = await api<{ run: RunDetail }>(path, { method, body });
      setRun(data.run);
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
      throw err;
    }
  }, []);

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.page}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.primary}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
            />
          }>
          {children}
        </ScrollView>
      </View>
    </ThemedView>
  );

  if (error) {
    return shell(
      <Card style={styles.notFound}>
        <ThemedText style={styles.semibold} testID="run-not-found">{error}</ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.sm, styles.center]}>It may be members-only, or not published yet.</ThemedText>
        <Button variant="outline" style={styles.back} onPress={() => router.replace('/runs')}>
          Back to runs
        </Button>
      </Card>,
    );
  }
  if (!run) return shell(<Skeleton height={384} />);

  const hares = run.hares ?? [];
  const lead = hares.find((h) => h.isLead);
  const coHares = hares.filter((h) => !h.isLead);
  const openPause = run.isPaused ? run.pauses[run.pauses.length - 1] : null;
  const muted = theme.textSecondary;

  return shell(
    <>
      {run.status === 'CANCELLED' && <Notice tone="danger" icon={Ban} lead="This run was cancelled." text={run.cancelReason} testID="run-cancelled" />}
      {openPause && <Notice tone="accent" icon={Pause} lead="The run is paused." text={openPause.reason} testID="run-paused" />}

      <Card style={styles.overflow}>
        <View testID="run-header" style={styles.headerPad}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/kennels/${run.kennel.slug}`)} style={styles.kennelLink}>
            <Avatar name={run.kennel.shortName} size={36} color={brandColor(run.kennel.primaryColor)} />
            <ThemedText style={styles.kennelName}>{run.kennel.name}</ThemedText>
          </Pressable>
          <View style={styles.badgeRow}>
            <Badge tone={statusTone(run.status)}>{runStatusLabel[run.status]}</Badge>
            {run.runType ? <Badge>{runTypeLabel[run.runType]}</Badge> : null}
            {run.visibility ? <Badge>{runVisibilityLabel[run.visibility]}</Badge> : null}
          </View>
          <ThemedText accessibilityRole="header" testID="run-title" style={styles.h1}>
            {runHeading(run)}
          </ThemedText>
          {run.theme ? <ThemedText style={styles.theme}>{run.theme}</ThemedText> : null}
          <View style={styles.facts}>
            <View style={styles.fact}>
              <CalendarDays size={20} color={muted} style={styles.factIcon} />
              <ThemedText style={styles.factText}>
                {formatRunDate(run.startsAt, run.timeZone)}
                <ThemedText themeColor="textSecondary" style={styles.sm}> ({run.timeZone})</ThemedText>
              </ThemedText>
            </View>
            {run.meetingPointName ? (
              <View style={styles.fact}>
                <MapPin size={20} color={muted} style={styles.factIcon} />
                <View style={styles.factBody}>
                  <ThemedText style={styles.factText}>{run.meetingPointName}</ThemedText>
                  {run.meetingAddress ? <ThemedText themeColor="textSecondary" style={styles.sm}>{run.meetingAddress}</ThemedText> : null}
                </View>
              </View>
            ) : null}
            <View style={styles.fact}>
              <Footprints size={20} color={muted} style={styles.factIcon} />
              <ThemedText style={styles.factText} testID="run-hares">
                {hares.length === 0
                  ? 'No hares yet'
                  : `Hare${hares.length > 1 ? 's' : ''}: ${[lead, ...coHares]
                      .filter(Boolean)
                      .map((h) => (h!.isLead && hares.length > 1 ? `${h!.displayName} (lead)` : h!.displayName))
                      .join(', ')}`}
              </ThemedText>
            </View>
            <View style={styles.fact}>
              <Users size={20} color={muted} style={styles.factIcon} />
              <ThemedText style={styles.factText}>
                {run.counts.going} going{run.capacity ? ` of ${run.capacity}` : ''}
                {!run.allowVisitors && ' · members only'}
                {run.allowGuests && ' · guests welcome'}
              </ThemedText>
            </View>
            {run.hashCash ? (
              <View style={styles.fact}>
                <Banknote size={20} color={muted} style={styles.factIcon} />
                <ThemedText style={styles.factText}>Hash cash {run.hashCash}</ThemedText>
              </View>
            ) : null}
          </View>
          {run.description ? <ThemedText style={styles.description}>{run.description}</ThemedText> : null}
        </View>
        {/* Like, comment, reshare, share the link out, save (D50). */}
        <EngagementBar segment="runs" id={run.id} initial={EMPTY_ENGAGEMENT} countViewOnMount showViews={false} />
        {run.status !== 'CANCELLED' && <Stepper status={run.status} />}
      </Card>

      <RsvpPanel run={run} send={send} onRun={setRun} />
      <OrganiserPanel run={run} send={send} onRun={setRun} />

      {/* The flyer, when the kennel has made one (D43). */}
      <RunPoster runId={run.id} posterUrl={run.posterUrl} canManage={run.viewer.canOperate} onChanged={load} />

      <HarePanel run={run} onChanged={load} />
      <TrailsPanel runId={run.id} canPlan={run.viewer.canOperate} />
      <AttendanceCard run={run} send={send} />
      {/* Adding photos needs the hosting kennel or a place on the run; the API is the judge. */}
      <RunMedia target={{ type: 'RUN', id: run.id }} canContribute={Boolean(user) && (run.viewer.canSeeNames || run.viewer.canOperate)} />
      <RunPosts runId={run.id} />
      <CircleCard run={run} send={send} />
      <ReportPanel runId={run.id} />
      <CapsulePanel runId={run.id} />

      {run.timeline && run.timeline.length > 0 && (
        <Card>
          <View testID="run-timeline">
            <CardHeader style={styles.headerTight}>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <View style={[styles.timeline, { borderLeftColor: theme.border }]}>
                {run.timeline.map((entry) => (
                  <View key={entry.id}>
                    <ThemedText style={styles.sm}>
                      <ThemedText style={[styles.sm, styles.medium]}>{runTimelineLabel[entry.type] ?? entry.type}</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.sm}>
                        {' · '}
                        {formatRunDate(entry.occurredAt, run.timeZone)}
                        {entry.actor && ` · ${entry.actor}`}
                      </ThemedText>
                    </ThemedText>
                    {entry.reason ? <ThemedText themeColor="textSecondary" style={styles.sm}>“{entry.reason}”</ThemedText> : null}
                  </View>
                ))}
              </View>
            </CardContent>
          </View>
        </Card>
      )}

      {!run.viewer.canSeeNames && (
        <ThemedText themeColor="textSecondary" style={[styles.sm, styles.footer]}>
          Members of {run.kennel.shortName} see who is going and the Circle record.
        </ThemedText>
      )}
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  overflow: { overflow: 'hidden' },
  notFound: { padding: 32, alignItems: 'center', gap: 4 },
  back: { marginTop: 16 },
  center: { textAlign: 'center' },
  semibold: { fontWeight: '600' },
  medium: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  body: { fontSize: 15, lineHeight: 24, fontWeight: '400' },
  start: { alignSelf: 'flex-start' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderTopWidth: 1, borderBottomWidth: 1 },
  noticeText: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  headerPad: { padding: 20 },
  kennelLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  kennelName: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  badgeRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  h1: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  theme: { marginTop: 4, fontSize: 16, lineHeight: 24, fontStyle: 'italic', fontWeight: '400' },
  facts: { marginTop: 16, gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  factIcon: { marginTop: 2 },
  factBody: { flex: 1 },
  factText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  description: { marginTop: 16, fontSize: 16, lineHeight: 26, fontWeight: '400' },
  stepper: { borderTopWidth: 1 },
  stepperRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 20, paddingVertical: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  stepText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  panel: { padding: 20 },
  panelGap: { gap: 12 },
  panelTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  checkedIn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpButton: { flex: 1, paddingHorizontal: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  buttonLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTight: { paddingBottom: 12 },
  contentGap: { gap: 16 },
  offerList: { gap: 12 },
  offer: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  offerMain: { flex: 1, minWidth: 0, gap: 2 },
  offerName: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  quote: { marginTop: 4, borderRadius: 8, padding: 12 },
  answer: { marginTop: 8, flexDirection: 'row', gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  personMain: { flex: 1, minWidth: 0 },
  badges: { marginTop: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  checkedTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  circleBody: { gap: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionHeadText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  awards: { marginTop: 8, gap: 8 },
  award: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 8, padding: 12 },
  poster: { width: '100%', height: 480 },
  timeline: { borderLeftWidth: 2, paddingLeft: 16, gap: 12 },
  footer: { paddingHorizontal: 16 },
});
