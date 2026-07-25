import { apiFetch, apiFetchJson } from './api';
import type { BazaarIdeaUser } from './bazaarTypes';

export type IdeaConstellationQuestion = {
  id: number | null;
  text: string;
  category?: string;
  placeholder?: boolean;
};

export type IdeaConstellation = {
  idea_id: number;
  keywords: string[];
  questions: IdeaConstellationQuestion[];
  challenge_hint: { id: number; title: string; type: string } | null;
  deep_links: {
    lab: string;
    bottle_create: string;
    capsule_create: string;
  };
};

export type IdeaCrew = {
  collab_project_id: number | null;
  members: (BazaarIdeaUser & { role?: string })[];
  milestones: { id: string; title: string; done: boolean; due_date?: string | null }[];
  tasks: { id: number; title: string; status: string; assignee_id: number | null }[];
  pledges: { count: number; total_amount: number; anonymous_count: number };
  chat_room_id: number | null;
  collab_url: string | null;
};

export type RelayUser = {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  overlap: string[];
};

export type WorldPassport = {
  stamps: {
    lab_streak: number;
    bottles_caught: number;
    ideas_launched: number;
    capsules_opened: number;
    communities_joined: number;
    lives_hosted?: number;
  };
  worlds: { world: string; key: string; count: number; label: string }[];
};

export async function fetchIdeaConstellation(ideaId: number): Promise<IdeaConstellation | null> {
  try {
    const res = await apiFetch(`ideas/${ideaId}/constellation/`);
    if (!res.ok) return null;
    return (await res.json()) as IdeaConstellation;
  } catch {
    return null;
  }
}

export async function fetchIdeaCrew(ideaId: number): Promise<IdeaCrew | null> {
  try {
    const res = await apiFetch(`ideas/${ideaId}/crew/`);
    if (!res.ok) return null;
    return (await res.json()) as IdeaCrew;
  } catch {
    return null;
  }
}

export async function relayQuestion(questionId: number): Promise<RelayUser[]> {
  try {
    const res = await apiFetchJson(`questions/${questionId}/relay/`, { method: 'POST' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

export async function fetchWorldPassports(): Promise<WorldPassport | null> {
  try {
    const res = await apiFetch('users/me/passports/');
    if (!res.ok) return null;
    return (await res.json()) as WorldPassport;
  } catch {
    return null;
  }
}
