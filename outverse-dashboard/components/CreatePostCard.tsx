"use client"

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CameraIcon,
  ClockIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  SparklesIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  StopCircleIcon,
  XMarkIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
  PlusIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import { isAuthenticated } from '@/lib/auth';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { useLocale } from '@/components/LocaleProvider';
import InspirationPicker from '@/components/posts/InspirationPicker';
import type { InspirationQuestion } from '@/lib/questionsApi';
import { createDraft, deleteDraft, updateDraft, fetchDrafts, type PostDraft } from '@/lib/draftsApi';
import { deepenDraft } from '@/lib/deepenApi';
import { ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';
import { fetchMyTiers, type CreatorTier } from '@/lib/creatorSubscriptionsApi';
import { addScheduledMedia, createScheduledPost } from '@/lib/scheduledPostsApi';
import ScheduledPostsPanel from '@/components/posts/ScheduledPostsPanel';

const popularTags = [
  '#CreativeChallenge', '#DailyInspiration', '#ArtisticJourney', '#CreativeCommunity',
  '#DigitalArt', '#Inspiration', '#ArtisticExpression', '#CreativeFlow',
];

const moods = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '🎨', label: 'Artistic' },
  { emoji: '💡', label: 'Inspired' },
  { emoji: '🎉', label: 'Energetic' },
  { emoji: '✨', label: 'Spark' },
  { emoji: '🌈', label: 'Colorful' },
  { emoji: '💪', label: 'Empowered' },
  { emoji: '🚀', label: 'Ambitious' },
];

const MAX_POLL_OPTIONS = 8;

