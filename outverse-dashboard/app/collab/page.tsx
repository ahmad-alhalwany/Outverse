'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { PlusIcon, CalendarIcon } from '@heroicons/react/24/outline';

const PALETTES = {
  light: {
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
  },
  dark: {
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
  },
} as const;

type Member = { id: number; user: { id: number; username: string; avatar: string | null }; role: string; current_task: string };
type Task = { id: number; title: string; status: string; assignee: { id: number; username: string } | null };
type Project = {
  id: number;
  title: string;
  description: string;
  status: string;
  owner: { id: number; username: string };
  deadline: string | null;
  members: Member[];
  tasks: Task[];
  tasks_completed: number;
  tasks_total: number;
};

const STATUS_COLUMNS = ['todo', 'in_progress', 'done'] as const;
const STATUS_LABEL_KEY: Record<(typeof STATUS_COLUMNS)[number], string> = {
  todo: 'collab.statusTodo',
  in_progress: 'collab.statusInProgress',
  done: 'collab.statusDone',
};

export default function CollabHubPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const me = useAuthUser();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('collab/projects/');
      if (res.ok) {
        const data = await res.json();
        const rows: Project[] = Array.isArray(data) ? data : data.results || [];
        setProjects(rows);
        const projectParam = searchParams.get('project');
        const preferredId = projectParam ? Number.parseInt(projectParam, 10) : NaN;
        const preferred = Number.isFinite(preferredId)
          ? rows.find((p) => p.id === preferredId)
          : null;
        setSelected((prev) => preferred || rows.find((p) => p.id === prev?.id) || rows[0] || null);
      }
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProject() {
    if (!title.trim()) return;
    const res = await apiFetchJson('collab/projects/', {
      method: 'POST',
      json: { title: title.trim(), description: description.trim() },
    });
    if (res.ok) {
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      void load();
    }
  }

  async function addTask(taskTitle: string) {
    if (!selected || !taskTitle.trim()) return;
    const res = await apiFetchJson(`collab/projects/${selected.id}/tasks/`, {
      method: 'POST',
      json: { title: taskTitle.trim() },
    });
    if (res.ok) void load();
  }

  async function moveTask(taskId: number, status: string) {
    if (!selected) return;
    const res = await apiFetchJson(`collab/projects/${selected.id}/update-task/`, {
      method: 'POST',
      json: { task_id: taskId, status },
    });
    if (res.ok) void load();
  }

  if (!me) {
    return (
      <WorldShell colors={C}>
        <div className="rounded-2xl p-10 text-center mt-10" style={{ background: C.card2, color: C.text2 }}>
          {t('collab.signInPrompt')}
        </div>
      </WorldShell>
    );
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-6xl mx-auto pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>{t('collab.title')}</h1>
            <p className="text-sm" style={{ color: C.text2 }}>{t('collab.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white"
            style={{ background: C.brownDk }}
          >
            <PlusIcon className="h-4 w-4" />
            {t('collab.newProject')}
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
            {t('collab.empty')}
          </div>
        ) : (
          <div className="grid lg:grid-cols-[220px_1fr] gap-6">
            <div className="flex lg:flex-col gap-2 overflow-x-auto">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelected(project)}
                  className="text-left rounded-xl px-3 py-2.5 shrink-0 lg:shrink"
                  style={{
                    background: selected?.id === project.id ? C.brown : C.white,
                    color: selected?.id === project.id ? '#fff' : C.text,
                    border: `1px solid ${C.line}`,
                  }}
                >
                  <p className="text-sm font-semibold truncate">{project.title}</p>
                  <p className="text-xs opacity-80">{project.tasks_completed}/{project.tasks_total} {t('collab.tasksDone')}</p>
                </button>
              ))}
            </div>

            {selected && (
              <div>
                <div className="grid sm:grid-cols-3 gap-3 mb-6">
                  <div className="rounded-2xl p-4 text-center" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                    <div className="text-xl font-bold" style={{ color: C.brown }}>{selected.tasks_completed}/{selected.tasks_total}</div>
                    <div className="text-xs mt-1" style={{ color: C.text2 }}>{t('collab.tasksCompleted')}</div>
                  </div>
                  <div className="rounded-2xl p-4 text-center" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                    <div className="text-xl font-bold" style={{ color: C.brown }}>{selected.members.length}</div>
                    <div className="text-xs mt-1" style={{ color: C.text2 }}>{t('collab.teamMembers')}</div>
                  </div>
                  <div className="rounded-2xl p-4 text-center flex flex-col items-center justify-center" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                    <CalendarIcon className="h-5 w-5 mb-1" style={{ color: C.brown }} />
                    <div className="text-xs" style={{ color: C.text2 }}>
                      {selected.deadline || t('collab.noDeadline')}
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-3" style={{ color: C.text }}>{t('collab.teamMembers')}</h2>
                  <div className="flex flex-wrap gap-3">
                    {selected.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                        {member.user.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(member.user.avatar)} alt={member.user.username} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: C.brown }}>
                            {member.user.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: C.text }}>@{member.user.username}</p>
                          <p className="text-xs truncate" style={{ color: C.text2 }}>{member.role || t('collab.contributor')}{member.current_task ? ` · ${member.current_task}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold" style={{ color: C.text }}>{t('collab.tasks')}</h2>
                    {selected.owner.id === me.id && (
                      <TaskAddForm onAdd={addTask} C={C} label={t('collab.addTask')} />
                    )}
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {STATUS_COLUMNS.map((columnStatus) => (
                      <div key={columnStatus} className="rounded-2xl p-3" style={{ background: C.card2 }}>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.text2 }}>
                          {t(STATUS_LABEL_KEY[columnStatus])}
                        </p>
                        <div className="space-y-2">
                          {selected.tasks.filter((task) => task.status === columnStatus).map((task) => (
                            <div key={task.id} className="rounded-xl p-3" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                              <p className="text-sm font-medium" style={{ color: C.text }}>{task.title}</p>
                              {task.assignee && (
                                <p className="text-xs mt-1" style={{ color: C.text2 }}>@{task.assignee.username}</p>
                              )}
                              <div className="flex gap-1 mt-2">
                                {STATUS_COLUMNS.filter((s) => s !== columnStatus).map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => void moveTask(task.id, s)}
                                    className="text-[10px] px-2 py-1 rounded-full font-semibold"
                                    style={{ background: C.card2, color: C.brownDk }}
                                  >
                                    → {t(STATUS_LABEL_KEY[s])}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: C.overlay }} onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: C.cream, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>{t('collab.newProject')}</h2>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('collab.projectTitle')}
              className="w-full rounded-xl px-4 py-3 mb-3 outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('collab.projectDescription')}
              rows={3}
              className="w-full rounded-xl px-4 py-3 mb-4 outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 rounded-xl py-3 text-sm font-semibold" style={{ background: C.card2, color: C.text }}>
                {t('common.cancel')}
              </button>
              <button type="button" onClick={() => void createProject()} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white" style={{ background: C.brownDk }}>
                {t('collab.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </WorldShell>
  );
}

function TaskAddForm({ onAdd, C, label }: { onAdd: (title: string) => void; C: (typeof PALETTES)[keyof typeof PALETTES]; label: string }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={label}
        className="rounded-xl px-3 py-1.5 text-sm outline-none"
        style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
      />
      <button
        type="button"
        onClick={() => {
          onAdd(value);
          setValue('');
        }}
        className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: C.brownDk }}
      >
        +
      </button>
    </div>
  );
}
