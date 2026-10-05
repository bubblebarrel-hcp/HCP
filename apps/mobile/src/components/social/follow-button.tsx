import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, Clock, Lock, UserPlus } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { followHasher, followKennel, followState } from '@/lib/social';
import type { FollowRelation } from '@/lib/types';

// Follow a hasher or a kennel (D50), as the web button does it
// (components/social/FollowButton.tsx).
//
// Following a kennel is not joining it: the wording says "Follow", never "Join".
// Following a hasher can take a yes (D57): on a locked profile the press sends a
// request and the button says "Requested" until they answer; pressing it then
// withdraws the request. A hasher who has closed to everybody shows no button
// that does anything, only the reason.
export function FollowButton({
  kind,
  target,
  initialFollowers,
  showCount = true,
  size = 'default',
  onCountChange,
  onRelationChange,
}: {
  kind: 'hasher' | 'kennel';
  // A hasher's id, or a kennel's slug.
  target: string;
  initialFollowers?: number;
  showCount?: boolean;
  size?: 'sm' | 'default' | 'lg';
  onCountChange?: (followers: number, following: boolean) => void;
  onRelationChange?: (relation: FollowRelation) => void;
}) {
  const theme = useTheme();
  const { user, loading } = useAuth();
  const [relation, setRelation] = useState<FollowRelation>('NONE');
  const [followers, setFollowers] = useState(initialFollowers ?? 0);
  const [known, setKnown] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  // Held in refs so an inline callback from the parent cannot put the effect in
  // a loop.
  const report = useRef(onCountChange);
  const reportRelation = useRef(onRelationChange);
  useEffect(() => {
    report.current = onCountChange;
    reportRelation.current = onRelationChange;
  });

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    followState(kind === 'hasher' ? 'hashers' : 'kennels', target)
      .then((state) => {
        if (!alive) return;
        const next: FollowRelation = state.relation ?? (state.following ? 'FOLLOWING' : 'NONE');
        setRelation(next);
        setFollowers(state.followers);
        setIsSelf(state.isSelf);
        setOpen(state.followsOpen !== false);
        setKnown(true);
        report.current?.(state.followers, next === 'FOLLOWING');
        reportRelation.current?.(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind, target, user, loading]);

  // Nobody follows themself, so the button is simply not there on your own page.
  if (isSelf) return null;

  const following = relation === 'FOLLOWING';
  const requested = relation === 'REQUESTED';

  function apply(count: number, next: FollowRelation) {
    setFollowers(count);
    setRelation(next);
    onCountChange?.(count, next === 'FOLLOWING');
    reportRelation.current?.(next);
  }

  async function toggle() {
    const wantsOn = !following && !requested;
    const before = followers;
    const was = relation;

    if (kind === 'kennel') {
      // A kennel follow has no approval step, so it can be optimistic.
      apply(Math.max(0, before + (wantsOn ? 1 : -1)), wantsOn ? 'FOLLOWING' : 'NONE');
      setBusy(true);
      try {
        const answer = await followKennel(target, wantsOn);
        apply(answer, wantsOn ? 'FOLLOWING' : 'NONE');
        setKnown(true);
      } catch {
        apply(before, was);
      } finally {
        setBusy(false);
      }
      return;
    }

    // A hasher may ask for a yes first, so what happened is the server's to say.
    setBusy(true);
    try {
      const answer = await followHasher(target, wantsOn);
      apply(answer.counts.followers, answer.relation);
      setKnown(true);
    } catch {
      apply(before, was);
    } finally {
      setBusy(false);
    }
  }

  const signedOut = !user && !loading;

  // A closed profile has nothing to press.
  if (kind === 'hasher' && !open && !following && !requested) {
    return (
      <View style={styles.row}>
        <Button variant="outline" size={size} disabled testID="follow-button">
          <Lock size={16} color={theme.text} />
          <ThemedText style={styles.label}>Not taking followers</ThemedText>
        </Button>
      </View>
    );
  }

  const ink = following || requested ? theme.text : theme.onPrimary;
  return (
    <View style={styles.row}>
      <Button
        size={size}
        variant={following || requested ? 'outline' : 'default'}
        disabled={busy || signedOut || (Boolean(user) && !known)}
        testID="follow-button"
        accessibilityLabel={requested ? 'Requested. Press to withdraw your request.' : undefined}
        onPress={() => void toggle()}>
        {following ? <Check size={16} color={ink} /> : requested ? <Clock size={16} color={ink} /> : <UserPlus size={16} color={ink} />}
        <ThemedText style={[styles.label, { color: ink }]}>{following ? 'Following' : requested ? 'Requested' : 'Follow'}</ThemedText>
      </Button>
      {showCount && followers > 0 && (
        <ThemedText themeColor="textSecondary" style={styles.count} testID="follower-count">
          {followers} {followers === 1 ? 'follower' : 'followers'}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  count: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
