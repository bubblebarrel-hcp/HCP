import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/auth';
import { formatDate } from '@/lib/format';
import { api, errorMessage } from '@/lib/api';
import type { AppointableMember, LeadershipEntry, OfficerPosition, PositionsResponse } from '@/lib/types';

// Who holds which office (D32). Defining positions, standing roles and
// delegations is kennel.manage desk work and stays on the web, same split as
// trail planning; this screen covers filling and vacating a seat, which any
// officer.appoint holder can do from a phone at a run.

type Tab = 'positions' | 'history';

function EndModal({
  visible,
  onClose,
  onConfirm,
  title,
  actionLabel,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  actionLabel: string;
}) {
  const theme = useTheme();
  const [reason, setReason] = useState('');

  function close() {
    setReason('');
    onClose();
  }

  function confirm() {
    const value = reason.trim();
    setReason('');
    onConfirm(value);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (required)"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[styles.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          />
          <View style={styles.modalRow}>
            <Pressable accessibilityRole="button" onPress={close} style={styles.modalButton}>
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={reason.trim().length < 3}
              onPress={confirm}
              style={[styles.modalButton, { backgroundColor: theme.primary, opacity: reason.trim().length < 3 ? 0.5 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>{actionLabel}</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PickMemberModal({
  visible,
  members,
  onClose,
  onPick,
}: {
  visible: boolean;
  members: AppointableMember[];
  onClose: () => void;
  onPick: (userId: string) => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
          <ThemedText type="subtitle">Appoint</ThemedText>
          <ScrollView style={styles.memberList}>
            {members.map((m) => (
              <Pressable
                key={m.userId}
                accessibilityRole="button"
                onPress={() => onPick(m.userId)}
                style={({ pressed }) => [styles.memberRow, { opacity: pressed ? 0.7 : 1 }]}>
                <Avatar name={m.name} size={32} />
                <ThemedText type="smallBold">{m.name}</ThemedText>
              </Pressable>
            ))}
            {members.length === 0 && (
              <ThemedText themeColor="textSecondary">No active members to choose from.</ThemedText>
            )}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalButton}>
            <ThemedText type="smallBold">Cancel</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function PositionCard({
  position,
  canAppoint,
  members,
  onAppointed,
  busyId,
  setBusyId,
  myUserId,
}: {
  position: OfficerPosition;
  canAppoint: boolean;
  members: AppointableMember[];
  onAppointed: () => void;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
  myUserId: string | null;
}) {
  const theme = useTheme();
  const [picking, setPicking] = useState(false);
  const [ending, setEnding] = useState<{ appointmentId: string; own: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function appoint(userId: string) {
    setPicking(false);
    setBusyId(position.id);
    setError(null);
    try {
      await api(`/positions/${position.id}/appointments`, { method: 'POST', body: { userId } });
      onAppointed();
    } catch (err) {
      setError(errorMessage(err, 'Could not appoint'));
    } finally {
      setBusyId(null);
    }
  }

  async function end(appointmentId: string, own: boolean, reason: string) {
    setEnding(null);
    setBusyId(appointmentId);
    setError(null);
    try {
      await api(`/appointments/${appointmentId}/${own ? 'resigned' : 'revoked'}`, { method: 'POST', body: { reason } });
      onAppointed();
    } catch (err) {
      setError(errorMessage(err, 'That did not work'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <ThemedText type="smallBold">{position.title}</ThemedText>
      {position.description ? <ThemedText themeColor="textSecondary">{position.description}</ThemedText> : null}
      {position.isMismanagement ? (
        <ThemedText type="small" style={{ color: theme.primaryStrong }}>Mismanagement</ThemedText>
      ) : null}

      {position.holders.length === 0 ? (
        <ThemedText themeColor="textSecondary">Vacant</ThemedText>
      ) : (
        position.holders.map((h) => {
          const own = h.userId === myUserId;
          return (
            <View key={h.appointmentId} style={styles.holderRow}>
              <Avatar name={h.name} size={32} />
              <View style={styles.holderText}>
                <ThemedText type="smallBold">{h.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Since {formatDate(h.startDate)}</ThemedText>
              </View>
              {canAppoint || own ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busyId === h.appointmentId}
                  onPress={() => setEnding({ appointmentId: h.appointmentId, own })}
                  style={styles.smallAction}>
                  <ThemedText type="small" style={{ color: theme.danger }}>{own ? 'Resign' : 'Revoke'}</ThemedText>
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}

      {canAppoint && (
        <Pressable
          accessibilityRole="button"
          disabled={busyId === position.id}
          onPress={() => setPicking(true)}
          style={styles.smallAction}>
          {busyId === position.id ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>+ Appoint</ThemedText>
          )}
        </Pressable>
      )}

      {error && <ThemedText type="small" style={{ color: theme.danger }}>{error}</ThemedText>}

      <PickMemberModal visible={picking} members={members} onClose={() => setPicking(false)} onPick={appoint} />
      <EndModal
        visible={Boolean(ending)}
        onClose={() => setEnding(null)}
        onConfirm={(reason) => ending && end(ending.appointmentId, ending.own, reason)}
        title={ending?.own ? 'Resign this position' : 'Revoke this appointment'}
        actionLabel={ending?.own ? 'Resign' : 'Revoke'}
      />
    </View>
  );
}

export default function OfficersScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [tab, setTab] = useState<Tab>('positions');
  const [positions, setPositions] = useState<PositionsResponse | null>(null);
  const [history, setHistory] = useState<LeadershipEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<PositionsResponse>(`/kennels/${slug}/positions`);
      setPositions(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load officers'));
    }
  }, [slug]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api<{ items: LeadershipEntry[] }>(`/kennels/${slug}/leadership`);
      setHistory(data.items);
    } catch {
      setHistory([]);
    }
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'history' && history === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadHistory();
    }
  }, [tab, history, loadHistory]);

  if (error) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!positions) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  const active = positions.items.filter((p) => !p.archived);
  const archived = positions.items.filter((p) => p.archived);

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          {(['positions', 'history'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)}
              style={[styles.segmentItem, tab === t && { backgroundColor: theme.card }]}>
              <ThemedText type="smallBold" themeColor={tab === t ? 'text' : 'textSecondary'}>
                {t === 'positions' ? 'Positions' : 'History'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {tab === 'positions' ? (
            <>
              {active.map((p) => (
                <PositionCard
                  key={p.id}
                  position={p}
                  canAppoint={positions.viewer.canAppoint}
                  members={positions.members}
                  onAppointed={load}
                  busyId={busyId}
                  setBusyId={setBusyId}
                  myUserId={user?.id ?? null}
                />
              ))}
              {active.length === 0 && (
                <ThemedText themeColor="textSecondary" style={styles.center}>No positions defined yet.</ThemedText>
              )}
              {archived.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.archivedNote}>
                  {archived.length} archived position{archived.length === 1 ? '' : 's'} hidden. Manage positions on the web.
                </ThemedText>
              )}
            </>
          ) : history === null ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            history.map((h) => (
              <View key={h.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ThemedText type="smallBold">{h.position.title}</ThemedText>
                <ThemedText themeColor="textSecondary">{h.officer}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(h.startDate)} – {h.endDate ? formatDate(h.endDate) : h.current ? 'present' : '—'}
                </ThemedText>
                {h.endedReason ? <ThemedText type="small" themeColor="textSecondary">{h.endedReason}</ThemedText> : null}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: { padding: Spacing.three, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  segment: { flexDirection: 'row', gap: Spacing.one, padding: Spacing.one, margin: Spacing.three, borderRadius: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  segmentItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Spacing.two },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  holderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  holderText: { flex: 1, minWidth: 0 },
  smallAction: { minHeight: 36, justifyContent: 'center' },
  archivedNote: { textAlign: 'center', padding: Spacing.two },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: Spacing.four, gap: Spacing.three, maxHeight: '80%' },
  modalRow: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },
  modalButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, minHeight: 44, justifyContent: 'center', borderRadius: Spacing.two },
  textarea: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, minHeight: 80, fontSize: 16 },
  memberList: { maxHeight: 300 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 48, paddingVertical: Spacing.one },
});
