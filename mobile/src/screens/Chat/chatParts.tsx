import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediaUrl } from '@/api/config';
import {
  CHAT_REACTS,
  QUICK_EMOJIS,
  VANISH_PRESETS,
  formatTimeLeft,
  moodEmoji,
  type ChatPalette,
  type ChatThreadMessage,
  type TFn,
} from '@/lib/chat';

export function ChatBubble({
  item,
  isOwn,
  isRoom,
  C,
  t,
  onLongPress,
}: {
  item: ChatThreadMessage;
  isOwn: boolean;
  isRoom?: boolean;
  C: ChatPalette;
  t: TFn;
  onLongPress: () => void;
}) {
  const color = isOwn ? '#fff' : C.text;
  const muted = isOwn ? 'rgba(255,255,255,0.75)' : C.text2;
  const attachment = item.attachment_url ? mediaUrl(item.attachment_url) : '';
  const looksLikeImage =
    item.message_type === 'image' || /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(attachment);

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={320}
      style={[
        styles.bubble,
        isOwn ? styles.bubbleOut : styles.bubbleIn,
        { backgroundColor: isOwn ? C.bubbleOut : C.bubbleIn },
      ]}
    >
      {item.is_pinned ? <Text style={[styles.metaTiny, { color: muted }]}>📌 {t('chat.pinned')}</Text> : null}
      {isRoom && !isOwn ? (
        <Text style={[styles.sender, { color: muted }]}>{item.sender.display_name || item.sender.username}</Text>
      ) : null}
      {item.is_deleted ? (
        <Text style={[styles.body, { color: muted, fontStyle: 'italic' }]}>{t('chat.deletedMessage')}</Text>
      ) : (
        <>
          {looksLikeImage && attachment ? (
            <Image source={{ uri: attachment }} style={styles.attachImage} />
          ) : null}
          {item.message_type === 'file' && attachment && !looksLikeImage ? (
            <Pressable onPress={() => void Linking.openURL(attachment)}>
              <Text style={[styles.body, { color, textDecorationLine: 'underline' }]}>
                {item.text || t('chat.downloadFile')}
              </Text>
            </Pressable>
          ) : null}
          {item.text && item.message_type !== 'file' ? (
            <Text style={[styles.body, { color }]}>{item.text}</Text>
          ) : null}
        </>
      )}
      {!item.is_deleted && item.edited_at ? <Text style={[styles.metaTiny, { color: muted }]}>{t('chat.edited')}</Text> : null}
      {!item.is_deleted && item.expires_at ? (
        <Text style={[styles.metaTiny, { color: muted }]}>🔥 {formatTimeLeft(item.expires_at, t)}</Text>
      ) : null}
      {item.reaction_counts && Object.keys(item.reaction_counts).length > 0 ? (
        <View style={styles.reacts}>
          {Object.entries(item.reaction_counts).map(([emoji, count]) => (
            <View
              key={emoji}
              style={[
                styles.reactChip,
                { backgroundColor: item.my_reaction === emoji ? 'rgba(124,58,237,0.25)' : 'rgba(0,0,0,0.08)' },
              ]}
            >
              <Text style={{ color, fontSize: 11 }}>
                {emoji} {Number(count)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChatActions({
  item,
  isOwn,
  C,
  t,
  busy,
  onClose,
  onReply,
  onPin,
  onReact,
  onEdit,
  onDelete,
}: {
  item: ChatThreadMessage;
  isOwn: boolean;
  C: ChatPalette;
  t: TFn;
  busy?: boolean;
  onClose: () => void;
  onReply: () => void;
  onPin: () => void;
  onReact: (emoji: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <View style={[styles.actions, { backgroundColor: C.white, borderTopColor: C.line }]}>
      <View style={styles.actionsHead}>
        <Text style={[styles.actionsTitle, { color: C.text2 }]} numberOfLines={1}>
          {item.text.slice(0, 48) || t('chat.react')}
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={18} color={C.text2} />
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable onPress={onReply} style={[styles.actionBtn, { backgroundColor: C.card2 }]}>
          <Text style={[styles.actionBtnText, { color: C.text }]}>{t('chat.reply')}</Text>
        </Pressable>
        <Pressable onPress={onPin} disabled={busy} style={[styles.actionBtn, { backgroundColor: C.card2 }]}>
          <Text style={[styles.actionBtnText, { color: C.text }]}>{item.is_pinned ? t('chat.unpin') : t('chat.pin')}</Text>
        </Pressable>
        {isOwn && onEdit ? (
          <Pressable onPress={onEdit} style={[styles.actionBtn, { backgroundColor: C.card2 }]}>
            <Text style={[styles.actionBtnText, { color: C.text }]}>{t('chat.edit')}</Text>
          </Pressable>
        ) : null}
        {isOwn && onDelete ? (
          <Pressable onPress={onDelete} style={[styles.actionBtn, { backgroundColor: C.card2 }]}>
            <Text style={[styles.actionBtnText, { color: C.text }]}>{t('chat.delete')}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.actionRow}>
        {CHAT_REACTS.map((emoji) => (
          <Pressable
            key={emoji}
            disabled={busy}
            onPress={() => onReact(emoji)}
            style={[styles.emojiBtn, { backgroundColor: item.my_reaction === emoji ? C.brown : C.card2 }]}
          >
            <Text style={{ fontSize: 16 }}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ChatComposer({
  C,
  t,
  value,
  onChange,
  onSend,
  sending,
  vanishSeconds,
  onVanish,
  onAttach,
  onMood,
  moodIcon,
  replyName,
  replyText,
  onCancelReply,
  onSchedule,
  scheduleBusy,
  uploading,
}: {
  C: ChatPalette;
  t: TFn;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending?: boolean;
  vanishSeconds: number | null;
  onVanish: (seconds: number | null) => void;
  onAttach: () => void;
  onMood?: (key: 'sun' | 'cloud') => void;
  moodIcon?: string;
  replyName?: string;
  replyText?: string;
  onCancelReply?: () => void;
  onSchedule?: (hours: number) => void;
  scheduleBusy?: boolean;
  uploading?: boolean;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [vanishOpen, setVanishOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const vanishLabel = VANISH_PRESETS.find((p) => p.seconds === vanishSeconds);

  return (
    <View style={[styles.composer, { backgroundColor: C.white, borderTopColor: C.line }]}>
      {uploading ? (
        <Text style={[styles.uploadHint, { color: C.text2 }]}>{t('chat.uploadingAttachment', { percent: '…' })}</Text>
      ) : null}
      {replyText ? (
        <View style={[styles.replyBar, { backgroundColor: C.card, borderLeftColor: C.brown }]}>
          <Text style={[styles.replyText, { color: C.text }]} numberOfLines={1}>
            {t('chat.replyingToQuote', { name: replyName || t('chat.them'), text: replyText })}
          </Text>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <Ionicons name="close" size={16} color={C.text2} />
          </Pressable>
        </View>
      ) : null}
      {emojiOpen ? (
        <View style={[styles.popover, { backgroundColor: C.card, borderColor: C.line }]}>
          {QUICK_EMOJIS.map((emoji) => (
            <Pressable key={emoji} onPress={() => { onChange(value + emoji); setEmojiOpen(false); }} style={styles.popEmoji}>
              <Text style={{ fontSize: 20 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {vanishOpen ? (
        <View style={[styles.popoverCol, { backgroundColor: C.card, borderColor: C.line }]}>
          <Pressable onPress={() => { onVanish(null); setVanishOpen(false); }}>
            <Text style={{ color: C.text, fontWeight: vanishSeconds ? '500' : '800' }}>{t('chat.vanishOff')}</Text>
          </Pressable>
          {VANISH_PRESETS.map((preset) => (
            <Pressable key={preset.seconds} onPress={() => { onVanish(preset.seconds); setVanishOpen(false); }}>
              <Text style={{ color: C.text, fontWeight: vanishSeconds === preset.seconds ? '800' : '500' }}>
                {t(preset.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {moodOpen && onMood ? (
        <View style={[styles.popover, { backgroundColor: C.card, borderColor: C.line }]}>
          <Pressable onPress={() => { onMood('sun'); setMoodOpen(false); }} style={styles.popEmoji}>
            <Text style={{ fontSize: 20 }}>☀️</Text>
          </Pressable>
          <Pressable onPress={() => { onMood('cloud'); setMoodOpen(false); }} style={styles.popEmoji}>
            <Text style={{ fontSize: 20 }}>☁️</Text>
          </Pressable>
        </View>
      ) : null}
      {value.trim() && onSchedule ? (
        <View style={styles.scheduleRow}>
          <Text style={[styles.scheduleLabel, { color: C.text2 }]}>{t('chat.sendLater')}</Text>
          {[1, 3, 24].map((hours) => (
            <Pressable
              key={hours}
              disabled={scheduleBusy || sending}
              onPress={() => onSchedule(hours)}
              style={[styles.scheduleChip, { borderColor: C.line }]}
            >
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 12 }}>{hours}h</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.inputRow}>
        <Pressable onPress={() => { setEmojiOpen((v) => !v); setVanishOpen(false); setMoodOpen(false); }} hitSlop={6}>
          <Ionicons name="happy-outline" size={22} color={C.text2} />
        </Pressable>
        {onMood ? (
          <Pressable onPress={() => { setMoodOpen((v) => !v); setEmojiOpen(false); setVanishOpen(false); }} hitSlop={6}>
            <Text style={{ fontSize: 18 }}>{moodEmoji(moodIcon)}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onAttach} hitSlop={6}>
          <Ionicons name="attach" size={22} color={C.text2} />
        </Pressable>
        <Pressable
          onPress={() => { setVanishOpen((v) => !v); setEmojiOpen(false); setMoodOpen(false); }}
          hitSlop={6}
        >
          <Ionicons name="flame-outline" size={22} color={vanishSeconds ? C.brown : C.text2} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={t('chat.messagePlaceholder')}
          placeholderTextColor={C.text2}
          multiline
          maxLength={2000}
          style={[styles.input, { color: C.text, backgroundColor: C.card2, borderColor: C.line }]}
        />
        <Pressable
          onPress={onSend}
          disabled={sending || !value.trim()}
          style={[styles.send, { backgroundColor: C.brownDk, opacity: sending || !value.trim() ? 0.5 : 1 }]}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
        </Pressable>
      </View>
      {vanishSeconds && vanishLabel ? (
        <Text style={[styles.vanishHint, { color: C.brown }]}>{t('chat.vanishModeLabel', { label: t(vanishLabel.labelKey) })}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleOut: { borderBottomRightRadius: 4, alignSelf: 'flex-end' },
  bubbleIn: { borderBottomLeftRadius: 4, alignSelf: 'flex-start' },
  sender: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  body: { fontSize: 15, lineHeight: 21 },
  metaTiny: { fontSize: 10, marginTop: 4 },
  attachImage: { width: 220, height: 160, borderRadius: 10, marginBottom: 6 },
  reacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  reactChip: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  actions: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  actionsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  actionsTitle: { flex: 1, fontSize: 12, marginRight: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  actionBtn: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  emojiBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  composer: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1 },
  uploadHint: { fontSize: 11, marginBottom: 6 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  replyText: { flex: 1, fontSize: 12 },
  popover: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderWidth: 1, borderRadius: 14, padding: 8, marginBottom: 8 },
  popoverCol: { gap: 8, borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 },
  popEmoji: { padding: 4 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  scheduleLabel: { fontSize: 12, fontWeight: '800' },
  scheduleChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  vanishHint: { fontSize: 11, fontWeight: '700', marginTop: 6 },
});
