import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Plus } from 'lucide-react-native';

import { ReelComposer } from '@/components/feed/reel-composer';
import { ReelsGrid } from '@/components/feed/reels-grid';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { Page, Reel } from '@/lib/types';

// The reels shot at this run (D41), on its page and in its Run Capsule, as the web's
// components/runs/RunReels.tsx does. A reel lasts 24 hours unless it was pinned to
// its author's profile (D58), so this is the run's fresh footage and not an archive:
// what is gone from here is gone everywhere. The API decides who may see each reel
// and answers an empty list for somebody who may not see the run.
export function RunReels({ runId, kennelId, canPost }: { runId: string; kennelId?: string; canPost?: boolean }) {
  const theme = useTheme();
  const { user, loading } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Page<Reel>>(`/reels?runId=${runId}&limit=12`);
      setReels(data.items);
    } catch {
      setReels([]);
    }
  }, [runId]);

  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void load();
  }, [load, loading, user]);

  const mayPost = Boolean(canPost && user);
  if (reels.length === 0 && !mayPost) return null;

  return (
    <View style={styles.wrap} testID="run-reels">
      <View style={styles.header}>
        <ThemedText accessibilityRole="header" style={styles.heading}>Reels from this run</ThemedText>
        {mayPost && (
          <Button size="sm" variant="outline" testID="run-reel-post" onPress={() => setComposing(true)}>
            <Plus size={16} color={theme.text} />
            <ThemedText type="smallBold">Post a reel</ThemedText>
          </Button>
        )}
      </View>
      {reels.length > 0 ? (
        <ReelsGrid reels={reels} />
      ) : (
        <ThemedText themeColor="textSecondary" style={styles.none}>
          None yet. A reel posted from here stays on this run for a day, like every reel (one pinned to a profile lives there instead).
        </ThemedText>
      )}
      {mayPost && (
        <ReelComposer
          visible={composing}
          onClose={() => setComposing(false)}
          onPosted={() => void load()}
          fixedRunId={runId}
          fixedKennelId={kennelId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  heading: { fontSize: 18, lineHeight: 28, fontWeight: '600' },
  none: { paddingHorizontal: 16, fontSize: 14, lineHeight: 20 },
});
