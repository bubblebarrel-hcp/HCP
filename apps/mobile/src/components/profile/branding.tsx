import { useEffect, useRef, useState } from 'react';
import { Alert, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';
import { Camera, Check, Move, Trash2, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ActionDialog } from '@/components/ui/action-dialog';
import { CoverImage, clamp, formatPosition, parsePosition, type Point } from '@/components/ui/cover-image';
import { Button } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { brandColor } from '@/lib/format';
import { MAX_UPLOAD_BYTES, assetMimeType, fileSize, uploadAssetFull } from '@/lib/media';
import type { MembershipViewer } from '@/lib/types';

// The top of a hasher's or a kennel's page, as the web draws it on a phone
// (components/profile/ProfileBranding.tsx, kennels/KennelBranding.tsx): a banner, the
// 128pt picture overlapping its bottom edge with a 4pt ring in the card colour, and
// the page's own content centred beneath. For its owner (a hasher on their own page,
// a kennel's admin) the controls that change them: add, change or remove the banner,
// drag it into position, and the same for the picture.

type Slot = 'avatar' | 'banner';

export type BrandingEdit =
  | { kind: 'hasher'; id: string }
  | { kind: 'kennel'; id: string; slug: string; shortName: string };

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
type Live = { banner: Point; avatar: Point; bannerWidth: number; bannerHeight: number };

function useDragCrop(live: React.RefObject<Live>, slot: Slot, set: (p: Point) => void) {
  const from = useRef<Point>({ x: 50, y: 50 });
  // The handlers only run on touch, never during render; the compiler can't tell.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        from.current = live.current[slot];
      },
      onPanResponderMove: (_e, g) => {
        const w = slot === 'banner' ? live.current.bannerWidth : 128;
        const h = slot === 'banner' ? live.current.bannerHeight : 128;
        set({ x: clamp(from.current.x - (g.dx / w) * 100), y: clamp(from.current.y - (g.dy / h) * 100) });
      },
    }),
  );
  return responder;
}

const NOUN: Record<Slot, string> = { avatar: 'picture', banner: 'banner' };

