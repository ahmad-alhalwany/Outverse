'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLocale } from '@/components/LocaleProvider';
import {
  deleteAccount,
  disable2fa,
  enable2fa,
  exportAccountData,
  fetch2faSetup,
  fetchVerificationStatus,
  submitVerificationRequest,
} from '@/lib/accountSecurityApi';
import { clearAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

type Palette = {
  card: string;
  cardStrong: string;
  icon: string;
  textMuted: string;
  text: string;
};

export default function AccountSecuritySettings({ palette }: { palette: Palette }) {
  const { t } = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const [twoFa, setTwoFa] = useState<{ secret: string; otpauth_uri: string; is_enabled: boolean } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [disable2faPassword, setDisable2faPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyReason, setVerifyReason] = useState('');
  const [verifyLink, setVerifyLink] = useState('');
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const [setup, vstatus] = await Promise.all([fetch2faSetup(), fetchVerificationStatus()]);
    if (setup) setTwoFa(setup);
    if (vstatus) setVerified(vstatus.badge_verified);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!twoFa || twoFa.is_enabled || !twoFa.otpauth_uri) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(twoFa.otpauth_uri, { margin: 1, width: 176 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [twoFa]);

  return (
    <div className="space-y-5 px-5 pb-4">
      <div className="rounded-2xl p-4" style={{ background: palette.card }}>
        <p className="text-sm font-semibold mb-2">{t('security.twoFactor')}</p>
        {twoFa?.is_enabled ? (
          <p className="text-xs mb-3" style={{ color: palette.textMuted }}>{t('security.twoFactorOn')}</p>
        ) : (
          <>
            <p className="text-xs mb-2" style={{ color: palette.textMuted }}>{t('security.twoFactorHint')}</p>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={t('security.twoFactorQrAlt')}
                width={176}
                height={176}
                className="mb-2 rounded-xl bg-white p-2"
              />
            )}
            {twoFa?.secret && (
              <>
                <p className="text-[10px] mb-1" style={{ color: palette.textMuted }}>
                  {t('security.twoFactorSecretHint')}
                </p>
                <p className="text-[10px] font-mono break-all mb-2" style={{ color: palette.textMuted }}>
                  {twoFa.secret}
                </p>
              </>
            )}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="w-full rounded-xl px-3 py-2 text-sm mb-2"
              style={{ background: palette.cardStrong, color: '#fff' }}
            />
            <button
              type="button"
              onClick={async () => {
                const res = await enable2fa(code);
                if (res?.backup_codes) {
                  setBackupCodes(res.backup_codes);
                  setStatus(t('security.twoFactorEnabled'));
                  void load();
                }
              }}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
              style={{ background: palette.cardStrong }}
            >
              {t('security.enable2fa')}
            </button>
          </>
        )}
        {twoFa?.is_enabled && (
          <div className="mt-3">
            <input
              type="password"
              value={disable2faPassword}
              onChange={(e) => setDisable2faPassword(e.target.value)}
              placeholder={t('security.passwordConfirm')}
              className="w-full rounded-xl px-3 py-2 text-sm mb-2"
            />
            <button
              type="button"
              onClick={async () => {
                if (await disable2fa(disable2faPassword)) {
                  setStatus(t('security.twoFactorOff'));
                  setDisable2faPassword('');
                  void load();
                }
              }}
              className="text-xs font-semibold"
              style={{ color: palette.icon }}
            >
              {t('security.disable2fa')}
            </button>
          </div>
        )}
        {backupCodes.length > 0 && (
          <div className="mt-3 text-[10px] font-mono" style={{ color: palette.textMuted }}>
            {t('security.backupCodes')}: {backupCodes.join(', ')}
          </div>
        )}
      </div>

      {!verified && (
        <div className="rounded-2xl p-4" style={{ background: palette.card }}>
          <p className="text-sm font-semibold mb-2">{t('security.verification')}</p>
          <textarea
            value={verifyReason}
            onChange={(e) => setVerifyReason(e.target.value)}
            rows={3}
            placeholder={t('security.verificationReason')}
            className="w-full rounded-xl px-3 py-2 text-sm mb-2"
          />
          <input
            value={verifyLink}
            onChange={(e) => setVerifyLink(e.target.value)}
            placeholder={t('security.verificationLink')}
            className="w-full rounded-xl px-3 py-2 text-sm mb-2"
          />
          <button
            type="button"
            onClick={async () => {
              const ok = await submitVerificationRequest(verifyReason, verifyLink ? [verifyLink] : []);
              setStatus(ok ? t('security.verificationSent') : t('security.verificationError'));
            }}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
            style={{ background: palette.cardStrong }}
          >
            {t('security.requestVerification')}
          </button>
        </div>
      )}

      <div className="rounded-2xl p-4" style={{ background: palette.card }}>
        <p className="text-sm font-semibold mb-2">{t('security.dataExport')}</p>
        <button
          type="button"
          onClick={async () => {
            const data = await exportAccountData();
            if (!data) return;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cosmory-export.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
          style={{ background: palette.cardStrong }}
        >
          {t('security.downloadData')}
        </button>
      </div>

      <div className="rounded-2xl p-4 border border-red-300/30" style={{ background: palette.card }}>
        <p className="text-sm font-semibold mb-2 text-red-400">{t('security.deleteAccount')}</p>
        <input
          type="password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          placeholder={t('security.passwordConfirm')}
          className="w-full rounded-xl px-3 py-2 text-sm mb-2"
        />
        <button
          type="button"
          onClick={async () => {
            if (!(await confirm(t('security.deleteConfirm'), { danger: true, confirmLabel: t('common.delete') }))) return;
            if (await deleteAccount(deletePassword)) {
              clearAuth();
              router.push('/');
            }
          }}
          className="rounded-xl px-4 py-2 text-xs font-semibold bg-red-600 text-white"
        >
          {t('security.deleteAccount')}
        </button>
      </div>

      {status && (
        <p className="text-xs" style={{ color: palette.textMuted }}>{status}</p>
      )}
    </div>
  );
}
