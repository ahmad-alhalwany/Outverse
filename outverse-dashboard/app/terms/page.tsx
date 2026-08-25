'use client';

import LegalLayout from '@/components/legal/LegalLayout';
import { useLocale } from '@/components/LocaleProvider';

export default function TermsPage() {
  const { t, locale } = useLocale();
  const updated = locale === 'ar' ? '25 أغسطس 2026' : 'August 25, 2026';

  return (
    <LegalLayout
      title={t('legal.termsTitle')}
      updatedLabel={t('legal.termsUpdated')}
      updatedDate={updated}
      backLabel={t('legal.backHome')}
      related={[{ href: '/privacy', label: t('legal.privacyTitle') }]}
      sections={[
        {
          id: 'intro',
          title: t('legal.sections.intro'),
          body: <p>{t('legal.termsIntro')}</p>,
        },
        {
          id: 'acceptance',
          title: t('legal.sections.acceptance'),
          body: <p>{t('legal.termsAcceptance')}</p>,
        },
        {
          id: 'accounts',
          title: t('legal.sections.accounts'),
          body: <p>{t('legal.termsAccounts')}</p>,
        },
        {
          id: 'conduct',
          title: t('legal.sections.conduct'),
          body: <p>{t('legal.termsConduct')}</p>,
        },
        {
          id: 'content',
          title: t('legal.sections.content'),
          body: <p>{t('legal.termsContent')}</p>,
        },
        {
          id: 'copyright',
          title: t('legal.sections.copyright'),
          body: <p>{t('legal.termsCopyright')}</p>,
        },
        {
          id: 'termination',
          title: t('legal.sections.termination'),
          body: <p>{t('legal.termsTermination')}</p>,
        },
        {
          id: 'disclaimer',
          title: t('legal.sections.disclaimer'),
          body: <p>{t('legal.termsDisclaimer')}</p>,
        },
        {
          id: 'liability',
          title: t('legal.sections.liability'),
          body: <p>{t('legal.termsLiability')}</p>,
        },
        {
          id: 'governing-law',
          title: t('legal.sections.governingLaw'),
          body: <p>{t('legal.termsGoverningLaw')}</p>,
        },
        {
          id: 'changes',
          title: t('legal.sections.changes'),
          body: <p>{t('legal.termsChanges')}</p>,
        },
      ]}
    />
  );
}
