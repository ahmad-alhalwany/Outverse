import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function CollabScreen() {
  return (
    <WorldListScreen
      title="Collab"
      subtitle="Projects"
      tone="bazaar"
      heroTitle="Collaborative projects"
      heroBody="Track projects and toggle the first available task on mobile."
      load={() => api.getCollabProjects()}
      emptyText="No collab projects yet"
      rowMeta={(row) => {
        const tasks = Array.isArray(row.tasks) ? row.tasks : [];
        return `${tasks.length} tasks${row.status ? ` · ${row.status}` : ''}`;
      }}
      actions={[
        {
          label: 'Toggle task',
          run: (row) => {
            const task = Array.isArray(row.tasks) ? row.tasks[0] : null;
            return api.toggleCollabTask(row.id, task?.id || row.task_id);
          },
        },
      ]}
    />
  );
}
