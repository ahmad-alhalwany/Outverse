import { apiFetchJson } from './api';

/** Ask the Writing Buddy for a reflective question about an in-progress draft. */
export async function deepenDraft(opts: {
  text: string;
  lang?: 'en' | 'ar';
}): Promise<{ prompt: string } | { error: string }> {
  const params = new URLSearchParams();
  params.set('lang', opts.lang ?? 'en');
  const res = await apiFetchJson(`questions/deepen/?${params.toString()}`, {
    method: 'POST',
    json: { text: opts.text, lang: opts.lang ?? 'en' },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data?.detail) || 'Could not generate a reflection right now.';
    return { error: msg };
  }
  if (!data?.prompt) return { error: 'Could not generate a reflection right now.' };
  return { prompt: data.prompt as string };
}
