import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import type { CallKind, IncomingCall } from '@/hooks/useWebRTCCall';
import { mediaUrl } from '@/api/config';

type Props = {
  mode: 'incoming' | 'active';
  callKind: CallKind;
  peerName: string;
  peerAvatar?: string | null;
  incoming?: IncomingCall | null;
  muted: boolean;
  localStreamUrl?: string | null;
  remoteStreamUrl?: string | null;
  onAccept: () => void;
  onReject: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
};

function avatarSource(name: string, avatar?: string | null) {
  if (avatar) return { uri: mediaUrl(avatar) };
  return { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=a0563b&color=fff&size=128` };
}

export function CallOverlay({
  mode,
  callKind,
  peerName,
  peerAvatar,
  incoming,
  muted,
  localStreamUrl,
  remoteStreamUrl,
  onAccept,
  onReject,
  onHangUp,
  onToggleMute,
}: Props) {
  const name = incoming?.fromName || peerName;
  const avatar = incoming?.fromAvatar ?? peerAvatar;
  const kind = incoming?.callType || callKind;

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        {mode === 'incoming' && incoming ? (
          <>
            <Image source={avatarSource(name, avatar)} style={styles.avatar} />
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.subtitle}>Incoming {kind === 'video' ? 'video' : 'voice'} call</Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={onReject} style={[styles.button, styles.reject]}>
                <Text style={styles.buttonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onAccept} style={[styles.button, styles.accept]}>
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.videoStage, kind === 'audio' && styles.audioStage]}>
              {remoteStreamUrl && kind === 'video' ? (
                <RTCView streamURL={remoteStreamUrl} objectFit="cover" style={styles.remoteVideo} />
              ) : (
                <Image source={avatarSource(name, avatar)} style={styles.avatarLarge} />
              )}
              {localStreamUrl && kind === 'video' ? (
                <RTCView streamURL={localStreamUrl} objectFit="cover" mirror style={styles.localVideo} />
              ) : null}
            </View>
            <Text style={styles.subtitle}>{name} · {kind === 'video' ? 'Video' : 'Voice'}</Text>
            <View style={styles.toolbar}>
              <TouchableOpacity onPress={onToggleMute} style={styles.round}>
                <Text style={styles.roundText}>{muted ? 'Unmute' : 'Mute'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onHangUp} style={[styles.round, styles.end]}>
                <Text style={styles.roundText}>End</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 8, 20, 0.82)',
    padding: 18,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#121827',
  },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 14 },
  avatarLarge: { width: 132, height: 132, borderRadius: 66 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 6 },
  subtitle: { color: '#cbd5e1', fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  button: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  accept: { backgroundColor: '#22c55e' },
  reject: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontWeight: '900' },
  videoStage: {
    width: '100%',
    height: 320,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
  audioStage: { height: 220 },
  remoteVideo: { width: '100%', height: '100%' },
  localVideo: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 96,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
  },
  toolbar: { flexDirection: 'row', gap: 12 },
  round: {
    minWidth: 86,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#334155',
  },
  end: { backgroundColor: '#ef4444' },
  roundText: { color: '#fff', fontWeight: '900' },
});
