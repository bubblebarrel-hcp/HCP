import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Copy, Link2, Mail, QrCode as QrCodeIcon, UserPlus, type LucideIcon } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

import { QrCode } from '@/components/qr-code';
import { ThemedText } from '@/components/themed-text';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Select } from '@/components/ui/select';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { allTypes } from '@/lib/membership';
import type { CreatedInvitation, InvitationMethod, MembershipInvitation, MembershipType } from '@/lib/types';

// FR-MEMBER-005 / D53, as the web has it (components/membership/InvitationsPanel.tsx).
// Officers issue, share and revoke invitations here. The token/link is only ever in the
// API's response to `create`: this panel shows it once, in `justCreated`, and never again
// after a reload.
const METHOD_ICON: Record<InvitationMethod, LucideIcon> = { EMAIL: Mail, QR_CODE: QrCodeIcon, LINK: Link2 };
const METHOD_LABEL: Record<InvitationMethod, string> = { EMAIL: 'Email', QR_CODE: 'QR code', LINK: 'Link' };
const STATUS_TONE: Record<MembershipInvitation['status'], 'soft-accent' | 'soft-primary' | 'muted'> = {
  pending: 'soft-accent',
  accepted: 'soft-primary',
  revoked: 'muted',
  expired: 'muted',
};

export function InvitationsPanel({ slug }: { slug: string }) {
  const theme = useTheme();
  const [items, setItems] = useState<MembershipInvitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<CreatedInvitation | null>(null);
  const [method, setMethod] = useState<InvitationMethod>('LINK');
  const [inviteEmail, setInviteEmail] = useState('');
  const [membershipType, setMembershipType] = useState<MembershipType>('FULL');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: MembershipInvitation[] }>(`/kennels/${encodeURIComponent(slug)}/invitations`);
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load invitations'));
    }
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function create() {
    setCreating(true);
    try {
      const data = await api<CreatedInvitation>(`/kennels/${encodeURIComponent(slug)}/invitations`, {
        method: 'POST',
        body: { method, email: method === 'EMAIL' ? inviteEmail.trim() : undefined, membershipType },
      });
      setJustCreated(data);
      setInviteEmail('');
      await load();
    } catch (err) {
      Alert.alert('Could not create that invitation', errorMessage(err, 'Could not create that invitation'));
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(link: string) {
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert('Link copied.');
    } catch {
      Alert.alert('Could not copy. Select and copy it manually.');
    }
  }

  return (
    <Card>
      <View testID="invitations-panel">
        <CardHeader style={styles.tight}>
          <View style={styles.titleRow}>
            <UserPlus size={16} color={theme.text} />
            <CardTitle style={styles.title}>Invitations</CardTitle>
          </View>
          <CardDescription>
            The one way to invite someone straight in — including to a hidden kennel, which no other join path can reach.
          </CardDescription>
        </CardHeader>
        <CardContent style={styles.stack}>
          <View style={styles.stack}>
            <Field label="Method">
              <Select
                testID="invite-method"
                value={method}
                onChange={(value) => setMethod(value as InvitationMethod)}
                options={[
                  { value: 'LINK', label: 'Link' },
                  { value: 'EMAIL', label: 'Email' },
                  { value: 'QR_CODE', label: 'QR code' },
                ]}
              />
            </Field>
            {method === 'EMAIL' ? (
              <Field label="Email">
                <Input
                  testID="invite-email"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="hasher@example.com"
                  accessibilityLabel="Email"
                />
              </Field>
            ) : null}
            <Field label="Membership type">
              <Select testID="invite-type" value={membershipType} onChange={(value) => setMembershipType(value as MembershipType)} options={allTypes} />
            </Field>
            <Button testID="create-invitation" disabled={creating || (method === 'EMAIL' && !inviteEmail.trim())} style={styles.start} onPress={() => void create()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </View>

          {justCreated && (
            <View testID="invitation-created" style={[styles.created, { borderColor: theme.primary + '4d', backgroundColor: theme.primary + '0d' }]}>
              <ThemedText style={[styles.sm, styles.medium]}>
                {justCreated.method === 'EMAIL' ? `Sent to ${justCreated.email}.` : 'Share this link. It will not be shown again.'}
              </ThemedText>
              {justCreated.method !== 'EMAIL' && (
                <View style={styles.linkRow}>
                  <View style={[styles.code, { backgroundColor: theme.background }]}>
                    <ThemedText numberOfLines={1} style={styles.codeText}>{justCreated.link}</ThemedText>
                  </View>
                  <Button size="sm" variant="outline" onPress={() => void copyLink(justCreated.link)}>
                    <Copy size={14} color={theme.text} />
                    <ThemedText style={styles.buttonText}>Copy</ThemedText>
                  </Button>
                </View>
              )}
              {justCreated.method === 'QR_CODE' && <View style={styles.mt12}><QrCode value={justCreated.link} size={128} /></View>}
            </View>
          )}

          {error ? (
            <ThemedText themeColor="textSecondary" style={styles.sm}>{error}</ThemedText>
          ) : items === null ? (
            <View style={[styles.skeleton, { backgroundColor: theme.backgroundElement }]} />
          ) : items.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.sm}>No invitations sent yet.</ThemedText>
          ) : (
            <View testID="invitations-list">
              {items.map((inv, i) => {
                const Icon = METHOD_ICON[inv.method];
                return (
                  <View key={inv.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                    <Icon size={16} color={theme.textSecondary} />
                    <View style={styles.flex}>
                      <ThemedText style={[styles.sm, styles.medium]}>
                        {METHOD_LABEL[inv.method]}
                        {inv.email ? ` · ${inv.email}` : ''}
                      </ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.xs}>
                        {inv.status === 'pending' && `Expires ${formatDate(inv.expiresAt)}`}
                        {inv.status === 'accepted' && `Accepted ${formatDate(inv.acceptedAt!)}`}
                        {inv.status === 'revoked' && 'Revoked'}
                        {inv.status === 'expired' && `Expired ${formatDate(inv.expiresAt)}`}
                      </ThemedText>
                    </View>
                    <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                    {inv.status === 'pending' && (
                      <ActionDialog
                        trigger={(open) => (
                          <Button variant="outline" size="sm" testID={`revoke-invitation-${inv.id}`} onPress={open}>Revoke</Button>
                        )}
                        title="Revoke this invitation?"
                        description="The link stops working immediately. It cannot be undone."
                        confirmLabel="Revoke"
                        destructive
                        onConfirm={async () => {
                          try {
                            await api(`/invitations/${inv.id}/revoke`, { method: 'POST' });
                            await load();
                          } catch (err) {
                            Alert.alert('Could not revoke that invitation', errorMessage(err, 'Could not revoke that invitation'));
                            throw err;
                          }
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </CardContent>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, lineHeight: 28 },
  stack: { gap: 16 },
  start: { alignSelf: 'flex-start' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  medium: { fontWeight: '500' },
  mt12: { marginTop: 12 },
  created: { borderWidth: 1, borderRadius: 8, padding: 12 },
  linkRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { flex: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  codeText: { fontSize: 12, lineHeight: 16, fontFamily: 'monospace', fontWeight: '400' },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  skeleton: { height: 64, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, flexWrap: 'wrap' },
});
