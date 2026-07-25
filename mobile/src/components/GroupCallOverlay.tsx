import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import type { GroupCallPeer } from '@/hooks/useGroupCall';
import type { CallKind } from '@/hooks/useWebRTCCall';

type Props = {
  roomName: string;
  callKind: CallKind;
  muted: boolean;
  peers: GroupCallPeer[];
  localStreamUrl?: string | null;
  onHangUp: () => void;
  onToggleMute: () => void;
};

function PeerTile({ peer, callKind }: { peer: GroupCallPeer; callKind: CallKind }) {
  return (
    <View style={styles.tile}>
      {peer.streamUrl && callKind === 'video' ? (
        <RTCView streamURL={peer.streamUrl} objectFit="cover" style={styles.tileVideo} />
      ) : (
        <View style={styles.tileAvatar}>
          <Text style={styles.tileAvatarText}>{peer.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.tileName} numberOfLines={1}>{peer.name}</Text>
    </View>
  );
}

export function GroupCallOverlay({
  roomName,
  callKind,
  muted,
  peers,
  localStreamUrl,
  onHangUp,
  onToggleMute,
}: Props) {
  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <Text style={styles.title}>{roomName || 'Room call'}</Text>
        <Text style={styles.subtitle}>
          {peers.length === 0
            ? 'Waiting for others to join'
            : `${peers.length} other${peers.length === 1 ? '' : 's'} on the call`}
        </Text>
        <View style={styles.grid}>
          {callKind === 'video' && localStreamUrl ? (
            <View style={[styles.tile, styles.localTile]}>
              <RTCView streamURL={localStreamUrl} objectFit="cover" mirror style={styles.tileVideo} />
              <Text style={styles.tileName}>You</Text>
            </View>
          ) : null}
          {peers.map((peer) => (
            <PeerTile key={peer.userId} peer={peer} callKind={callKind} />
          ))}
        </View>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={onToggleMute} style={styles.round}>
            <Text style={styles.roundText}>{muted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onHangUp} style={[styles.round, styles.end]}>
            <Text style={styles.roundText}>Leave</Text>
          </TouchableOpacity>
        </View>
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
    maxWidth: 440,
    borderRadius: 28,
    padding: 18,
    alignItems: 'center',
    backgroundColor: '#121827',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#cbd5e1', fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 14 },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  tile: {
    width: 132,
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
  localTile: { borderWidth: 2, borderColor: '#a0563b' },
  tileVideo: { width: '100%', height: '100%' },
  tileAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a0563b',
  },
  tileAvatarText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  tileName: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  toolbar: { flexDirection: 'row', gap: 12, marginTop: 16 },
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
