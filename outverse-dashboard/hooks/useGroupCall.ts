'use client';

import { useCallback, useRef, useState } from 'react';
import { getChatRuntimeConfig } from '@/lib/ws';
import type { SignalPayload } from './useSignalWebSocket';
import type { CallKind } from './useWebRTCCall';

const DEFAULT_ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type GroupCallPeer = {
  userId: number;
  name: string;
  stream: MediaStream | null;
};

type SendSignal = (payload: SignalPayload) => boolean;

/**
 * Mesh WebRTC group calling — every participant connects directly to every
 * other participant (no SFU). Discovery works by re-broadcasting a
 * presence "announce" whenever an unknown peer's announce is seen, so a
 * late joiner learns about everyone already in the call. To avoid both
 * sides of a pair racing to offer each other, only the lower user id
 * initiates the offer for any given pair.
 */
export function useGroupCall(meId: number, myName: string, sendSignal: SendSignal) {
  const [active, setActive] = useState(false);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [callKind, setCallKind] = useState<CallKind>('audio');
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<GroupCallPeer[]>([]);

  const roomIdRef = useRef<number | null>(null);
  const callIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const iceConfigRef = useRef<RTCConfiguration>(DEFAULT_ICE);
  const pcsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const namesRef = useRef<Map<number, string>>(new Map());

  const refreshPeers = useCallback(() => {
    setPeers(
      Array.from(pcsRef.current.keys()).map((uid) => ({
        userId: uid,
        name: namesRef.current.get(uid) || `User ${uid}`,
        stream: (pcsRef.current.get(uid) as unknown as { _remoteStream?: MediaStream })?._remoteStream || null,
      })),
    );
  }, []);

  const closePeer = useCallback(
    (uid: number) => {
      const pc = pcsRef.current.get(uid);
      if (pc) {
        pc.close();
        pcsRef.current.delete(uid);
      }
      namesRef.current.delete(uid);
      refreshPeers();
    },
    [refreshPeers],
  );

  const cleanup = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    namesRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    roomIdRef.current = null;
    callIdRef.current = null;
    setActive(false);
    setRoomId(null);
    setPeers([]);
  }, []);

  const getMedia = useCallback(async (kind: CallKind) => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video',
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId: number, kind: CallKind) => {
      const pc = new RTCPeerConnection(iceConfigRef.current);
      pcsRef.current.set(targetUserId, pc);
      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        (pc as unknown as { _remoteStream?: MediaStream })._remoteStream = stream;
        refreshPeers();
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate && roomIdRef.current && callIdRef.current) {
          sendSignal({
            type: 'call.room.ice',
            room_id: roomIdRef.current,
            call_id: callIdRef.current,
            to_user_id: targetUserId,
            candidate: ev.candidate.toJSON(),
          });
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(targetUserId);
        }
      };
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }
      void kind;
      return pc;
    },
    [sendSignal, refreshPeers, closePeer],
  );

  const offerTo = useCallback(
    async (targetUserId: number) => {
      const pc = createPeerConnection(targetUserId, callKind);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({
        type: 'call.room.offer',
        room_id: roomIdRef.current,
        call_id: callIdRef.current,
        to_user_id: targetUserId,
        from_user_name: myName,
        sdp: offer,
      });
    },
    [createPeerConnection, callKind, sendSignal, myName],
  );

  const joinGroupCall = useCallback(
    async (targetRoomId: number, kind: CallKind) => {
      if (active) return;
      try {
        await getChatRuntimeConfig().then((data) => {
          if (data?.ice_servers?.length) iceConfigRef.current = { iceServers: data.ice_servers };
        });
      } catch {
        /* keep default STUN */
      }
      roomIdRef.current = targetRoomId;
      callIdRef.current = crypto.randomUUID();
      setRoomId(targetRoomId);
      setCallKind(kind);
      try {
        await getMedia(kind);
      } catch {
        cleanup();
        throw new Error('Could not access camera/microphone');
      }
      setActive(true);
      // Presence beacon — lets existing participants (and, via their
      // reply-beacon, this client too) discover each other.
      sendSignal({
        type: 'call.room.offer',
        room_id: targetRoomId,
        call_id: callIdRef.current,
        from_user_name: myName,
      });
    },
    [active, getMedia, sendSignal, myName, cleanup],
  );

  const leaveGroupCall = useCallback(() => {
    if (roomIdRef.current && callIdRef.current) {
      sendSignal({
        type: 'call.room.hangup',
        room_id: roomIdRef.current,
        call_id: callIdRef.current,
      });
    }
    cleanup();
  }, [sendSignal, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMuted((m) => !m);
  }, []);

  const handleGroupSignal = useCallback(
    async (payload: SignalPayload) => {
      const t = payload.type as string;
      if (!t.startsWith('call.room.')) return;
      const fromUserId = payload.from_user_id as number;
      if (!fromUserId || fromUserId === meId) return;
      if (!active || Number(payload.room_id) !== roomIdRef.current) return;
      const toUserId = payload.to_user_id as number | undefined;
      if (toUserId && toUserId !== meId) return; // targeted at someone else in the mesh

      if (payload.from_user_name) {
        namesRef.current.set(fromUserId, payload.from_user_name as string);
      }

      if (t === 'call.room.offer' && !toUserId && !payload.sdp) {
        // Presence beacon from a peer we don't know yet.
        if (!pcsRef.current.has(fromUserId)) {
          if (meId < fromUserId) {
            await offerTo(fromUserId);
          } else {
            // Reply so the (higher-id) newcomer learns about us too.
            sendSignal({
              type: 'call.room.offer',
              room_id: roomIdRef.current,
              call_id: callIdRef.current,
              from_user_name: myName,
            });
          }
        }
        return;
      }

      if (t === 'call.room.offer' && toUserId === meId && payload.sdp) {
        const pc = createPeerConnection(fromUserId, callKind);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({
          type: 'call.room.answer',
          room_id: roomIdRef.current,
          call_id: callIdRef.current,
          to_user_id: fromUserId,
          sdp: answer,
        });
        refreshPeers();
        return;
      }

      if (t === 'call.room.answer' && toUserId === meId && payload.sdp) {
        const pc = pcsRef.current.get(fromUserId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
        }
        return;
      }

      if (t === 'call.room.ice' && toUserId === meId && payload.candidate) {
        const pc = pcsRef.current.get(fromUserId);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate as RTCIceCandidateInit));
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (t === 'call.room.hangup') {
        closePeer(fromUserId);
      }
    },
    [meId, active, callKind, offerTo, createPeerConnection, sendSignal, myName, closePeer, refreshPeers],
  );

  return {
    active,
    roomId,
    callKind,
    muted,
    peers,
    localVideoRef,
    joinGroupCall,
    leaveGroupCall,
    toggleMute,
    handleGroupSignal,
  };
}
