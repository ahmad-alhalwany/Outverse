import { apiFetch, apiFetchJson } from './api';

export type Tip = {
  id: number;
  sender: { id: number; username: string; first_name: string; last_name: string; avatar: string | null };
  recipient: { id: number; username: string; first_name: string; last_name: string; avatar: string | null };
  amount: number;
  post: number | null;
  reel: number | null;
  message: string;
  created_at: string;
};

export async function sendTip(
  recipientId: number,
  amount: number,
  opts: { postId?: number; reelId?: number; message?: string } = {},
): Promise<{ ok: true; balance: number; tip: Tip } | { ok: false; error: string }> {
  const res = await apiFetchJson('shop/tips/', {
    method: 'POST',
    json: {
      recipient_id: recipientId,
      amount,
      post_id: opts.postId,
      reel_id: opts.reelId,
      message: opts.message,
    },
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Could not send tip.' };
  return { ok: true, balance: data.balance, tip: data as Tip };
}

export async function fetchTips(direction: 'sent' | 'received' = 'received'): Promise<Tip[]> {
  const res = await apiFetch(`shop/tips/?direction=${direction}`);
  if (!res.ok) return [];
  return res.json();
}
