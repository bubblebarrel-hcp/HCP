import { useState } from 'react';
import { Text } from 'react-native';

import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// A long post, cut short with a "Read more" (web components/social/ExpandableText.tsx).
// The cut is at a word, so a #tag or @mention is never split, and a tap on
// "Read more" opens the rest in place.

const PREVIEW_CHARS = 280;
const PREVIEW_LINES = 6;

// The cut text, or null when the text is short enough to show whole.
export function previewOf(text: string, maxChars = PREVIEW_CHARS, maxLines = PREVIEW_LINES) {
  const lines = text.split('\n');
  let cut = text;
  if (lines.length > maxLines) cut = lines.slice(0, maxLines).join('\n');
  if (cut.length > maxChars) {
    cut = cut.slice(0, maxChars);
    const lastSpace = cut.search(/\s\S*$/);
    if (lastSpace > maxChars * 0.6) cut = cut.slice(0, lastSpace);
  }
  return cut.length < text.length ? cut.trimEnd() : null;
}

export function ExpandableText({
  text,
  style,
  testID,
}: {
  text: string;
  style?: React.ComponentProps<typeof ThemedText>['style'];
  testID?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const preview = open ? null : previewOf(text);

  if (preview === null) return <RichText text={text} style={style} testID={testID} />;

  return (
    <ThemedText style={style} testID={testID}>
      <RichText text={preview} />
      <Text>{'… '}</Text>
      <Text
        accessibilityRole="button"
        testID="read-more"
        onPress={() => setOpen(true)}
        style={{ color: theme.primaryStrong, fontWeight: '600' }}>
        Read more
      </Text>
    </ThemedText>
  );
}
