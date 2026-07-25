'use client';

import { useState } from 'react';
import {
  NoSymbolIcon,
  SpeakerXMarkIcon,
  EyeSlashIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';
import { useLocale } from '@/components/LocaleProvider';
import {
  reportUser,
  setSocialAction,
  type SocialAction,
  type SocialStatus,
} from '@/lib/socialApi';

type Props = {
  userId: number;
  username: string;
  social?: SocialStatus;
  onUpdate?: (social: SocialStatus) => void;
  onBlocked?: () => void;
  palette?: { card: string; text: string; text2: string; line: string };
};

const REPORT_REASONS = [
  { value: 'spam', labelKey: 'social.reportReasonSpam' },
  { value: 'harassment', labelKey: 'social.reportReasonHarassment' },
  { value: 'impersonation', labelKey: 'social.reportReasonImpersonation' },
  { value: 'hate', labelKey: 'social.reportReasonHate' },
  { value: 'other', labelKey: 'social.reportReasonOther' },
] as const;

export default function ProfileSocialMenu({
  userId,
  username,
  social,
  onUpdate,
  onBlocked,
  palette,
}: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]['value']>('spam');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState('');

  const run = async (action: SocialAction, undo = false) => {
    setBusy(true);
    try {
      const res = await setSocialAction(userId, action, undo);
      if (res?.social) {
        onUpdate?.(res.social);
        if (action === 'block' && !undo) onBlocked?.();
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const submitReport = async () => {
    setBusy(true);
    try {
      const ok = await reportUser(userId, reason, details.trim());
      setStatus(ok ? t('social.reportSent') : '');
    } finally {
      setBusy(false);
      setReporting(false);
      setOpen(false);
      setDetails('');
      setReason('spam');
    }
  };

  const cardBg = palette?.card ?? 'var(--surface, #251B4D)';
  const text = palette?.text ?? 'inherit';
  const text2 = palette?.text2 ?? '#B0A6D9';
  const line = palette?.line ?? 'rgba(255,255,255,0.08)';

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-3 py-2 text-xs font-semibold transition"
        style={{ background: cardBg, color: text, border: `1px solid ${line}` }}
      >
        ···
      </button>
      {open && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setOpen(false);
            setReporting(false);
          }}
        />
      )}
      {open && !reporting && (
        <div
          className="absolute right-0 top-10 z-30 min-w-[180px] overflow-hidden rounded-xl shadow-xl"
          style={{ background: cardBg, border: `1px solid ${line}` }}
        >
          <MenuBtn
            icon={NoSymbolIcon}
            label={social?.is_blocked ? t('social.unblock') : t('social.block')}
            onClick={() => run('block', !!social?.is_blocked)}
            color={text}
          />
          <MenuBtn
            icon={SpeakerXMarkIcon}
            label={social?.is_muted ? t('social.unmute') : t('social.mute')}
            onClick={() => run('mute', !!social?.is_muted)}
            color={text}
          />
          <MenuBtn
            icon={EyeSlashIcon}
            label={social?.is_restricted ? t('social.unrestrict') : t('social.restrict')}
            onClick={() => run('restrict', !!social?.is_restricted)}
            color={text}
          />
          <MenuBtn
            icon={FlagIcon}
            label={t('social.report')}
            onClick={() => setReporting(true)}
            color={text2}
          />
        </div>
      )}
      {open && reporting && (
        <div
          className="absolute right-0 top-10 z-30 w-64 overflow-hidden rounded-xl p-3 shadow-xl"
          style={{ background: cardBg, border: `1px solid ${line}` }}
        >
          <p className="mb-2 text-sm font-semibold" style={{ color: text }}>
            {t('social.reportWhy', { username })}
          </p>
          <div className="mb-2 space-y-1">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                style={{ color: text }}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {t(r.labelKey)}
              </label>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t('social.reportDetailsPlaceholder')}
            className="mb-2 w-full rounded-lg px-2 py-1.5 text-sm"
            style={{ background: 'rgba(255,255,255,0.06)', color: text, border: `1px solid ${line}` }}
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ color: text2 }}
            >
              {t('social.reportCancel')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitReport()}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
            >
              {t('social.reportSubmit')}
            </button>
          </div>
        </div>
      )}
      {status && (
        <p className="absolute right-0 top-10 z-20 text-xs" style={{ color: text2 }}>
          {status}
        </p>
      )}
    </div>
  );
}

function MenuBtn({
  icon: Icon,
  label,
  onClick,
  color,
}: {
  icon: typeof FlagIcon;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:opacity-80"
      style={{ color }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