export function Branding({
  name,
  color,
  avatarUrl,
  avatarPosition,
  bannerUrl,
  bannerPosition,
  bannerHeight = 160,
  edit,
  onChanged,
  children,
}: {
  name: string;
  color?: string | null;
  avatarUrl?: string | null;
  avatarPosition?: string | null;
  bannerUrl?: string | null;
  bannerPosition?: string | null;
  // Pages differ in how much banner they want: 160 by default, 128 on a hasher's page.
  bannerHeight?: number;
  edit?: BrandingEdit;
  onChanged?: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const { user, refreshUser } = useAuth();
  const { width } = useWindowDimensions();
  const bannerWidth = Math.min(width, MaxContentWidth);

  // Your own page only (hasher) or a kennel you may manage. The API checks it again
  // on every write; this is just whether to offer the controls.
  const [kennelAdmin, setKennelAdmin] = useState(false);
  useEffect(() => {
    if (edit?.kind !== 'kennel' || !user) return;
    let alive = true;
    api<MembershipViewer>(`/kennels/${encodeURIComponent(edit.slug)}/membership`)
      .then((viewer) => alive && setKennelAdmin(viewer.permissions.includes('kennel.manage')))
      .catch(() => alive && setKennelAdmin(false));
    return () => {
      alive = false;
    };
  }, [edit, user]);
  const canManage = Boolean(user) && (edit?.kind === 'hasher' ? user?.id === edit.id : kennelAdmin);

  // What this editor has changed since the page loaded, so a new picture stays on
  // screen straight away. Absent means "whatever the page said".
  const [edited, setEdited] = useState<Partial<Record<Slot, string | null>>>({});
  const [editedBannerPosition, setEditedBannerPosition] = useState<string | null | undefined>(undefined);
  const [editedAvatarPosition, setEditedAvatarPosition] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState<Slot | null>(null);
  const [dragging, setDragging] = useState<Point | null>(null);
  const [avatarDragging, setAvatarDragging] = useState<Point | null>(null);
  const [saving, setSaving] = useState(false);

  const pictures = {
    avatar: edited.avatar !== undefined ? edited.avatar : avatarUrl,
    banner: edited.banner !== undefined ? edited.banner : bannerUrl,
  };
  const savedBanner = parsePosition(editedBannerPosition !== undefined ? editedBannerPosition : bannerPosition);
  const savedAvatar = parsePosition(editedAvatarPosition !== undefined ? editedAvatarPosition : avatarPosition);
  const shownBanner = dragging ?? savedBanner;
  const shownAvatar = avatarDragging ?? savedAvatar;

  // Dragging down should bring the top of the picture into view, which means moving
  // the crop up: the position moves against the finger. A drag across the whole strip
  // covers the whole picture, which keeps the far edges reachable.
  const live = useRef({ banner: shownBanner, avatar: shownAvatar, bannerWidth, bannerHeight });
  useEffect(() => {
    live.current = { banner: shownBanner, avatar: shownAvatar, bannerWidth, bannerHeight };
  });
  const bannerPan = useDragCrop(live, 'banner', setDragging);
  const avatarPan = useDragCrop(live, 'avatar', setAvatarDragging);

  async function patch(body: Record<string, unknown>) {
    if (edit?.kind === 'hasher') {
      await api('/me/profile-images', { method: 'PATCH', body });
      await refreshUser();
    } else if (edit?.kind === 'kennel') {
      await api(`/kennels/${encodeURIComponent(edit.slug)}/settings`, { method: 'PATCH', body });
    }
    onChanged?.();
  }

  async function save(slot: Slot, mediaId: string | null, url: string | null) {
    if (edit?.kind === 'hasher') {
      await patch({ [slot === 'avatar' ? 'avatarMediaId' : 'bannerMediaId']: mediaId });
    } else {
      // A kennel stores the picture's address rather than a media id.
      await patch({ [slot === 'avatar' ? 'logoUrl' : 'bannerUrl']: url, ...(slot === 'banner' ? { bannerPosition: null } : {}) });
    }
    setEdited((current) => ({ ...current, [slot]: url }));
    // A different picture is cropped differently, so a new one starts centred rather
    // than inheriting a position chosen for the one before it.
    if (slot === 'avatar') setEditedAvatarPosition(null);
    if (slot === 'banner') setEditedBannerPosition(null);
  }

  async function choose(slot: Slot) {
    if (!edit) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!ACCEPT.includes(assetMimeType(asset))) {
      Alert.alert('Use a JPEG, PNG, WebP or AVIF picture.');
      return;
    }
    if (asset.fileSize !== undefined && asset.fileSize > MAX_UPLOAD_BYTES) {
      Alert.alert(`That picture is ${fileSize(asset.fileSize)}. Pictures must be ${fileSize(MAX_UPLOAD_BYTES)} or smaller.`);
      return;
    }
    setBusy(slot);
    try {
      const target = edit.kind === 'hasher' ? { type: 'PROFILE' as const, id: edit.id } : { type: 'KENNEL' as const, id: edit.id };
      const caption = edit.kind === 'kennel' ? `${edit.shortName} ${slot === 'avatar' ? 'logo' : slot}` : undefined;
      const media = await uploadAssetFull(asset, target, slot === 'avatar' ? 0 : 1, caption);
      if (!media.url) throw new Error('Storage did not return an address for that picture');
      await save(slot, media.id, media.url);
    } catch (err) {
      Alert.alert(`Could not update your ${NOUN[slot]}`, errorMessage(err, `Could not update your ${NOUN[slot]}`));
    } finally {
      setBusy(null);
    }
  }

  async function savePosition(slot: Slot) {
    const point = slot === 'banner' ? dragging : avatarDragging;
    if (!point) return;
    const value = formatPosition(point);
    setSaving(true);
    try {
      await patch({ [slot === 'banner' ? 'bannerPosition' : 'avatarPosition']: value });
      if (slot === 'banner') {
        setEditedBannerPosition(value);
        setDragging(null);
      } else {
        setEditedAvatarPosition(value);
        setAvatarDragging(null);
      }
    } catch (err) {
      Alert.alert('Could not save the position', errorMessage(err, 'Could not save the position'));
    } finally {
      setSaving(false);
    }
  }

  const removeDialog = (slot: Slot) => (
    <ActionDialog
      title={`Remove your ${NOUN[slot]}?`}
      description="Your page goes back to the default. You can upload another whenever you like."
      confirmLabel={`Remove ${NOUN[slot]}`}
      destructive
      onConfirm={async () => {
        try {
          await save(slot, null, null);
        } catch (err) {
          Alert.alert(`Could not remove your ${NOUN[slot]}`, errorMessage(err, `Could not remove your ${NOUN[slot]}`));
          throw err;
        }
      }}
      trigger={(open) => (
        <Button
          variant="secondary"
          size="sm"
          accessibilityLabel={slot === 'banner' ? 'Remove banner' : 'Remove picture'}
          testID={`profile-${slot}-remove`}
          style={styles.shadow}
          onPress={open}>
          <Trash2 size={16} color={theme.text} />
        </Button>
      )}
    />
  );

  // Covers are imagery; with none, a wash from the colour (HCP Orange by default) to
  // near-black, as the web's coverBackground does.
  const base = brandColor(color) ?? '#f4511e';
  const repositioning = dragging !== null;
  const repositioningAvatar = avatarDragging !== null;

  return (
    <View>
      <View style={[styles.banner, { height: bannerHeight }]} testID="profile-banner">
        {pictures.banner ? (
          <CoverImage uri={pictures.banner} width={bannerWidth} height={bannerHeight} position={shownBanner} />
        ) : (
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={base} />
                <Stop offset="1" stopColor="#6e240e" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#cover)" />
          </Svg>
        )}

        {repositioning && (
          <View
            accessibilityLabel="Drag to choose what the banner shows"
            style={[StyleSheet.absoluteFill, styles.ring, { borderColor: theme.primary }]}
            {...bannerPan.panHandlers}
          />
        )}

        {canManage && (
          /* On a phone the avatar overlaps the bottom of the banner, so the controls
             sit at the top instead, and shrink to their icons. */
          <View style={styles.bannerControls}>
            {repositioning ? (
              <>
                <Button variant="secondary" size="sm" disabled={saving} testID="profile-banner-reposition-cancel" style={styles.shadow} onPress={() => setDragging(null)}>
                  <X size={16} color={theme.text} />
                </Button>
                <Button size="sm" disabled={saving} testID="profile-banner-reposition-save" style={styles.shadow} onPress={() => void savePosition('banner')}>
                  <Check size={16} color={theme.onPrimary} />
                </Button>
              </>
            ) : (
              <>
                {pictures.banner && (
                  <Button
                    variant="secondary"
                    size="sm"
                    accessibilityLabel="Reposition banner"
                    disabled={busy !== null}
                    testID="profile-banner-reposition"
                    style={styles.shadow}
                    onPress={() => setDragging(savedBanner)}>
                    <Move size={16} color={theme.text} />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  accessibilityLabel={pictures.banner ? 'Change banner' : 'Add a banner'}
                  disabled={busy !== null}
                  busy={busy === 'banner'}
                  testID="profile-banner-edit"
                  style={styles.shadow}
                  onPress={() => void choose('banner')}>
                  <Camera size={16} color={theme.text} />
                </Button>
                {pictures.banner && removeDialog('banner')}
              </>
            )}
          </View>
        )}
        {repositioning && (
          <View pointerEvents="none" style={[styles.hint, { backgroundColor: theme.background + 'e6' }]}>
            <ThemedText style={styles.hintText}>Drag the banner to choose what shows.</ThemedText>
          </View>
        )}
      </View>

      <View style={styles.identity}>
        <View style={[styles.ring4, { backgroundColor: theme.card }]}>
          <Avatar
            name={name}
            size={128}
            color={brandColor(color)}
            src={pictures.avatar}
            position={formatPosition(shownAvatar)}
          />
          {canManage && repositioningAvatar && (
            <>
              <View
                accessibilityLabel="Drag to choose what the picture shows"
                testID="profile-avatar-crop"
                style={[styles.avatarCrop, { borderColor: theme.primary }]}
                {...avatarPan.panHandlers}
              />
              <View style={styles.avatarLeft}>
                <Button variant="secondary" size="sm" disabled={saving} testID="profile-avatar-reposition-cancel" style={[styles.round, styles.shadow]} onPress={() => setAvatarDragging(null)}>
                  <X size={16} color={theme.text} />
                </Button>
              </View>
              <View style={styles.avatarRight}>
                <Button size="sm" disabled={saving} testID="profile-avatar-reposition-save" style={[styles.round, styles.shadow]} onPress={() => void savePosition('avatar')}>
                  <Check size={16} color={theme.onPrimary} />
                </Button>
              </View>
            </>
          )}
          {canManage && !repositioningAvatar && (
            <>
              <View style={styles.avatarRight}>
                <Button
                  variant="secondary"
                  size="sm"
                  accessibilityLabel={pictures.avatar ? 'Change picture' : 'Add a picture'}
                  disabled={busy !== null}
                  busy={busy === 'avatar'}
                  testID={edit?.kind === 'kennel' ? 'kennel-logo-edit' : 'profile-avatar-edit'}
                  style={[styles.round, styles.shadow]}
                  onPress={() => void choose('avatar')}>
                  <Camera size={16} color={theme.text} />
                </Button>
              </View>
              {pictures.avatar && <View style={styles.avatarLeft}>{removeDialog('avatar')}</View>}
              {edit?.kind === 'hasher' && pictures.avatar && (
                <View style={styles.avatarTopRight}>
                  <Button
                    variant="secondary"
                    size="sm"
                    accessibilityLabel="Reposition picture"
                    disabled={busy !== null}
                    testID="profile-avatar-reposition"
                    style={[styles.round, styles.shadow]}
                    onPress={() => setAvatarDragging(savedAvatar)}>
                    <Move size={16} color={theme.text} />
                  </Button>
                </View>
              )}
            </>
          )}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { overflow: 'hidden' },
  ring: { borderWidth: 2 },
  shadow: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  bannerControls: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
  hint: { position: 'absolute', left: 12, right: 12, top: 64, alignSelf: 'center', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  hintText: { textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  // flex flex-col items-center gap-3 px-4 pb-4; the picture sits -mt-16.
  identity: { alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  ring4: { marginTop: -68, padding: 4, borderRadius: 68 },
  avatarCrop: { position: 'absolute', top: 4, left: 4, width: 128, height: 128, borderRadius: 64, borderWidth: 2 },
  round: { minHeight: 36, width: 36, borderRadius: 18, paddingHorizontal: 0 },
  avatarRight: { position: 'absolute', right: 4, bottom: 4 },
  avatarLeft: { position: 'absolute', left: 4, bottom: 4 },
  avatarTopRight: { position: 'absolute', right: 4, top: 4 },
});
