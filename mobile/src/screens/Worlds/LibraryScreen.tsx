import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen, openMaybeUrl } from './WorldScreenKit';

export default function LibraryScreen() {
  return (
    <WorldListScreen
      title="Library"
      subtitle="Resources"
      tone="vault"
      heroTitle="Saved knowledge and resources"
      heroBody="Browse resources and open downloads returned by the backend."
      load={() => api.getResources()}
      emptyText="No resources yet"
      actions={[
        {
          label: 'Download',
          run: async (row) => {
            const result = await api.downloadResource(row.id);
            await openMaybeUrl(result?.download_url || result?.url || row.download_url || row.file);
          },
        },
      ]}
    />
  );
}
