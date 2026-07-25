'use client';

import { useLocale } from '@/components/LocaleProvider';

export default function SkipToMain() {
  const { t } = useLocale();

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg focus:outline focus:outline-2 focus:outline-vault"
    >
      {t('common.skipToMain')}
    </a>
  );
}
