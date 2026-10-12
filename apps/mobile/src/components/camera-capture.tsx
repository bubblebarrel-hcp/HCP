import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import type { ImagePickerAsset } from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Check, RefreshCw, RotateCcw, X, Zap, ZapOff } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { clockTime } from '@/lib/messages';

// A camera of our own, in place of the phone's camera app (D73). The phone's opens
// as a separate screen we cannot put anything on, and on some handsets it has no
// way back: somebody who changed their mind was stuck. This one has a close button
// at every step, before shooting, while recording and when looking at the result.
//
// Hands back what the picker would: an asset with a uri, a size, a kind and, for a
// clip, its length in milliseconds, so everything downstream treats it the same.

const MAX_CLIP_SECONDS = 120;

type Mode = 'picture' | 'video';

function Preview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

export function CameraCapture({
  visible,
  onClose,
  onCapture,
}: {
  visible: boolean;
  onClose: () => void;
  onCapture: (asset: ImagePickerAsset) => void;
}) {
  const camera = useRef<CameraView>(null);
  const [cameraPermission, askCamera] = useCameraPermissions();
  const [micPermission, askMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [mode, setMode] = useState<Mode>('picture');
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState<ImagePickerAsset | null>(null);
  const startedAt = useRef(0);
  const cancelled = useRef(false);

  // Fresh each time it opens.
  useEffect(() => {
    if (!visible) return;
    cancelled.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTaken(null);
    setMode('picture');
    setRecording(false);
    setTorch(false);
    setReady(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || cameraPermission?.granted || cameraPermission?.canAskAgain === false) return;
    void askCamera();
  }, [visible, cameraPermission, askCamera]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      setSeconds(elapsed);
      if (elapsed >= MAX_CLIP_SECONDS) void camera.current?.stopRecording();
    }, 250);
    return () => clearInterval(timer);
  }, [recording]);

  function leave() {
    // Closing while recording throws the clip away.
    if (recording) {
      cancelled.current = true;
      void camera.current?.stopRecording();
    }
    onClose();
  }

  async function shoot() {
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.85 });
      setTaken({ uri: picture.uri, width: picture.width, height: picture.height, type: 'image', mimeType: 'image/jpeg' } as ImagePickerAsset);
    } catch {
      // The camera was closed under us, or is not ready: nothing to keep.
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (!camera.current || !ready) return;
    if (recording) {
      await camera.current.stopRecording();
      return;
    }
    if (!micPermission?.granted) {
      const asked = await askMic();
      if (!asked.granted) return;
    }
    cancelled.current = false;
    startedAt.current = Date.now();
    setSeconds(0);
    setRecording(true);
    try {
      const clip = await camera.current.recordAsync({ maxDuration: MAX_CLIP_SECONDS });
      if (clip && !cancelled.current) {
        const ext = clip.uri.split('?')[0].split('.').pop()?.toLowerCase();
        setTaken({
          uri: clip.uri,
          width: 0,
          height: 0,
          type: 'video',
          mimeType: ext === 'mov' ? 'video/quicktime' : 'video/mp4',
          duration: Math.max(1, Date.now() - startedAt.current),
        } as ImagePickerAsset);
      }
    } catch {
      // Stopped before anything was recorded.
    } finally {
      setRecording(false);
    }
  }

  const denied = cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain === false;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={leave} statusBarTranslucent>
      <View style={styles.screen} testID="camera">
        {!cameraPermission ? (
          <ActivityIndicator color="#ffffff" />
        ) : denied || (!cameraPermission.granted && !cameraPermission.canAskAgain) ? (
          <View style={styles.message}>
            <ThemedText style={styles.white}>Camera is off for Shiggy Trails.</ThemedText>
            <ThemedText style={styles.dim}>Allow it in your settings to take a picture or a video.</ThemedText>
            <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.pill}>
              <ThemedText style={styles.pillText}>Open settings</ThemedText>
            </Pressable>
          </View>
        ) : !cameraPermission.granted ? (
          <ActivityIndicator color="#ffffff" />
        ) : taken ? (
          <>
            {taken.type === 'video' ? (
              <Preview uri={taken.uri} />
            ) : (
              <Image source={{ uri: taken.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityIgnoresInvertColors />
            )}
            <View style={styles.reviewBar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Retake" testID="camera-retake" onPress={() => setTaken(null)} style={styles.round}>
                <RotateCcw size={22} color="#ffffff" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use this"
                testID="camera-use"
                onPress={() => {
                  onCapture(taken);
                  onClose();
                }}
                style={[styles.round, styles.use]}>
                <Check size={26} color="#171717" />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing={facing}
              mode={mode}
              enableTorch={torch}
              onCameraReady={() => setReady(true)}
              videoQuality="720p"
            />
            {recording && (
              <View style={styles.timer}>
                <View style={styles.dot} />
                <ThemedText style={styles.white}>{clockTime(seconds)}</ThemedText>
              </View>
            )}
            <View style={styles.bottom}>
              {!recording && (
                <View style={styles.modes} accessibilityRole="tablist">
                  {(['picture', 'video'] as Mode[]).map((m) => (
                    <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => setMode(m)} style={styles.mode}>
                      <ThemedText style={[styles.modeText, mode === m && styles.modeOn]}>{m === 'picture' ? 'Photo' : 'Video'}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={styles.shutterRow}>
                <View style={styles.side} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={mode === 'picture' ? 'Take a photo' : recording ? 'Stop recording' : 'Start recording'}
                  testID="camera-shutter"
                  disabled={!ready || busy}
                  onPress={() => void (mode === 'picture' ? shoot() : toggleRecording())}
                  style={[styles.shutter, { opacity: ready ? 1 : 0.5 }]}>
                  <View style={[styles.inner, mode === 'video' && styles.innerVideo, recording && styles.innerRecording]} />
                </Pressable>
                <View style={styles.side}>
                  {!recording && (
                    <Pressable accessibilityRole="button" accessibilityLabel="Flip the camera" testID="camera-flip" onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} style={styles.round}>
                      <RefreshCw size={22} color="#ffffff" />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </>
        )}

        {/* Always there: nothing here can trap anybody. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Close the camera" testID="camera-close" onPress={leave} hitSlop={10} style={[styles.round, styles.close]}>
          <X size={24} color="#ffffff" />
        </Pressable>
        {cameraPermission?.granted && !taken && facing === 'back' && !recording && (
          <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'Turn the light off' : 'Turn the light on'} onPress={() => setTorch((t) => !t)} hitSlop={10} style={[styles.round, styles.light]}>
            {torch ? <Zap size={22} color="#ffd54f" /> : <ZapOff size={22} color="#ffffff" />}
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  message: { padding: 32, alignItems: 'center', gap: 12 },
  white: { color: '#ffffff', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  dim: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  pill: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#ffffff' },
  pillText: { color: '#171717', fontWeight: '600' },
  round: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 48, left: 16 },
  light: { position: 'absolute', top: 48, right: 16 },
  timer: { position: 'absolute', top: 56, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff3b30' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 36, gap: 18 },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  mode: { paddingHorizontal: 14, paddingVertical: 6 },
  modeText: { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '600' },
  modeOn: { color: '#ffffff' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32 },
  side: { width: 56, alignItems: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  inner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ffffff' },
  innerVideo: { backgroundColor: '#ff3b30' },
  innerRecording: { width: 30, height: 30, borderRadius: 6 },
  reviewBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 40, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40 },
  use: { backgroundColor: '#ffffff', width: 60, height: 60, borderRadius: 30 },
});
