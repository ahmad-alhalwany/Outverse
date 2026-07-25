import { apiFetchJson } from './api';

async function postJson(path: string, body: Record<string, unknown>) {
  const res = await apiFetchJson(path, { method: 'POST', json: body });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { error: (data?.detail as string) || 'AI request failed.' };
  }
  return data as Record<string, unknown>;
}

export type IdeaCoachResult = {
  title: string;
  milestones: string[];
  constellation_questions: string[];
  source?: string;
  error?: string;
};

export async function coachIdea(opts: {
  title?: string;
  description?: string;
  lang?: 'en' | 'ar';
}): Promise<IdeaCoachResult> {
  const data = await postJson('ideas/coach/', {
    title: opts.title || '',
    description: opts.description || '',
    lang: opts.lang || 'en',
  });
  if ('error' in data && data.error) return { title: '', milestones: [], constellation_questions: [], error: String(data.error) };
  return {
    title: String(data.title || ''),
    milestones: Array.isArray(data.milestones) ? data.milestones.map(String) : [],
    constellation_questions: Array.isArray(data.constellation_questions)
      ? data.constellation_questions.map(String)
      : [],
    source: data.source ? String(data.source) : undefined,
  };
}

export type RemixMeaningResult = {
  hook: string;
  caption: string;
  why_it_matters: string;
  source?: string;
  error?: string;
};

export async function remixMeaning(opts: {
  source_label?: string;
  source_text?: string;
  draft_caption?: string;
  lang?: 'en' | 'ar';
}): Promise<RemixMeaningResult> {
  const data = await postJson('reels/remix-meaning/', {
    source_label: opts.source_label || '',
    source_text: opts.source_text || '',
    draft_caption: opts.draft_caption || '',
    lang: opts.lang || 'en',
  });
  if ('error' in data && data.error) {
    return { hook: '', caption: '', why_it_matters: '', error: String(data.error) };
  }
  return {
    hook: String(data.hook || ''),
    caption: String(data.caption || ''),
    why_it_matters: String(data.why_it_matters || ''),
    source: data.source ? String(data.source) : undefined,
  };
}

export type TonePolishResult = {
  polished: string;
  note: string;
  source?: string;
  error?: string;
};

export async function polishVaultTone(opts: {
  text: string;
  kind: 'bottle' | 'capsule';
  lang?: 'en' | 'ar';
}): Promise<TonePolishResult> {
  const path = opts.kind === 'capsule' ? 'capsules/polish-tone/' : 'bottles/polish-tone/';
  const data = await postJson(path, {
    text: opts.text,
    lang: opts.lang || 'en',
  });
  if ('error' in data && data.error) {
    return { polished: opts.text, note: '', error: String(data.error) };
  }
  return {
    polished: String(data.polished || opts.text),
    note: String(data.note || ''),
    source: data.source ? String(data.source) : undefined,
  };
}

export async function liveHostAssist(sessionId: number, lang: 'en' | 'ar' = 'en') {
  const data = await postJson(`live/${sessionId}/host-assist/`, { lang });
  if ('error' in data && data.error) return { questions: [] as string[], error: String(data.error) };
  return {
    questions: Array.isArray(data.questions) ? data.questions.map(String) : [],
    source: data.source ? String(data.source) : undefined,
  };
}

export async function liveHostRecap(sessionId: number, lang: 'en' | 'ar' = 'en') {
  const data = await postJson(`live/${sessionId}/host-recap/`, { lang });
  if ('error' in data && data.error) return { summary: '', error: String(data.error) };
  return {
    summary: String(data.summary || ''),
    source: data.source ? String(data.source) : undefined,
  };
}
