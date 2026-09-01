export type ForgeUser = {
  id?: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
};

export type ForgeSegment = {
  id: number;
  content: string;
  order: number;
  status?: 'pending' | 'approved' | 'rejected';
  author: ForgeUser | null;
  dialogues_count?: number;
  dialogues?: ForgeDialogue[];
  created_at?: string;
};

export type ForgeDialogue = {
  id: number;
  text: string;
  author: ForgeUser | null;
  parent?: number | null;
  replies?: ForgeDialogue[];
  created_at: string;
};

export type ForgeCollaborator = {
  id: number;
  user: ForgeUser;
  role: 'writer' | 'editor' | 'narrator';
  status: 'invited' | 'requested' | 'accepted' | 'removed';
};

export type ForgeOutlineBeat = {
  act?: number;
  title?: string;
  beats?: string[];
};

export type ForgeCharacter = {
  name?: string;
  role?: string;
  traits?: string[];
  voice?: string;
  notes?: string;
  emoji?: string;
  source_character_id?: number;
};

export type ForgeStory = {
  id: number;
  title: string;
  premise: string;
  cover_url?: string;
  cover_prompt?: string;
  genre: string;
  genre_display?: string;
  status: string;
  visibility?: 'public' | 'invite_only';
  studio_mode?: 'solo' | 'collab';
  require_approval?: boolean;
  tone?: string;
  pov?: string;
  content_rules?: string;
  outline?: ForgeOutlineBeat[];
  characters?: ForgeCharacter[];
  world_notes?: string;
  writing_goal?: number | null;
  max_segments: number;
  target_words?: number | null;
  is_featured?: boolean;
  owner: ForgeUser | null;
  owner_id?: number;
  segment_count: number;
  approved_segment_count?: number;
  pending_segment_count?: number;
  contributors_count: number;
  word_count?: number;
  can_contribute?: boolean;
  can_edit_bible?: boolean;
  can_approve?: boolean;
  can_revise?: boolean;
  is_owner?: boolean;
  is_studio_member?: boolean;
  can_request_join?: boolean;
  my_collab_status?: 'owner' | 'invited' | 'requested' | 'accepted' | 'removed' | null;
  my_role?: string | null;
  is_saved?: boolean;
  segments?: ForgeSegment[];
  pending_segments?: ForgeSegment[];
  collaborators?: ForgeCollaborator[];
  cover_preview?: string;
};

export const FORGE_GENRES = [
  { key: 'all', labelKey: 'forge.genreAll' },
  { key: 'fantasy', labelKey: 'forge.genreFantasy' },
  { key: 'scifi', labelKey: 'forge.genreScifi' },
  { key: 'mystery', labelKey: 'forge.genreMystery' },
  { key: 'romance', labelKey: 'forge.genreRomance' },
  { key: 'horror', labelKey: 'forge.genreHorror' },
  { key: 'adventure', labelKey: 'forge.genreAdventure' },
  { key: 'absurd', labelKey: 'forge.genreAbsurd' },
] as const;

export const FORGE_TABS = [
  { key: 'trending', labelKey: 'forge.tabTrending' },
  { key: 'new', labelKey: 'forge.tabNew' },
  { key: 'completed', labelKey: 'forge.tabCompleted' },
  { key: 'my', labelKey: 'forge.tabMy' },
] as const;

export function displayForgeOwner(owner?: ForgeUser | null) {
  if (!owner) return 'Anonymous';
  const full = `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
  return full || owner.username || 'Anonymous';
}

export function forgeProgress(story: Pick<ForgeStory, 'segment_count' | 'approved_segment_count' | 'max_segments'>) {
  const n = story.approved_segment_count ?? story.segment_count ?? 0;
  const max = Math.max(1, story.max_segments || 12);
  return Math.min(100, Math.round((n / max) * 100));
}

export function asForgeStories(data: unknown): ForgeStory[] {
  if (Array.isArray(data)) return data as ForgeStory[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: ForgeStory[] }).results)) {
    return (data as { results: ForgeStory[] }).results;
  }
  return [];
}

export function formatCharacterForDraft(ch: ForgeCharacter) {
  return [
    ch.name ? `✦ ${ch.name}` : '✦ New character',
    ch.role ? `Role: ${ch.role}` : '',
    ch.voice ? `Voice: ${ch.voice}` : '',
    ...(ch.traits || []).map((t) => `• ${t}`),
    ch.notes ? `Notes: ${ch.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function useForgePalette(isDark: boolean) {
  if (isDark) {
    return {
      cream: '#14102A',
      card: '#1E1740',
      card2: '#251B4D',
      white: '#2A2154',
      brown: '#C4B5FD',
      brownDk: '#A78BFA',
      text: '#F5F3FF',
      text2: '#B0A6D9',
      line: 'rgba(167,139,250,0.22)',
      progressBg: 'rgba(255,255,255,0.08)',
      fundedBg: 'rgba(74,222,128,0.15)',
      fundedText: '#4ade80',
      coverFrom: '#251B4D',
      coverTo: '#3A2A6B',
    };
  }
  return {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    progressBg: 'rgba(0,0,0,0.06)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
    coverFrom: '#E9E1FA',
    coverTo: '#DCC9FA',
  };
}

export function formatOutlineForDraft(outline: ForgeOutlineBeat[]) {
  return outline
    .map((act, i) => {
      const head = `## Act ${act.act ?? i + 1}: ${act.title || 'Untitled'}`;
      const beats = (act.beats || []).map((b) => `- ${b}`).join('\n');
      return beats ? `${head}\n${beats}` : head;
    })
    .join('\n\n');
}
