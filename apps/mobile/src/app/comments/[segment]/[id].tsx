import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { CommentThread } from '@/components/social/comment-thread';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import type { SubjectSegment } from '@/lib/types';

// A deep link to one piece of content's conversation (a notification points here). It is
// the same inline thread the engagement bar opens, given a screen of its own.
export default function CommentsScreen() {
  const { segment, id } = useLocalSearchParams<{ segment: SubjectSegment; id: string }>();
  return (
    <ThemedView type="canvas" style={styles.flex}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Card>
            <CommentThread segment={segment} id={id} />
          </Card>
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32 },
});
