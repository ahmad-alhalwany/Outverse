'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import {
  fetchMyAppeals,
  submitContentAppeal,
  type ContentAppeal,
} from '@/lib/moderationAppealsApi';

type Palette = {
  card: string;
  cardStrong: string;
  icon: string;
  textMuted: string;
  text: string;
};

export default function ContentAppealsSettings({ palette }: { palette: Palette }) {
  const { t } = useLocale();
  const [appeals, setAppeals] = useState<ContentAppeal[]>([]);
  const [contentType, setContentType] = useState('post');
  const [objectId, setObjectId] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setAppeals(await fetchMyAppeals());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl p-4" style={{ background: palette.card }}>
      <p className="text-sm font-semibold mb-1">{t('security.appealsTitle')}</p>
      <p className="text-xs mb-3" style={{ color: palette.textMuted }}>
        {t('security.appealsHint')}
      </p>

      <div className="grid gap-2 mb-3 sm:grid-cols-2">
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm"
          style={{ background: palette.cardStrong, color: '#fff' }}
        >
          <option value="post">{t('security.appealTypePost')}</option>
          <option value="comment">{t('security.appealTypeComment')}</option>
          <option value="reel">{t('security.appealTypeReel')}</option>
          <option value="reel_comment">{t('security.appealTypeReelComment')}</option>
          <option value="story">{t('security.appealTypeStory')}</option>
        </select>
        <input
          value={objectId}
          onChange={(e) => setObjectId(e.target.value)}
          placeholder={t('security.appealObjectId')}
          className="rounded-xl px-3 py-2 text-sm"
          style={{ background: palette.cardStrong, color: '#fff' }}
        />
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder={t('security.appealReason')}
        className="w-full rounded-xl px-3 py-2 text-sm mb-2"
        style={{ background: palette.cardStrong, color: '#fff' }}
      />

      <button
        type="button"
        onClick={async () => {
          const id = Number(objectId);
          if (!id || reason.trim().length < 10) {
            setStatus(t('security.appealError'));
            return;
          }
          const created = await submitContentAppeal({
            content_type: contentType,
            object_id: id,
            reason: reason.trim(),
          });
          if (!created) {
            setStatus(t('security.appealError'));
            return;
          }
          setReason('');
          setObjectId('');
          setStatus(t('security.appealSubmitted'));
          void load();
        }}
        className="rounded-xl px-4 py-2 text-xs font-semibold text-white mb-4"
        style={{ background: palette.cardStrong }}
      >
        {t('security.appealSubmit')}
      </button>

      <div className="space-y-2">
        <p className="text-xs font-semibold" style={{ color: palette.text }}>
          {t('security.appealsMine')}
        </p>
        {appeals.length === 0 ? (
          <p className="text-xs" style={{ color: palette.textMuted }}>
            {t('security.appealsEmpty')}
          </p>
        ) : (
          appeals.map((appeal) => (
            <div
              key={appeal.id}
              className="rounded-xl px-3 py-2 text-xs"
              style={{ background: palette.cardStrong, color: palette.textMuted }}
            >
              <p className="font-semibold" style={{ color: palette.text }}>
                #{appeal.id} · {appeal.content_type}:{appeal.object_id} · {appeal.status}
              </p>
              <p className="mt-1">{appeal.reason}</p>
              {appeal.staff_note ? (
                <p className="mt-1 italic">{t('security.appealStaffNote')}: {appeal.staff_note}</p>
              ) : null}
            </div>
          ))
        )}
      </div>

      {status ? (
        <p className="text-xs mt-3" style={{ color: palette.textMuted }}>{status}</p>
      ) : null}
    </div>
  );
}
