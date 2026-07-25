'use client';

import { useCallback, useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetchJson, apiUrl } from '@/lib/api';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

const BASE = apiUrl('resources');

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
  },
} as const;

type Resource = {
  id: number;
  title: string;
  description: string;
  type: string;
  type_display: string;
  mood: string;
  mood_display: string;
  file_url: string;
  file_size_label: string;
  download_count: number;
};

const TABS = ['all', 'template', 'toolkit', 'tutorial'] as const;
const TAB_ICON: Record<string, typeof DocumentTextIcon> = {
  template: DocumentTextIcon,
  toolkit: WrenchScrewdriverIcon,
  tutorial: AcademicCapIcon,
};
const TAB_LABEL_KEY: Record<(typeof TABS)[number], string> = {
  all: 'library.tabAll',
  template: 'library.tabTemplate',
  toolkit: 'library.tabToolkit',
  tutorial: 'library.tabTutorial',
};

export default function ResourceLibraryPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const [resources, setResources] = useState<Resource[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('type', tab);
      if (search) params.set('search', search);
      const res = await fetch(`${BASE}/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResources(Array.isArray(data) ? data : data.results || []);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(resource: Resource) {
    try {
      const res = await apiFetchJson(`resources/${resource.id}/download/`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setResources((prev) => prev.map((r) => (r.id === resource.id ? updated : r)));
      }
    } finally {
      if (resource.file_url) window.open(resource.file_url, '_blank');
    }
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-5xl mx-auto pt-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: C.brown }}>
          {t('library.title')}
        </h1>
        <p className="text-sm mb-6" style={{ color: C.text2 }}>{t('library.subtitle')}</p>

        <div className="relative max-w-md mb-4">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.text2 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('library.search')}
            className="w-full rounded-full pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
              style={{
                background: tab === key ? C.brown : C.white,
                color: tab === key ? '#fff' : C.text2,
                border: `1px solid ${tab === key ? C.brown : C.line}`,
              }}
            >
              {t(TAB_LABEL_KEY[key])}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : resources.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
            {t('library.empty')}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((resource) => {
              const Icon = TAB_ICON[resource.type] || DocumentTextIcon;
              return (
                <div
                  key={resource.id}
                  className="rounded-2xl p-4 flex flex-col"
                  style={{ background: C.white, border: `1px solid ${C.line}` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5" style={{ color: C.brown }} />
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: C.card2, color: C.brownDk }}>
                      {resource.type_display}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1" style={{ color: C.text }}>{resource.title}</h3>
                  <p className="text-sm mb-3 flex-1 line-clamp-3" style={{ color: C.text2 }}>{resource.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: C.text2 }}>
                      {resource.file_size_label} · {resource.download_count} {t('library.downloads')}
                    </span>
                    <button
                      type="button"
                      onClick={() => void download(resource)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                      style={{ background: C.brownDk }}
                    >
                      <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                      {t('library.download')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WorldShell>
  );
}
