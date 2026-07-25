'use client';

import { apiFetchJson } from '@/lib/api';
import { getToken } from '@/lib/auth';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush(vapidPublicKey?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (!getToken()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription && vapidPublicKey) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  if (!subscription) return false;

  const json = subscription.toJSON();
  const res = await apiFetchJson('notifications/push-subscribe/', {
    method: 'POST',
    json: {
      endpoint: json.endpoint,
      keys: json.keys,
    },
  });
  return res.ok;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await apiFetchJson('notifications/push-subscribe/', {
      method: 'DELETE',
      json: { endpoint: sub.endpoint },
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
