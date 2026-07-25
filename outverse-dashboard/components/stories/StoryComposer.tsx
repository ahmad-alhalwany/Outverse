'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import {
  XMarkIcon,
  PhotoIcon,
  PaintBrushIcon,
  FaceSmileIcon,
  TrashIcon,
  SparklesIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
  MapPinIcon,
  AtSymbolIcon,
  ClockIcon,
  GlobeAltIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';
import {
  searchMentionUsers,
  fetchCloseFriends,
  addCloseFriend,
  removeCloseFriend,
  type MentionCandidate,
  type CloseFriendItem,
} from '@/lib/storyUtils';
import StoryOverlaysLayer from './StoryOverlaysLayer';
import {
  STORY_FILTERS,
  STORY_BACKGROUNDS,
  STORY_TEMPLATES,
  STORY_STICKERS,
  STORY_TEXT_COLORS,
  STORY_BRUSH_COLORS,
  STORY_MOODS,
  CAPSULE_DURATIONS,
  COUNTDOWN_DURATIONS,
  filterCss,
  backgroundCss,
  newTextOverlay,
  newStickerOverlay,
  newPollOverlay,
  newQuestionOverlay,
  newLocationOverlay,
  newMentionOverlay,
  newCountdownOverlay,
  type StoryFilterKey,
  type StoryLocationOverlay,
  type StoryOverlay,
  type StoryTextOverlay,
  type StoryStroke,
} from '@/lib/storyStudio';

type Tool = 'none' | 'draw' | 'stickers' | 'mention-search';

