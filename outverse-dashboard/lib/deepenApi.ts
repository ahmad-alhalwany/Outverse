import { apiFetchJson } from './api';

/** Ask the Writing Buddy for a reflective question about an in-progress draft. */
export async function deepenDraft(opts: {
  text: string;
  lang?: 'en' | 'ar';
}): Promise<{ prompt: string } | { error: string | undefined }> {
  const params = new URLSearchParams();
  params.set('lang', opts.lang ?? 'en');
  const res = await apiFetchJson(`questions/deepen/?${params.toString()}`, {
    method: 'POST',
    json: { text: opts.text, lang: opts.lang ?? 'en' },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { error: data?.detail };
  if (!data?.prompt) return { error: undefined };
  return { prompt: data.prompt as string };
}
