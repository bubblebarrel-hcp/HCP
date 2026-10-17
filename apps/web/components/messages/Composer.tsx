'use client';

import { useEffect, useRef, useState } from 'react';
import { Bold, Check, Code, Italic, Mic, Paperclip, Send, Smile, Strikethrough, Sticker as StickerIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { EmojiPanel } from '@/components/messages/EmojiPanel';
import { StickerPanel } from '@/components/messages/StickerPanel';
import { VoiceRecorder, voiceSupported } from '@/components/messages/VoiceRecorder';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { toggleMark } from '@/lib/chat-format';
import {
  ACCEPTED_ATTACHMENTS,
  clientKey,
  editMessage,
  MAX_ATTACHMENTS,
  MAX_CAPTION,
  MAX_MESSAGE,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  mediaLength,
  pictureSize,
  sendMessage,
  uploadAttachment,
  type ConversationStatus,
  type DirectMessage,
  type SendInput,
  type Sticker,
} from '@/lib/messages';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/api';

// The message box (D71, D73): words with light formatting, emoji, stickers, photos
// and clips, a voice note, and, for two minutes after sending, editing.

interface Staged {
  key: string;
  file: File;
  preview: string;
  kind: 'PHOTO' | 'VIDEO';
  progress: number;
}

type Panel = 'emoji' | 'sticker' | null;

// A line standing in for the message being answered.
function replyPreview(m: DirectMessage) {
  const words = (m.body ?? '').trim();
  if (m.kind === 'STICKER') return 'Sticker';
  if (m.kind === 'VOICE') return 'Voice message';
  if (m.kind === 'MEDIA') return words || (m.attachments.length === 1 ? (m.attachments[0].kind === 'VIDEO' ? 'Video' : 'Photo') : `${m.attachments.length} items`);
  return words;
}

export function Composer({
  conversationId,
  canShareFiles,
  editing,
  onCancelEdit,
  replyingTo,
  onCancelReply,
  onSent,
  onEdited,
}: {
  conversationId: string;
  canShareFiles: boolean;
  editing: DirectMessage | null;
  onCancelEdit: () => void;
  // The message being answered; it rides along with whatever is sent next.
  replyingTo: DirectMessage | null;
  onCancelReply: () => void;
  onSent: (result: { message: DirectMessage; status: ConversationStatus }) => void;
  onEdited: (message: DirectMessage) => void;
}) {
  const [draft, setDraft] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const key = useRef(clientKey());
  const limit = staged.length ? MAX_CAPTION : MAX_MESSAGE;

  // Editing puts the words back in the box; leaving it clears them.
  useEffect(() => {
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(editing.body ?? '');
      setPanel(null);
      field.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (replyingTo) field.current?.focus();
  }, [replyingTo]);

  useEffect(() => {
    return () => staged.forEach((s) => URL.revokeObjectURL(s.preview));
    // Only on unmount: previews are revoked as they are removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function format(mark: '*' | '_' | '~' | '`') {
    const el = field.current;
    if (!el) return;
    const next = toggleMark(draft, el.selectionStart, el.selectionEnd, mark);
    setDraft(next.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  }

  function insert(text: string) {
    const el = field.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const value = draft.slice(0, start) + text + draft.slice(end);
    if (value.length > limit) return;
    setDraft(value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function stage(files: FileList | null) {
    if (!files?.length) return;
    const next: Staged[] = [];
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith('video/') ? 'VIDEO' : file.type.startsWith('image/') ? 'PHOTO' : null;
      if (!kind) {
        toast.error(`${file.name} is not a picture or a video.`);
        continue;
      }
      if (file.size > (kind === 'VIDEO' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES)) {
        toast.error(`${file.name} is too big. Pictures can be 10MB, videos 50MB.`);
        continue;
      }
      next.push({ key: clientKey(), file, preview: URL.createObjectURL(file), kind, progress: 0 });
    }
    setStaged((current) => {
      const room = MAX_ATTACHMENTS - current.length;
      if (next.length > room) {
        toast.error(`${MAX_ATTACHMENTS} is the most you can send at once.`);
        next.slice(room).forEach((s) => URL.revokeObjectURL(s.preview));
      }
      return [...current, ...next.slice(0, Math.max(0, room))];
    });
    setPanel(null);
    if (picker.current) picker.current.value = '';
  }

  function unstage(stagedKey: string) {
    setStaged((current) => {
      const gone = current.find((s) => s.key === stagedKey);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((s) => s.key !== stagedKey);
    });
  }

  async function post(input: SendInput) {
    const result = await sendMessage(conversationId, { ...input, ...(replyingTo ? { replyToId: replyingTo.id } : {}) }, key.current);
    key.current = clientKey();
    onSent({ message: result.message, status: result.status });
    return result;
  }

  async function submit() {
    if (busy) return;
    const text = draft.trim();

    if (editing) {
      if (!text) return;
      setBusy(true);
      try {
        const { message } = await editMessage(editing.id, text);
        onEdited(message);
        setDraft('');
        onCancelEdit();
      } catch (err) {
        toast.error(errorMessage(err, 'Could not edit that'));
        onCancelEdit();
        setDraft('');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (staged.length) {
      setBusy(true);
      try {
        const ids: string[] = [];
        for (const item of staged) {
          const measured =
            item.kind === 'PHOTO' ? { ...(await pictureSize(item.file)), durationSec: null } : await mediaLength(item.file, 'video');
          const uploaded = await uploadAttachment(conversationId, item.file, { kind: item.kind, ...measured }, (p) =>
            setStaged((current) => current.map((s) => (s.key === item.key ? { ...s, progress: p } : s))),
          );
          ids.push(uploaded.id);
        }
        await post({ kind: 'MEDIA', attachmentIds: ids, ...(text ? { body: text } : {}) });
        staged.forEach((s) => URL.revokeObjectURL(s.preview));
        setStaged([]);
        setDraft('');
      } catch (err) {
        toast.error(errorMessage(err, 'Could not send those'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!text) return;
    setBusy(true);
    try {
      await post({ kind: 'TEXT', body: text });
      setDraft('');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send that'));
    } finally {
      setBusy(false);
    }
  }

  async function sendSticker(sticker: Sticker) {
    if (busy) return;
    setBusy(true);
    try {
      await post({ kind: 'STICKER', stickerId: sticker.id });
      setPanel(null);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send that sticker'));
    } finally {
      setBusy(false);
    }
  }

  async function sendVoice(blob: Blob, durationSec: number) {
    if (busy) return;
    setBusy(true);
    try {
      const uploaded = await uploadAttachment(conversationId, blob, { kind: 'AUDIO', durationSec });
      await post({ kind: 'VOICE', attachmentIds: [uploaded.id] });
      setRecording(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send that voice message'));
    } finally {
      setBusy(false);
    }
  }

  if (recording) {
    return <VoiceRecorder busy={busy} onCancel={() => setRecording(false)} onSend={(blob, seconds) => void sendVoice(blob, seconds)} />;
  }

  const canSend = (Boolean(draft.trim()) || staged.length > 0) && !busy;
  const toolButton = 'grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40';

  return (
    <div className="space-y-2 border-t border-border pt-3" data-testid="composer">
      {panel === 'emoji' && <EmojiPanel onPick={insert} />}
      {panel === 'sticker' && <StickerPanel sending={busy} onSend={(s) => void sendSticker(s)} />}

      {replyingTo && !editing && (
        <div className="flex items-center justify-between gap-3 rounded-lg border-l-4 border-primary bg-muted px-3 py-2 text-sm" data-testid="reply-banner">
          <span className="min-w-0">
            <span className="block font-medium">Replying to {replyingTo.mine ? 'yourself' : 'them'}</span>
            <span className="block truncate text-muted-foreground">{replyPreview(replyingTo)}</span>
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-background">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {editing && (
        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm" data-testid="editing-banner">
          <span>
            <span className="font-medium">Editing</span> <span className="text-muted-foreground">· you have two minutes after sending</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onCancelEdit();
            }}
            aria-label="Stop editing"
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-background"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {staged.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" data-testid="staged-files">
          {staged.map((s) => (
            <li key={s.key} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              {s.kind === 'VIDEO' ? (
                <video src={s.preview} muted playsInline className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.preview} alt="" className="h-full w-full object-cover" />
              )}
              {busy && s.progress > 0 && s.progress < 1 && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
                  <span className="block h-full bg-primary" style={{ width: `${Math.round(s.progress * 100)}%` }} />
                </span>
              )}
              {!busy && (
                <button
                  type="button"
                  onClick={() => unstage(s.key)}
                  aria-label="Remove"
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1" role="toolbar" aria-label="Formatting">
        <button type="button" className={toolButton} onClick={() => format('*')} aria-label="Bold" title="Bold  (Ctrl+B)" data-testid="format-bold">
          <Bold className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={toolButton} onClick={() => format('_')} aria-label="Italic" title="Italic  (Ctrl+I)" data-testid="format-italic">
          <Italic className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={toolButton} onClick={() => format('~')} aria-label="Strikethrough" title="Strikethrough" data-testid="format-strike">
          <Strikethrough className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={toolButton} onClick={() => format('`')} aria-label="Monospace" title="Monospace" data-testid="format-mono">
          <Code className="h-4 w-4" aria-hidden />
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <button
          type="button"
          className={cn(toolButton, panel === 'emoji' && 'bg-muted text-foreground')}
          onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}
          aria-label="Emoji"
          aria-pressed={panel === 'emoji'}
          data-testid="open-emoji"
        >
          <Smile className="h-5 w-5" aria-hidden />
        </button>
        {canShareFiles && !editing && (
          <>
            <button
              type="button"
              className={cn(toolButton, panel === 'sticker' && 'bg-muted text-foreground')}
              onClick={() => setPanel(panel === 'sticker' ? null : 'sticker')}
              aria-label="Stickers"
              aria-pressed={panel === 'sticker'}
              data-testid="open-stickers"
            >
              <StickerIcon className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" className={toolButton} onClick={() => picker.current?.click()} aria-label="Attach photos or videos" data-testid="attach">
              <Paperclip className="h-5 w-5" aria-hidden />
            </button>
            <input
              ref={picker}
              type="file"
              multiple
              accept={ACCEPTED_ATTACHMENTS}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => stage(e.target.files)}
              data-testid="attach-input"
            />
          </>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          ref={field}
          value={draft}
          maxLength={limit}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            } else if (e.key === 'Escape' && editing) {
              setDraft('');
              onCancelEdit();
            } else if (e.key === 'Escape' && replyingTo) {
              onCancelReply();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
              e.preventDefault();
              format(e.key === 'b' ? '*' : '_');
            }
          }}
          placeholder={staged.length ? 'Add a caption' : editing ? 'Edit your message' : 'Write a message'}
          aria-label="Message"
          className="max-h-32 min-h-10 flex-1 resize-none"
          data-testid="message-input"
        />
        {!canSend && !editing && canShareFiles && voiceSupported() ? (
          <Button type="button" variant="outline" onClick={() => setRecording(true)} aria-label="Record a voice message" data-testid="voice-start">
            <Mic className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" onClick={() => void submit()} disabled={!canSend} aria-label={editing ? 'Save edit' : 'Send'} data-testid="message-send">
            {editing ? <Check className="h-4 w-4" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          </Button>
        )}
      </div>
    </div>
  );
}
