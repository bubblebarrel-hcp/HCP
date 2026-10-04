import { StyleSheet, Text, type TextProps } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { tokenize } from '@/lib/entities';

// A hasher's words with their #hashtags and @mentions as taps (D59). A mention
// goes to /u/<username>, which hands over to that hasher's page; it is drawn for
// anything shaped like a username, and the API alone decides who was told.
export function RichText({
  text,
  ...rest
}: { text: string } & Omit<React.ComponentProps<typeof ThemedText>, 'children'> & Pick<TextProps, 'numberOfLines'>) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <ThemedText {...rest}>
      {tokenize(text).map((token, index) => {
        if (token.kind === 'text') return <Text key={index}>{token.text}</Text>;
        return (
          <Text
            key={index}
            accessibilityRole="link"
            onPress={() => router.push(token.kind === 'tag' ? `/tags/${encodeURIComponent(token.tag)}` : `/u/${token.username}`)}
            style={[styles.entity, { color: theme.primaryStrong }]}>
            {token.text}
          </Text>
        );
      })}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  entity: { fontWeight: '600' },
});