export function AddStoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | null>(null);
  const [filterKey, setFilterKey] = useState<StoryFilterKey>('none');
  const [backgroundKey, setBackgroundKey] = useState(STORY_BACKGROUNDS[0].key);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [drawing, setDrawing] = useState<StoryStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<[number, number][] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('none');
  const [brushColor, setBrushColor] = useState(STORY_BRUSH_COLORS[0]);
  const [brushWidth, setBrushWidth] = useState(3);
  const [mood, setMood] = useState<string | null>(null);
  const [capsuleHours, setCapsuleHours] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<MentionCandidate[]>([]);
  const [extraMedia, setExtraMedia] = useState<{ file: File; preview: string; kind: 'image' | 'video' }[]>([]);
  const [audience, setAudience] = useState<'everyone' | 'close_friends'>('everyone');
  const [showCloseFriends, setShowCloseFriends] = useState(false);
  const [closeFriends, setCloseFriends] = useState<CloseFriendItem[]>([]);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendResults, setFriendResults] = useState<MentionCandidate[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const draggingIdRef = useRef<string | null>(null);

  const selected = overlays.find((o) => o.id === selectedId) || null;

  const pctFromPoint = (clientX: number, clientY: number): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return [Math.max(2, Math.min(98, x)), Math.max(2, Math.min(98, y))];
  };

  const handleMediaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const [first, ...rest] = files;
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(first);
    setMediaPreview(URL.createObjectURL(first));
    setMediaKind(first.type.startsWith('video') ? 'video' : 'image');
    setMode('media');
    if (rest.length > 0) {
      setExtraMedia((prev) => [
        ...prev,
        ...rest.map((file) => ({
          file,
          preview: URL.createObjectURL(file),
          kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
        })),
      ]);
    }
  };

  const removeExtraMedia = (index: number) => {
    setExtraMedia((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const openCloseFriends = async () => {
    setShowCloseFriends(true);
    setFriendQuery('');
    setFriendResults([]);
    const friends = await fetchCloseFriends();
    setCloseFriends(friends);
  };

  const handleFriendQueryChange = async (q: string) => {
    setFriendQuery(q);
    const results = await searchMentionUsers(q);
    setFriendResults(results);
  };

  const toggleCloseFriend = async (userId: number, username: string, avatar: string | null) => {
    const isMember = closeFriends.some((f) => f.id === userId);
    if (isMember) {
      await removeCloseFriend(userId);
      setCloseFriends((prev) => prev.filter((f) => f.id !== userId));
    } else {
      await addCloseFriend(userId);
      setCloseFriends((prev) => [...prev, { id: userId, username, avatar }]);
    }
  };

  const addText = () => {
    const el = newTextOverlay();
    setOverlays((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool('none');
  };

  const addSticker = (emoji: string) => {
    const el = newStickerOverlay(emoji);
    setOverlays((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool('none');
  };

  const addPoll = () => {
    const el = newPollOverlay();
    setOverlays((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool('none');
  };

  const addQuestion = () => {
    const el = newQuestionOverlay();
    setOverlays((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool('none');
  };

  const addLocation = () => {
    const el = newLocationOverlay();
    setOverlays((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool('none');
  };

  const addCountdown = () => {
    const el = newCountdownOverlay();
    setOverlays((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool('none');
  };

  const openMentionSearch = () => {
    setSelectedId(null);
    setMentionQuery('');
    setMentionResults([]);
    setTool('mention-search');
  };

  const handleMentionQueryChange = async (q: string) => {
    setMentionQuery(q);
    const results = await searchMentionUsers(q);
    setMentionResults(results);
  };

  const selectMentionUser = (user: MentionCandidate) => {
    const el = newMentionOverlay(user.id, user.username);
    setOverlays((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool('none');
  };

  const updateSelected = (patch: Partial<StoryOverlay>) => {
    if (!selectedId) return;
    setOverlays((prev) => prev.map((o) => (o.id === selectedId ? ({ ...o, ...patch } as StoryOverlay) : o)));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setOverlays((prev) => prev.filter((o) => o.id !== selectedId));
    setSelectedId(null);
  };

  const applyTemplate = (tpl: (typeof STORY_TEMPLATES)[number]) => {
    setMode('text');
    setBackgroundKey(tpl.background);
    const existingText = overlays.find((o): o is StoryTextOverlay => o.type === 'text');
    if (existingText) {
      updateSelectedById(existingText.id, {
        color: tpl.textColor,
        fontWeight: tpl.fontWeight,
        fontSize: tpl.fontSize,
      });
    } else {
      const el = newTextOverlay('Your story…');
      el.color = tpl.textColor;
      el.fontWeight = tpl.fontWeight;
      el.fontSize = tpl.fontSize;
      setOverlays((prev) => [...prev, el]);
      setSelectedId(el.id);
    }
  };

  function updateSelectedById(id: string, patch: Partial<StoryOverlay>) {
    setOverlays((prev) => prev.map((o) => (o.id === id ? ({ ...o, ...patch } as StoryOverlay) : o)));
  }

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (tool === 'draw') {
      const p = pctFromPoint(e.clientX, e.clientY);
      setCurrentStroke([p]);
      return;
    }
    setSelectedId(null);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (tool === 'draw' && currentStroke) {
      const p = pctFromPoint(e.clientX, e.clientY);
      setCurrentStroke((s) => (s ? [...s, p] : s));
      return;
    }
    if (draggingIdRef.current) {
      const [x, y] = pctFromPoint(e.clientX, e.clientY);
      updateSelectedById(draggingIdRef.current, { x, y });
    }
  };

  const finishDrag = () => {
    if (tool === 'draw' && currentStroke) {
      if (currentStroke.length > 1) {
        setDrawing((d) => [...d, { points: currentStroke, color: brushColor, width: brushWidth }]);
      }
      setCurrentStroke(null);
    }
    draggingIdRef.current = null;
  };

  const handleOverlaySelect = (id: string) => {
    setSelectedId(id);
    draggingIdRef.current = id;
  };

  const handleSubmit = async () => {
    const textOverlay = overlays.find((o): o is StoryTextOverlay => o.type === 'text');
    const locationOverlay = overlays.find(
      (o): o is StoryLocationOverlay => o.type === 'location' && !!o.label.trim(),
    );
    if (mode === 'media' && !mediaFile) {
      setError('Add a photo or video, or switch to a text story.');
      return;
    }
    if (mode === 'text' && overlays.length === 0 && drawing.length === 0) {
      setError('Add some text, a sticker, or a drawing to your story.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const form = new FormData();
      if (textOverlay?.text.trim()) form.append('text', textOverlay.text.trim());
      if (mode === 'media' && mediaFile) {
        if (mediaKind === 'video') form.append('video', mediaFile);
        else form.append('image', mediaFile);
        form.append('filter_style', filterKey);
      } else {
        form.append('background_style', backgroundKey);
      }
      form.append('overlays', JSON.stringify(overlays));
      form.append('drawing', JSON.stringify(drawing));
      form.append('audience', audience);
      if (locationOverlay) {
        form.append('location_name', locationOverlay.label.trim());
        if (typeof locationOverlay.lat === 'number') form.append('location_lat', String(locationOverlay.lat));
        if (typeof locationOverlay.lng === 'number') form.append('location_lng', String(locationOverlay.lng));
      }
      if (mood) form.append('mood', mood);
      if (capsuleHours) {
        const unlockAt = new Date(Date.now() + capsuleHours * 3600 * 1000).toISOString();
        form.append('unlock_at', unlockAt);
      }
      const res = await apiFetch('stories/', { method: 'POST', body: form });
      if (!res.ok) throw new Error('failed');

      // Batch-publish any additional queued photos/videos as their own
      // stories — swipe-through "dump several at once" like FB/IG, sharing
      // the same mood/audience/capsule settings as the main one.
      let extraFailures = 0;
      for (const extra of extraMedia) {
        const extraForm = new FormData();
        if (extra.kind === 'video') extraForm.append('video', extra.file);
        else extraForm.append('image', extra.file);
        extraForm.append('overlays', '[]');
        extraForm.append('drawing', '[]');
        extraForm.append('audience', audience);
        if (locationOverlay) {
          extraForm.append('location_name', locationOverlay.label.trim());
          if (typeof locationOverlay.lat === 'number') extraForm.append('location_lat', String(locationOverlay.lat));
          if (typeof locationOverlay.lng === 'number') extraForm.append('location_lng', String(locationOverlay.lng));
        }
        if (mood) extraForm.append('mood', mood);
        if (capsuleHours) {
          extraForm.append('unlock_at', new Date(Date.now() + capsuleHours * 3600 * 1000).toISOString());
        }
        const extraRes = await apiFetch('stories/', { method: 'POST', body: extraForm });
        if (!extraRes.ok) extraFailures += 1;
      }

      onCreated();
      if (extraFailures > 0) {
        setError(
          extraFailures === 1
            ? 'Story published, but 1 additional item failed to upload. Try adding it again.'
            : `Story published, but ${extraFailures} additional items failed to upload. Try adding them again.`,
        );
        return;
      }
      onClose();
    } catch {
      setError('Could not publish story. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canvasBackground =
    mode === 'media'
      ? undefined
      : backgroundCss(backgroundKey);

  return (
    <div className="story-studio-backdrop">
      <div className="story-studio-shell">
        <div className="story-studio-header">
          <h3>New cosmic story</h3>
          <button onClick={onClose} type="button" className="story-viewer-close" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="story-studio-mode-tabs">
          <button
            type="button"
            className={`story-studio-tab${mode === 'text' ? ' story-studio-tab--active' : ''}`}
            onClick={() => setMode('text')}
          >
            Text
          </button>
          <button
            type="button"
            className={`story-studio-tab${mode === 'media' ? ' story-studio-tab--active' : ''}`}
            onClick={() => (mediaFile ? setMode('media') : mediaInputRef.current?.click())}
          >
            Photo / Video
          </button>
        </div>

        <div
          ref={canvasRef}
          className="story-studio-canvas"
          style={{ background: canvasBackground }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={finishDrag}
          onPointerLeave={finishDrag}
        >
          {mode === 'media' && mediaPreview && (
            mediaKind === 'video' ? (
              <video
                src={mediaPreview}
                className="story-studio-media"
                style={{ filter: filterCss(filterKey) }}
                muted
                autoPlay
                loop
                playsInline
              />
            ) : (
              <Image
                src={mediaPreview}
                alt="Story preview"
                fill
                unoptimized
                className="story-studio-media"
                style={{ filter: filterCss(filterKey), objectFit: 'cover' }}
              />
            )
          )}

          <StoryOverlaysLayer
            overlays={overlays}
            drawing={drawing}
            selectedId={selectedId}
            onSelect={handleOverlaySelect}
            draggable
          />

          {currentStroke && currentStroke.length > 1 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={currentStroke.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke={brushColor}
                strokeWidth={brushWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          {tool !== 'draw' && overlays.length === 0 && mode === 'text' && (
            <p className="story-studio-hint">Tap “Aa” to add text, or pick a template below</p>
          )}
        </div>

        {/* Selected element controls */}
        {selected && (
          <div className="story-studio-selected-panel">
            {selected.type === 'text' ? (
              <>
                <input
                  type="text"
                  value={selected.text}
                  onChange={(e) => updateSelected({ text: e.target.value })}
                  placeholder="Your text…"
                  className="story-studio-text-input"
                  autoFocus
                />
                <div className="story-studio-swatch-row">
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`story-studio-align-btn${(selected.align || 'center') === a ? ' story-studio-align-btn--active' : ''}`}
                      onClick={() => updateSelected({ align: a })}
                      aria-label={`Align ${a}`}
                    >
                      {a === 'left' ? '⟸' : a === 'right' ? '⟹' : '☰'}
                    </button>
                  ))}
                </div>
                <div className="story-studio-swatch-row">
                  {STORY_TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`story-studio-swatch${selected.color === c ? ' story-studio-swatch--active' : ''}`}
                      style={{ background: c }}
                      onClick={() => updateSelected({ color: c })}
                      aria-label={`Text color ${c}`}
                    />
                  ))}
                  <button type="button" className="story-studio-icon-btn story-studio-icon-btn--danger" onClick={deleteSelected} aria-label="Delete text">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : selected.type === 'sticker' ? (
              <div className="story-studio-swatch-row">
                <button type="button" className="story-studio-mini-btn" onClick={() => updateSelected({ scale: Math.max(0.5, (selected.scale || 1) - 0.2) })}>−</button>
                <span className="text-xs text-white/70">Size</span>
                <button type="button" className="story-studio-mini-btn" onClick={() => updateSelected({ scale: Math.min(3, (selected.scale || 1) + 0.2) })}>+</button>
                <button type="button" className="story-studio-icon-btn story-studio-icon-btn--danger" onClick={deleteSelected} aria-label="Delete sticker">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ) : selected.type === 'poll' ? (
              <>
                <input
                  type="text"
                  value={selected.question}
                  onChange={(e) => updateSelected({ question: e.target.value })}
                  placeholder="Ask a question…"
                  className="story-studio-text-input"
                  autoFocus
                />
                <div className="story-studio-poll-options-edit">
                  <input
                    type="text"
                    value={selected.options[0]}
                    onChange={(e) => updateSelected({ options: [e.target.value, selected.options[1]] })}
                    placeholder="Option A"
                    className="story-studio-text-input"
                    maxLength={30}
                  />
                  <input
                    type="text"
                    value={selected.options[1]}
                    onChange={(e) => updateSelected({ options: [selected.options[0], e.target.value] })}
                    placeholder="Option B"
                    className="story-studio-text-input"
                    maxLength={30}
                  />
                </div>
                <div className="story-studio-swatch-row">
                  <button type="button" className="story-studio-icon-btn story-studio-icon-btn--danger" onClick={deleteSelected} aria-label="Delete poll">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : selected.type === 'question' ? (
              <>
                <input
                  type="text"
                  value={selected.prompt}
                  onChange={(e) => updateSelected({ prompt: e.target.value })}
                  placeholder="Ask me anything…"
                  className="story-studio-text-input"
                  maxLength={80}
                  autoFocus
                />
                <div className="story-studio-swatch-row">
                  <button type="button" className="story-studio-icon-btn story-studio-icon-btn--danger" onClick={deleteSelected} aria-label="Delete question">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : selected.type === 'location' ? (
              <>
                <input
                  type="text"
                  value={selected.label}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                  placeholder="Add a location…"
                  className="story-studio-text-input"
                  maxLength={60}
                  autoFocus
                />
                <div className="story-studio-swatch-row">
                  <button type="button" className="story-studio-icon-btn story-studio-icon-btn--danger" onClick={deleteSelected} aria-label="Delete location">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : selected.type === 'mention' ? (
              <div className="story-studio-swatch-row">
                <span className="text-xs text-white/70">@{selected.username}</span>
                <button type="button" className="story-studio-icon-btn story-studio-icon-btn--danger" onClick={deleteSelected} aria-label="Delete mention">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={selected.label}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                  placeholder="What's counting down?"
                  className="story-studio-text-input"
                  maxLength={40}
                  autoFocus
                />
                <div className="story-studio-swatch-row">
                  {COUNTDOWN_DURATIONS.map((c) => (
                    <button
                      key={c.hours}
                      type="button"
                      className="story-studio-mini-btn story-studio-mini-btn--wide"
                      onClick={() => updateSelected({ targetAt: new Date(Date.now() + c.hours * 3600 * 1000).toISOString() })}
                    >
                      {c.label}
                    </button>
                  ))}
                  <button type="button" className="story-studio-icon-btn story-studio-icon-btn--danger" onClick={deleteSelected} aria-label="Delete countdown">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Draw tool controls */}
        {tool === 'draw' && (
          <div className="story-studio-selected-panel">
            <div className="story-studio-swatch-row">
              {STORY_BRUSH_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`story-studio-swatch${brushColor === c ? ' story-studio-swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setBrushColor(c)}
                  aria-label={`Brush color ${c}`}
                />
              ))}
              <button type="button" className="story-studio-mini-btn" onClick={() => setBrushWidth((w) => Math.max(1, w - 1))}>−</button>
              <span className="text-xs text-white/70">Brush</span>
              <button type="button" className="story-studio-mini-btn" onClick={() => setBrushWidth((w) => Math.min(10, w + 1))}>+</button>
              {drawing.length > 0 && (
                <button type="button" className="story-studio-icon-btn story-studio-icon-btn--danger" onClick={() => setDrawing((d) => d.slice(0, -1))} aria-label="Undo last stroke">
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="story-studio-toolbar">
          <button type="button" className="story-studio-tool-btn" onClick={addText}>
            <span className="story-studio-tool-icon">Aa</span>
            Text
          </button>
          <button
            type="button"
            className={`story-studio-tool-btn${tool === 'stickers' ? ' story-studio-tool-btn--active' : ''}`}
            onClick={() => setTool((t) => (t === 'stickers' ? 'none' : 'stickers'))}
          >
            <FaceSmileIcon className="story-studio-tool-icon-svg" />
            Sticker
          </button>
          <button
            type="button"
            className={`story-studio-tool-btn${tool === 'draw' ? ' story-studio-tool-btn--active' : ''}`}
            onClick={() => {
              setSelectedId(null);
              setTool((t) => (t === 'draw' ? 'none' : 'draw'));
            }}
          >
            <PaintBrushIcon className="story-studio-tool-icon-svg" />
            Draw
          </button>
          <button
            type="button"
            className="story-studio-tool-btn"
            onClick={() => mediaInputRef.current?.click()}
          >
            <PhotoIcon className="story-studio-tool-icon-svg" />
            Media
          </button>
          <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaFile} />
        </div>

        <div className="story-studio-toolbar">
          <button type="button" className="story-studio-tool-btn" onClick={addPoll}>
            <ChartBarIcon className="story-studio-tool-icon-svg" />
            Poll
          </button>
          <button type="button" className="story-studio-tool-btn" onClick={addQuestion}>
            <QuestionMarkCircleIcon className="story-studio-tool-icon-svg" />
            Question
          </button>
          <button type="button" className="story-studio-tool-btn" onClick={addLocation}>
            <MapPinIcon className="story-studio-tool-icon-svg" />
            Location
          </button>
          <button
            type="button"
            className={`story-studio-tool-btn${tool === 'mention-search' ? ' story-studio-tool-btn--active' : ''}`}
            onClick={() => (tool === 'mention-search' ? setTool('none') : openMentionSearch())}
          >
            <AtSymbolIcon className="story-studio-tool-icon-svg" />
            Mention
          </button>
          <button type="button" className="story-studio-tool-btn" onClick={addCountdown}>
            <ClockIcon className="story-studio-tool-icon-svg" />
            Countdown
          </button>
        </div>

        {tool === 'mention-search' && (
          <div className="story-studio-selected-panel">
            <input
              type="text"
              value={mentionQuery}
              onChange={(e) => handleMentionQueryChange(e.target.value)}
              placeholder="Search a username…"
              className="story-studio-text-input"
              autoFocus
            />
            {mentionResults.length > 0 && (
              <div className="story-studio-mention-results">
                {mentionResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="story-studio-mention-result"
                    onClick={() => selectMentionUser(u)}
                  >
                    @{u.username}
                    {u.name && <span className="story-studio-mention-result-name">{u.name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tool === 'stickers' && (
          <div className="story-studio-sticker-grid">
            {STORY_STICKERS.map((emoji) => (
              <button key={emoji} type="button" className="story-studio-sticker-btn" onClick={() => addSticker(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}

        {mode === 'media' ? (
          <>
            <div className="story-studio-strip">
              {STORY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`story-studio-filter-chip${filterKey === f.key ? ' story-studio-filter-chip--active' : ''}`}
                  onClick={() => setFilterKey(f.key)}
                >
                  <span>{f.emoji}</span>
                  {f.label}
                </button>
              ))}
            </div>
            {extraMedia.length > 0 && (
              <div className="story-studio-strip">
                {extraMedia.map((m, i) => (
                  <div key={i} className="story-studio-queue-thumb">
                    {m.kind === 'video' ? (
                      <video src={m.preview} muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.preview} alt="" />
                    )}
                    <button type="button" onClick={() => removeExtraMedia(i)} aria-label="Remove from queue">
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button type="button" className="story-studio-queue-add" onClick={() => mediaInputRef.current?.click()}>
                  +
                </button>
              </div>
            )}
            {extraMedia.length > 0 && (
              <p className="story-studio-hint story-studio-hint--capsule">
                This photo will publish now, then {extraMedia.length} more will follow as separate stories.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="story-studio-strip">
              {STORY_BACKGROUNDS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={`story-studio-bg-swatch${backgroundKey === b.key ? ' story-studio-bg-swatch--active' : ''}`}
                  style={{ background: b.css }}
                  onClick={() => setBackgroundKey(b.key)}
                  title={b.label}
                  aria-label={b.label}
                />
              ))}
            </div>
            <div className="story-studio-strip">
              {STORY_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  type="button"
                  className="story-studio-template-chip"
                  style={{ background: backgroundCss(tpl.background) }}
                  onClick={() => applyTemplate(tpl)}
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  {tpl.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="story-studio-strip">
          {STORY_MOODS.map((m) => (
            <button
              key={m.emoji}
              type="button"
              className={`story-studio-mood-chip${mood === m.emoji ? ' story-studio-mood-chip--active' : ''}`}
              style={{ ['--mood-ring' as string]: m.ring }}
              onClick={() => setMood((cur) => (cur === m.emoji ? null : m.emoji))}
              title={m.label}
            >
              <span>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>

        <div className="story-studio-strip">
          <button
            type="button"
            className={`story-studio-capsule-chip${capsuleHours === null ? ' story-studio-capsule-chip--active' : ''}`}
            onClick={() => setCapsuleHours(null)}
          >
            No seal
          </button>
          {CAPSULE_DURATIONS.map((c) => (
            <button
              key={c.hours}
              type="button"
              className={`story-studio-capsule-chip${capsuleHours === c.hours ? ' story-studio-capsule-chip--active' : ''}`}
              onClick={() => setCapsuleHours(c.hours)}
              title={`Seal for ${c.label} — hidden from everyone, even you, until it opens`}
            >
              🔒 {c.label}
            </button>
          ))}
        </div>
        {capsuleHours && (
          <p className="story-studio-hint story-studio-hint--capsule">
            Sealed as a Time Capsule — nobody, not even you, can see it until it opens in {capsuleHours}h.
          </p>
        )}

        <div className="story-studio-strip">
          <button
            type="button"
            className={`story-studio-capsule-chip${audience === 'everyone' ? ' story-studio-capsule-chip--active' : ''}`}
            onClick={() => setAudience('everyone')}
          >
            <GlobeAltIcon className="h-3.5 w-3.5 inline mr-1" />
            Everyone
          </button>
          <button
            type="button"
            className={`story-studio-capsule-chip story-studio-capsule-chip--green${audience === 'close_friends' ? ' story-studio-capsule-chip--active' : ''}`}
            onClick={() => setAudience('close_friends')}
          >
            <UserGroupIcon className="h-3.5 w-3.5 inline mr-1" />
            Close Friends
          </button>
          <button type="button" className="story-studio-capsule-chip" onClick={openCloseFriends}>
            Manage
          </button>
        </div>
        {audience === 'close_friends' && (
          <p className="story-studio-hint story-studio-hint--capsule">
            Only your close friends list ({closeFriends.length}) will see this story.
          </p>
        )}

        {showCloseFriends && (
          <div className="story-studio-selected-panel">
            <div className="story-studio-close-friends-header">
              <p>Close Friends</p>
              <button type="button" onClick={() => setShowCloseFriends(false)} aria-label="Close">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={friendQuery}
              onChange={(e) => handleFriendQueryChange(e.target.value)}
              placeholder="Search people to add…"
              className="story-studio-text-input"
            />
            {friendResults.length > 0 && (
              <div className="story-studio-mention-results">
                {friendResults.map((u) => {
                  const isMember = closeFriends.some((f) => f.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className="story-studio-mention-result"
                      onClick={() => toggleCloseFriend(u.id, u.username, u.avatar)}
                    >
                      @{u.username}
                      <span className="story-studio-mention-result-name">{isMember ? '✓ Added' : 'Add'}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {closeFriends.length > 0 && (
              <div className="story-studio-mention-results">
                {closeFriends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="story-studio-mention-result"
                    onClick={() => toggleCloseFriend(f.id, f.username, f.avatar)}
                  >
                    @{f.username}
                    <span className="story-studio-mention-result-name">✓ Remove</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="story-add-error">{error}</p>}
        <button type="button" disabled={submitting} onClick={handleSubmit} className="story-add-submit cosmic-btn w-full !py-3 mt-2">
          {submitting ? 'Launching…' : capsuleHours ? 'Seal & publish' : 'Publish story'}
        </button>
      </div>
    </div>
  );
}

export default AddStoryModal;