export default function CreatePostCard({ onPublished }: { onPublished?: () => void }) {
  const [text, setText] = useState('');
  const [postType, setPostType] = useState<'normal' | 'poll' | 'question'>('normal');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [threadParts, setThreadParts] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'subscribers'>('public');
  const [requiredTierId, setRequiredTierId] = useState<number | null>(null);
  const [myTiers, setMyTiers] = useState<CreatorTier[]>([]);
  const [replyControl, setReplyControl] = useState<'everyone' | 'followers' | 'nobody'>('everyone');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [inspirationQuestionId, setInspirationQuestionId] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [published, setPublished] = useState(false);
  const [scheduledPanelOpen, setScheduledPanelOpen] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftIdRef = useRef<number | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [buddyPrompt, setBuddyPrompt] = useState<string | null>(null);
  const [buddyLoading, setBuddyLoading] = useState(false);
  const [buddyError, setBuddyError] = useState('');

  const user = useAuthUser();
  const { t, locale } = useLocale();
  const avatar = user?.avatar ? mediaUrl(user.avatar) : null;
  const displayName = user?.first_name || user?.username || 'You';
  const visibleTags = useMemo(() => popularTags.slice(0, 6), []);
  const visibleMoods = useMemo(() => moods.slice(0, 5), []);

  const handleTagClick = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const handleUseInspiration = (q: InspirationQuestion) => {
    setInspirationQuestionId(q.id);
    setText((prev) => {
      const prefix = prev.trim() ? `${prev.trim()}\n\n` : '';
      return `${prefix}${q.text}\n\n`;
    });
  };

  // Ritual prefill: when the user clicks "Answer this" on the daily ritual panel,
  // the prompt is stashed in sessionStorage and we pre-load it here.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pendingInspiration');
      if (!raw) return;
      const parsed = JSON.parse(raw) as InspirationQuestion;
      sessionStorage.removeItem('pendingInspiration');
      setInspirationQuestionId(parsed.id);
      setText((prev) => {
        const prefix = prev.trim() ? `${prev.trim()}\n\n` : '';
        return `${prefix}${parsed.text}\n\n`;
      });
      // Smooth-scroll the card into view so the user sees the prefilled text.
      document.getElementById('create-post')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      /* ignore */
    }
  }, []);

  // Load the poster's own creator tiers (if any) so they can gate this post
  // behind "subscribers only" / a specific tier.
  useEffect(() => {
    if (!isAuthenticated()) return;
    void fetchMyTiers().then((tiers) => setMyTiers(tiers.filter((t) => t.is_active)));
  }, []);

  // Debounced auto-save to the drafts endpoint. Creates a draft on first
  // keystroke, then patches it every ~2s while the user keeps typing.
  // Skips saving when the textarea is empty (the validator rejects empty drafts).
  useEffect(() => {
    if (!isAuthenticated()) return;
    if (!text.trim() && !selectedMood && selectedTags.length === 0) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(async () => {
      if (!text.trim()) return;
      try {
        if (draftIdRef.current) {
          const updated = await updateDraft(draftIdRef.current, {
            text,
            mood: selectedMood || '',
            tags: selectedTags.map((t) => t.replace(/^#/, '')),
          });
          if (updated) setDraftSavedAt(updated.updated_at);
        } else {
          const created = await createDraft({
            text,
            mood: selectedMood || '',
            tags: selectedTags.map((t) => t.replace(/^#/, '')),
          });
          if (created) {
            draftIdRef.current = created.id;
            setDraftSavedAt(created.updated_at);
          }
        }
      } catch {
        /* best-effort — never block the user */
      }
    }, 2000);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [text, selectedMood, selectedTags]);

  // Offer to restore the most recent draft on mount (only if no pending
  // inspiration and the editor is empty). Closes the loop: auto-saved drafts
  // are recoverable across refreshes without building a full drafts tray UI.
  const [restorableDraft, setRestorableDraft] = useState<PostDraft | null>(null);
  useEffect(() => {
    if (!isAuthenticated()) return;
    let cancelled = false;
    (async () => {
      try {
        const drafts = await fetchDrafts();
        if (cancelled) return;
        if (drafts.length > 0) setRestorableDraft(drafts[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function restoreDraft(d: PostDraft) {
    setText(d.text);
    setSelectedMood(d.mood || null);
    setSelectedTags(d.tags || []);
    draftIdRef.current = d.id;
    setRestorableDraft(null);
  }

  function discardRestorable() {
    if (restorableDraft) void deleteDraft(restorableDraft.id);
    setRestorableDraft(null);
  }

  async function handleDeepen() {
    const trimmed = text.trim();
    if (trimmed.length < 8) return;
    setBuddyLoading(true);
    setBuddyError('');
    setBuddyPrompt(null);
    try {
      const result = await deepenDraft({ text: trimmed, lang: locale });
      if ('prompt' in result) setBuddyPrompt(result.prompt);
      else setBuddyError(result.error || t('compose.deepenError'));
    } catch {
      setBuddyError(t('compose.deepenError'));
    } finally {
      setBuddyLoading(false);
    }
  }

  // Voice recording via MediaRecorder API. Best-effort: silently fails on
  // browsers without mic support or permission denial.
  async function startRecording() {
    if (recording) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Voice recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        // Convert to a .webm File — backend accepts audio/webm via the audio validator.
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
        setAudioFile(file);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 29) {
            // Auto-stop at 30s to respect the "short voice note" intent.
            void stopRecording();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('Microphone permission denied or unavailable.');
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  function clearAudio() {
    setAudioFile(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordSeconds(0);
  }

  const resetForm = () => {
    setText('');
    setPostType('normal');
    setPollOptions(['', '']);
    setThreadParts([]);
    setVisibility('public');
    setRequiredTierId(null);
    setReplyControl('everyone');
    setSelectedMood(null);
    setSelectedTags([]);
    setImage(null);
    setImageAlt('');
    setVideo(null);
    setAttachmentName(null);
    setAttachmentFile(null);
    setImageFile(null);
    setVideoFile(null);
    clearAudio();
    setInspirationQuestionId(null);
    setScheduleOpen(false);
    setScheduleAt('');
    setLocationName('');
    setLocationLat(null);
    setLocationLng(null);
  };

  const hasScheduleBlockingExtras = !!(audioFile || attachmentName || threadParts.length > 0);

  useEffect(() => {
    if (scheduleOpen && (postType !== 'normal' || hasScheduleBlockingExtras)) {
      setScheduleOpen(false);
      setScheduleAt('');
    }
  }, [scheduleOpen, postType, hasScheduleBlockingExtras]);

  const handleUseLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not supported in this browser.');
      return;
    }
    setLocationBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLat(position.coords.latitude);
        setLocationLng(position.coords.longitude);
        setLocationBusy(false);
      },
      () => {
        setError('Could not get your location.');
        setLocationBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSchedule = async () => {
    if (!isAuthenticated()) {
      setError('Please sign in to publish.');
      return;
    }
    if (!scheduleAt) return;
    setError('');
    setPublishing(true);
    try {
      const result = await createScheduledPost(
        {
          text: text.trim(),
          mood: selectedMood || '',
          tags: selectedTags.map((tag) => tag.replace(/^#/, '')),
          visibility,
          required_tier_id: visibility === 'subscribers' ? requiredTierId : null,
          ...(locationName.trim() ? { location_name: locationName.trim() } : {}),
          ...(locationLat != null ? { location_lat: locationLat } : {}),
          ...(locationLng != null ? { location_lng: locationLng } : {}),
        },
        new Date(scheduleAt).toISOString(),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const scheduledMedia = [
        ...(imageFile ? [{ file: imageFile, altText: imageAlt }] : []),
        ...(videoFile ? [{ file: videoFile }] : []),
      ];
      if (scheduledMedia.length > 0) {
        const mediaOk = await addScheduledMedia(result.data.id, scheduledMedia);
        if (!mediaOk) {
          setError('Scheduled post created, but media upload failed.');
          return;
        }
      }
      resetForm();
      if (draftIdRef.current) {
        void deleteDraft(draftIdRef.current);
        draftIdRef.current = null;
        setDraftSavedAt(null);
      }
      setScheduled(true);
      setTimeout(() => setScheduled(false), 4000);
    } catch {
      setError('Could not schedule your post. Check the connection.');
    } finally {
      setPublishing(false);
    }
  };

  const handlePublish = async () => {
    if (!isAuthenticated()) {
      setError('Please sign in to publish.');
      return;
    }

    setError('');
    setPublishing(true);

    try {
      const payload: Record<string, unknown> = {
        text: text.trim(),
        mood: selectedMood || '',
        tags: selectedTags.map((tag) => tag.replace(/^#/, '')),
        post_type: postType,
        visibility,
        reply_control: replyControl,
      };
      if (visibility === 'subscribers' && requiredTierId) payload.required_tier = requiredTierId;
      if (inspirationQuestionId) payload.inspiration_question_id = inspirationQuestionId;
      if (postType === 'poll') {
        payload.poll_options = pollOptions.filter((o) => o.trim() !== '');
      }
      if (locationName.trim()) payload.location_name = locationName.trim();
      if (locationLat != null) payload.location_lat = locationLat;
      if (locationLng != null) payload.location_lng = locationLng;
      const res = await apiFetchJson('posts/', {
        method: 'POST',
        json: payload,
      });

      if (!res.ok) throw new Error('publish failed');

      const post = await res.json();

      if (imageFile || videoFile || audioFile || attachmentFile) {
        const form = new FormData();
        if (imageFile) {
          form.append('media', imageFile);
          if (imageAlt.trim()) form.append('alt_text', imageAlt.trim());
        }
        if (videoFile) form.append('media', videoFile);
        if (audioFile) form.append('media', audioFile);
        if (attachmentFile) form.append('media', attachmentFile);
        await apiFetch(`posts/${post.id}/add_media/`, { method: 'POST', body: form });
      }

      // Publish thread continuations, each linked to the previous part so the
      // whole chain forms one constellation.
      const parts = threadParts.map((p) => p.trim()).filter(Boolean);
      if (postType === 'normal' && parts.length > 0) {
        let prevId = post.id;
        for (const part of parts) {
          const partRes = await apiFetchJson('posts/', {
            method: 'POST',
            json: { text: part, post_type: 'normal', thread_parent: prevId },
          });
          if (!partRes.ok) break;
          const partPost = await partRes.json();
          prevId = partPost.id;
        }
      }

      resetForm();
      if (draftIdRef.current) {
        void deleteDraft(draftIdRef.current);
        draftIdRef.current = null;
        setDraftSavedAt(null);
      }
      setPublished(true);
      setTimeout(() => setPublished(false), 4000);
      onPublished?.();
    } catch {
      setError('Could not publish your post. Check the connection.');
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = useMemo(() => {
    const base = !!(text.trim() || image || video || audioFile || attachmentName);
    if (postType === 'poll') {
      return pollOptions.filter((o) => o.trim()).length >= 2;
    }
    if (postType === 'question') {
      return !!text.trim();
    }
    return base;
  }, [text, image, video, audioFile, attachmentName, postType, pollOptions]);

  return (
    <div className="create-post-card mb-6">
      <div className="create-post-card__shell">
        <div className="create-post-card__header">
          <div className="flex items-center gap-3 min-w-0">
            {avatar ? (
              <Image
                src={avatar}
                alt={`${displayName} avatar`}
                width={44}
                height={44}
                className="h-11 w-11 rounded-full object-cover border border-[#DED0F7]"
                unoptimized
              />
            ) : (
              <span className="create-post-card__avatar-fallback">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="create-post-card__eyebrow">{displayName}</p>
              <p className="create-post-card__subtle">Share your next creative spark</p>
            </div>
          </div>
        </div>

        <textarea
          className="create-post-card__textarea"
          placeholder={postType === 'poll' ? 'Ask your poll question…' : postType === 'question' ? 'Ask the community a question…' : 'Express your creativity today…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {postType === 'poll' && (
          <div className="space-y-2 mb-4">
            {pollOptions.map((option, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[idx] = e.target.value;
                    setPollOptions(next);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className="cosmic-input flex-1 text-sm"
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                    className="icon-only p-2"
                    aria-label="Remove option"
                  >
                    <XMarkIcon className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < MAX_POLL_OPTIONS && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ''])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-vault hover:text-bazaar transition-colors"
              >
                <PlusIcon className="h-5 w-5" strokeWidth={1.75} />
                Add option
              </button>
            )}
          </div>
        )}

        {postType === 'question' && (
          <p className="text-xs text-text-secondary mb-3">
            Community members can submit text answers. Only you will see the full list.
          </p>
        )}

        {postType === 'normal' && threadParts.length > 0 && (
          <div className="create-post-card__thread">
            <p className="create-post-card__section-heading">{t('feed.threadHint')}</p>
            {threadParts.map((part, idx) => (
              <div key={idx} className="create-post-card__thread-part">
                <span className="create-post-card__thread-seq">{idx + 2}</span>
                <textarea
                  value={part}
                  onChange={(e) => {
                    const next = [...threadParts];
                    next[idx] = e.target.value;
                    setThreadParts(next);
                  }}
                  rows={2}
                  placeholder={`${t('feed.threadCompose')} ${idx + 2}`}
                  className="create-post-card__thread-input"
                />
                <button
                  type="button"
                  onClick={() => setThreadParts((prev) => prev.filter((_, i) => i !== idx))}
                  className="icon-only p-2"
                  aria-label={t('common.cancel')}
                >
                  <XMarkIcon className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setThreadParts((prev) => [...prev, ''])}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-vault hover:text-bazaar transition-colors"
            >
              <PlusIcon className="h-5 w-5" strokeWidth={1.75} />
              {t('feed.addThreadPart')}
            </button>
          </div>
        )}

        {restorableDraft && !text.trim() && (
          <div className="create-post-card__draft-restore">
            <div className="create-post-card__draft-restore-text">
              <span className="create-post-card__draft-restore-title">Draft saved</span>
              <span className="create-post-card__draft-restore-snippet">
                {restorableDraft.text.slice(0, 60)}
                {restorableDraft.text.length > 60 ? '…' : ''}
              </span>
            </div>
            <div className="create-post-card__draft-restore-actions">
              <button
                type="button"
                onClick={() => restoreDraft(restorableDraft)}
                className="create-post-card__draft-restore-btn"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={discardRestorable}
                className="create-post-card__draft-restore-btn create-post-card__draft-restore-btn--muted"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {draftSavedAt && text.trim() && (
          <p className="create-post-card__draft-saved">Draft saved</p>
        )}

        {(buddyLoading || buddyPrompt || buddyError) && (
          <div className="create-post-card__buddy">
            <div className="create-post-card__buddy-header">
              <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
              <span className="create-post-card__buddy-label">
                {buddyLoading ? 'Reflecting…' : 'A question to deepen this'}
              </span>
              {buddyPrompt && (
                <button
                  type="button"
                  onClick={() => setBuddyPrompt(null)}
                  className="create-post-card__buddy-dismiss"
                  aria-label="Dismiss reflection"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {buddyPrompt && (
              <p className="create-post-card__buddy-prompt">{buddyPrompt}</p>
            )}
            {buddyError && (
              <p className="create-post-card__buddy-error">{buddyError}</p>
            )}
          </div>
        )}

        {(image || video || audioUrl || attachmentName) && (
          <div className="create-post-card__preview-row">
            {image && (
              <div className="create-post-card__image-preview">
                <Image
                  src={image}
                  alt={imageAlt.trim() || 'Selected post image preview'}
                  width={320}
                  height={144}
                  className="create-post-card__preview-media"
                  unoptimized
                />
                <label className="create-post-card__alt-label">
                  <span>{t('compose.altText')}</span>
                  <input
                    type="text"
                    value={imageAlt}
                    onChange={(e) => setImageAlt(e.target.value)}
                    placeholder={t('compose.altPlaceholder')}
                    maxLength={280}
                    className="create-post-card__alt-input"
                  />
                </label>
              </div>
            )}
            {video && <video src={video} controls className="create-post-card__preview-media" />}
            {audioUrl && (
              <div className="create-post-card__attachment-pill" style={{ gap: '0.5rem' }}>
                <MicrophoneIcon className="h-5 w-5" strokeWidth={1.75} />
                <audio src={audioUrl} controls className="h-8 max-w-[220px]" />
                <button
                  type="button"
                  onClick={clearAudio}
                  className="icon-only p-1.5 ml-1"
                  aria-label="Remove voice note"
                >
                  <XMarkIcon className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
            )}
            {attachmentName && (
              <div className="create-post-card__attachment-pill">
                <PaperClipIcon className="h-5 w-5" strokeWidth={1.75} />
                <span>{attachmentName}</span>
              </div>
            )}
          </div>
        )}

        <div className="create-post-card__toolbar">
          <button
            type="button"
            className={`create-post-card__tool ${postType === 'normal' ? 'create-post-card__tool--inspire' : ''}`}
            onClick={() => setPostType('normal')}
            aria-label="Normal post"
            title="Normal post"
          >
            <SparklesIcon className="h-5 w-5" strokeWidth={1.75} />
            <span className="hidden sm:inline text-xs font-semibold ml-1">Normal</span>
          </button>

          <button
            type="button"
            className={`create-post-card__tool ${postType === 'poll' ? 'create-post-card__tool--inspire' : ''}`}
            onClick={() => setPostType('poll')}
            aria-label="Poll"
            title="Poll"
          >
            <ChartBarIcon className="h-5 w-5" strokeWidth={1.75} />
            <span className="hidden sm:inline text-xs font-semibold ml-1">Poll</span>
          </button>

          <button
            type="button"
            className={`create-post-card__tool ${postType === 'question' ? 'create-post-card__tool--inspire' : ''}`}
            onClick={() => setPostType('question')}
            aria-label="Question"
            title="Question"
          >
            <QuestionMarkCircleIcon className="h-5 w-5" strokeWidth={1.75} />
            <span className="hidden sm:inline text-xs font-semibold ml-1">Question</span>
          </button>

          {postType === 'normal' && (
            <button
              type="button"
              className={`create-post-card__tool ${threadParts.length > 0 ? 'create-post-card__tool--inspire' : ''}`}
              onClick={() => setThreadParts((prev) => [...prev, ''])}
              aria-label={t('feed.addThreadPart')}
              title={t('feed.threadHint')}
            >
              <QueueListIcon className="h-5 w-5" strokeWidth={1.75} />
              <span className="hidden sm:inline text-xs font-semibold ml-1">{t('feed.threadCompose')}</span>
            </button>
          )}

          {postType === 'normal' && !hasScheduleBlockingExtras && (
            <button
              type="button"
              className={`create-post-card__tool ${scheduleOpen ? 'create-post-card__tool--inspire' : ''}`}
              onClick={() => setScheduleOpen((prev) => !prev)}
              aria-label={t('compose.scheduleForLater')}
              title={t('compose.scheduleForLater')}
            >
              <ClockIcon className="h-5 w-5" strokeWidth={1.75} />
              <span className="hidden sm:inline text-xs font-semibold ml-1">{t('compose.schedule')}</span>
            </button>
          )}

          <div className="w-px h-6 bg-surface mx-1" />

          <button
            type="button"
            className="create-post-card__tool create-post-card__tool--inspire"
            onClick={() => setInspirationOpen(true)}
            aria-label={t('inspiration.inspireMe')}
            title={t('inspiration.inspireMe')}
          >
            <SparklesIcon className="h-5 w-5" strokeWidth={1.75} />
            <span className="hidden sm:inline text-xs font-semibold ml-1">
              {t('inspiration.inspireMe')}
            </span>
          </button>

          <button
            type="button"
            className="create-post-card__tool"
            onClick={handleDeepen}
            disabled={buddyLoading || text.trim().length < 8}
            aria-label="Reflect"
            title="Get a reflective question to deepen your post"
          >
            <ChatBubbleBottomCenterTextIcon className="h-5 w-5" strokeWidth={1.75} />
            <span className="hidden sm:inline text-xs font-semibold ml-1">
              {buddyLoading ? 'Reflecting…' : 'Reflect'}
            </span>
          </button>

          <button
            type="button"
            className="create-post-card__tool"
            onClick={() => imageInput.current?.click()}
            aria-label="Add image"
          >
            <CameraIcon className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <input
            type="file"
            accept="image/*"
            ref={imageInput}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setImageFile(e.target.files[0]);
                setImageAlt('');
                setImage(URL.createObjectURL(e.target.files[0]));
              }
            }}
          />

          <button
            type="button"
            className="create-post-card__tool"
            onClick={() => videoInput.current?.click()}
            aria-label="Add video"
          >
            <VideoCameraIcon className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <input
            type="file"
            accept="video/*"
            ref={videoInput}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setVideoFile(e.target.files?.[0] ?? null);
                setVideo(URL.createObjectURL(e.target.files[0]));
              }
            }}
          />

          <button
            type="button"
            className={`create-post-card__tool ${recording ? 'create-post-card__tool--inspire' : ''}`}
            onClick={() => (recording ? stopRecording() : startRecording())}
            aria-label={recording ? 'Stop recording' : 'Record voice note'}
            title={recording ? `Recording… ${recordSeconds}s` : 'Record a 30s voice note'}
          >
            {recording ? <StopCircleIcon className="h-5 w-5" strokeWidth={1.75} /> : <MicrophoneIcon className="h-5 w-5" strokeWidth={1.75} />}
            {recording && (
              <span className="hidden sm:inline text-xs font-semibold ml-1 tabular-nums">
                {recordSeconds}s
              </span>
            )}
          </button>

          <button
            type="button"
            className="create-post-card__tool"
            onClick={() => attachmentInput.current?.click()}
            aria-label="Add file"
          >
            <PaperClipIcon className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <input
            type="file"
            ref={attachmentInput}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setAttachmentFile(e.target.files[0]);
                setAttachmentName(e.target.files[0].name);
              }
            }}
          />
        </div>

        <div className="create-post-card__section">
          <p className="create-post-card__section-title"># Trending Tags</p>
          <div className="create-post-card__chips">
            {visibleTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`create-post-card__chip ${selectedTags.includes(tag) ? 'create-post-card__chip--active' : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="create-post-card__section create-post-card__section--mood">
          <p className="create-post-card__section-heading">How are you feeling?</p>
          <div className="create-post-card__moods">
            {visibleMoods.map((mood) => (
              <button
                key={mood.emoji}
                type="button"
                className={`create-post-card__mood ${selectedMood === mood.emoji ? 'create-post-card__mood--active' : ''}`}
                onClick={() => setSelectedMood(selectedMood === mood.emoji ? null : mood.emoji)}
                title={mood.label}
              >
                <span className="create-post-card__mood-emoji">{mood.emoji}</span>
                <span className="create-post-card__mood-label">{mood.label}</span>
              </button>
            ))}
          </div>
        </div>

        {scheduleOpen && (
          <div className="create-post-card__control mb-4">
            <span className="create-post-card__control-label">{t('compose.scheduleForLater')}</span>
            <input
              type="datetime-local"
              value={scheduleAt}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="create-post-card__select"
              aria-label={t('compose.scheduleForLater')}
            />
          </div>
        )}

        <div className="create-post-card__control mb-4">
          <span className="create-post-card__control-label">Location</span>
          <input
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Add a place…"
            maxLength={120}
            className="create-post-card__select"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locationBusy}
              className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-vault disabled:opacity-50"
            >
              {locationBusy ? 'Locating…' : 'Use my location'}
            </button>
            {locationLat != null && locationLng != null && (
              <span className="text-xs text-text-secondary">
                {locationLat.toFixed(5)}, {locationLng.toFixed(5)}
              </span>
            )}
          </div>
        </div>

        <div className="create-post-card__controls">
          <label className="create-post-card__control">
            <span className="create-post-card__control-label">{t('compose.audience')}</span>
            <select
              value={visibility}
              onChange={(e) => {
                const next = e.target.value as 'public' | 'followers' | 'subscribers';
                setVisibility(next);
                if (next !== 'subscribers') setRequiredTierId(null);
              }}
              className="create-post-card__select"
            >
              <option value="public">{t('compose.audiencePublic')}</option>
              <option value="followers">{t('compose.audienceFollowers')}</option>
              {myTiers.length > 0 && (
                <option value="subscribers">{t('compose.audienceSubscribers')}</option>
              )}
            </select>
          </label>
          {visibility === 'subscribers' && (
            <label className="create-post-card__control">
              <span className="create-post-card__control-label">{t('compose.requiredTier')}</span>
              <select
                value={requiredTierId ?? ''}
                onChange={(e) => setRequiredTierId(e.target.value ? Number(e.target.value) : null)}
                className="create-post-card__select"
              >
                <option value="">{t('compose.anySubscriber')}</option>
                {myTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} (${tier.price_usd.toFixed(2)}+)
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="create-post-card__control">
            <span className="create-post-card__control-label">{t('compose.replyControl')}</span>
            <select
              value={replyControl}
              onChange={(e) => setReplyControl(e.target.value as 'everyone' | 'followers' | 'nobody')}
              className="create-post-card__select"
            >
              <option value="everyone">{t('compose.replyEveryone')}</option>
              <option value="followers">{t('compose.replyFollowers')}</option>
              <option value="nobody">{t('compose.replyNobody')}</option>
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        {scheduled && <p className="text-sm text-green-500 mt-3">{t('compose.scheduledSuccess')}</p>}
        {published && <p className="text-sm text-green-500 mt-3">{t('compose.publishedSuccess')}</p>}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setScheduledPanelOpen(true)}
            className="text-xs font-medium text-text-secondary hover:text-vault underline-offset-2 hover:underline"
          >
            {t('compose.scheduledPanelTitle')}
          </button>
          <button
            type="button"
            className="create-post-card__publish disabled:opacity-40"
            onClick={scheduleOpen && scheduleAt ? handleSchedule : handlePublish}
            disabled={publishing || !canPublish || (scheduleOpen && !scheduleAt)}
          >
            {scheduleOpen && scheduleAt ? <ClockIcon className="h-5 w-5" strokeWidth={1.75} /> : <PaperAirplaneIcon className="h-5 w-5" strokeWidth={1.75} />}
            {publishing
              ? (scheduleOpen && scheduleAt ? t('compose.scheduling') : t('compose.publishing'))
              : (scheduleOpen && scheduleAt ? t('compose.schedulePost') : t('compose.publish'))}
          </button>
        </div>
      </div>

      <ScheduledPostsPanel open={scheduledPanelOpen} onClose={() => setScheduledPanelOpen(false)} />

      <InspirationPicker
        open={inspirationOpen}
        onClose={() => setInspirationOpen(false)}
        onUse={handleUseInspiration}
      />
    </div>
  );
}