import { apiFetchJson } from './api';
import type { ShareChannel, ShareContentType } from './shareUtils';
import { normalizeShareChannel } from './shareUtils';

export async function recordContentShare(
  contentType: ShareContentType,
  id: number,
  channel: ShareChannel,
): Promise<{ shares_count?: number } | null> {
  const path = contentType === 'post' ? `posts/${id}/share/` : `reels/${id}/share/`;
  try {
    const res = await apiFetchJson(path, {
      method: 'POST',
      json: { channel: normalizeShareChannel(channel) },
    });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  } catch {
    return null;
  }
}
