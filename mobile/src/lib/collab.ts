export type CollabPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  overlay: string;
};

export type CollabUser = {
  id: number;
  username: string;
  avatar?: string | null;
};

export type CollabMember = {
  id: number;
  user: CollabUser;
  role: string;
  current_task: string;
};

export type CollabTask = {
  id: number;
  title: string;
  status: string;
  assignee: CollabUser | null;
};

export type CollabProject = {
  id: number;
  title: string;
  description: string;
  status: string;
  owner: CollabUser;
  deadline: string | null;
  members: CollabMember[];
  tasks: CollabTask[];
  tasks_completed: number;
  tasks_total: number;
};

export const COLLAB_COLUMNS = ['todo', 'in_progress', 'done'] as const;
export const COLLAB_STATUS_KEY: Record<(typeof COLLAB_COLUMNS)[number], string> = {
  todo: 'collab.statusTodo',
  in_progress: 'collab.statusInProgress',
  done: 'collab.statusDone',
};

export function useCollabPalette(isDark: boolean): CollabPalette {
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
      line: 'rgba(167,139,250,0.20)',
      overlay: 'rgba(10,8,24,0.65)',
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
    overlay: 'rgba(33,27,61,0.45)',
  };
}

export function asCollabProjects(data: unknown): CollabProject[] {
  if (Array.isArray(data)) return data as CollabProject[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: CollabProject[] }).results)) {
    return (data as { results: CollabProject[] }).results;
  }
  return [];
}

export function formatCollabDeadline(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
