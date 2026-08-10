'use client';

import { useRef, type CSSProperties, type RefObject } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  PhotoIcon,
  Bars3BottomLeftIcon,
  ChatBubbleBottomCenterTextIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline';

type Colors = {
  line: string;
  white: string;
  text: string;
  text2: string;
  card: string;
  brownDk: string;
};

function wrapSelection(
  el: HTMLTextAreaElement,
  value: string,
  before: string,
  after = before,
  placeholder = 'text',
) {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end) || placeholder;
  const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
  const caret = start + before.length + selected.length + after.length;
  return { next, caretStart: start + before.length, caretEnd: start + before.length + selected.length, focusAt: caret };
}

function insertAtCursor(el: HTMLTextAreaElement, value: string, chunk: string) {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = `${value.slice(0, start)}${chunk}${value.slice(end)}`;
  const caret = start + chunk.length;
  return { next, caret };
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  colors: Colors;
  placeholder?: string;
  maxLength?: number;
  minHeightClass?: string;
  disabled?: boolean;
};

export default function ForgeFocusEditor({
  value,
  onChange,
  colors: C,
  placeholder = 'Continue the story…',
  maxLength = 12000,
  minHeightClass = 'min-h-[220px] md:min-h-[320px]',
  disabled,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function applyWrap(before: string, after?: string, placeholderText?: string) {
    const el = ref.current;
    if (!el) return;
    const { next, caretStart, caretEnd } = wrapSelection(el, value, before, after ?? before, placeholderText);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caretStart, caretEnd);
    });
  }

  function applyInsert(chunk: string) {
    const el = ref.current;
    if (!el) return;
    const { next, caret } = insertAtCursor(el, value, chunk);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  function insertImageUrl() {
    const url = window.prompt('Image URL');
    if (!url?.trim()) return;
    const alt = window.prompt('Alt text (optional)', 'scene') || 'scene';
    applyInsert(`\n![${alt}](${url.trim()})\n`);
  }

  function onPickFile(file: File | null) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 400_000) {
      window.alert('Image is large — paste a hosted URL instead (max ~400KB for inline insert).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;
      applyInsert(`\n![${file.name}](${dataUrl})\n`);
    };
    reader.readAsDataURL(file);
  }

  const btnStyle: CSSProperties = {
    borderColor: C.line,
    color: C.text,
    background: C.white,
  };

  const tools: {
    label: string;
    title: string;
    icon?: typeof BoldIcon;
    onClick: () => void;
  }[] = [
    { label: 'B', title: 'Bold', icon: BoldIcon, onClick: () => applyWrap('**') },
    { label: 'I', title: 'Italic', icon: ItalicIcon, onClick: () => applyWrap('*') },
    { label: 'U', title: 'Underline', icon: UnderlineIcon, onClick: () => applyWrap('~') },
    { label: 'H', title: 'Heading', icon: HashtagIcon, onClick: () => applyWrap('\n## ', '\n', 'Scene title') },
    { label: '“', title: 'Quote', icon: ChatBubbleBottomCenterTextIcon, onClick: () => applyWrap('\n> ', '\n', 'quoted line') },
    { label: '•', title: 'List', icon: Bars3BottomLeftIcon, onClick: () => applyWrap('\n- ', '\n', 'detail') },
    { label: '***', title: 'Scene break', onClick: () => applyInsert('\n\n* * *\n\n') },
    { label: 'IMG', title: 'Image URL', icon: PhotoIcon, onClick: insertImageUrl },
  ];

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.line, background: C.white }}>
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: C.line, background: C.card }}>
        {tools.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            disabled={disabled}
            onClick={t.onClick}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold disabled:opacity-50"
            style={btnStyle}
          >
            {t.icon ? <t.icon className="h-3.5 w-3.5" /> : <span>{t.label}</span>}
          </button>
        ))}
        <button
          type="button"
          title="Upload image"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold disabled:opacity-50"
          style={btnStyle}
        >
          <PhotoIcon className="h-3.5 w-3.5" /> Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPickFile(e.target.files?.[0] || null);
            e.target.value = '';
          }}
        />
      </div>
      <textarea
        ref={ref as RefObject<HTMLTextAreaElement>}
        className={`${minHeightClass} w-full resize-y bg-transparent p-3 text-sm leading-relaxed outline-none md:text-[15px]`}
        style={{ color: C.text }}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className="flex justify-between border-t px-3 py-1.5 text-[10px]" style={{ borderColor: C.line, color: C.text2 }}>
        <span>Markdown · **bold** *italic* ~underline~ ## heading · images supported</span>
        <span>{value.length}/{maxLength}</span>
      </div>
    </div>
  );
}
