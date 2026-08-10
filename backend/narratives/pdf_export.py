"""Export approved Story Forge chapters as a simple PDF."""

from __future__ import annotations

from io import BytesIO


def _escape_pdf_text(text: str) -> str:
    return (
        (text or '')
        .replace('\\', '\\\\')
        .replace('(', '\\(')
        .replace(')', '\\)')
    )


def build_story_pdf(
    *,
    title: str,
    premise: str,
    genre: str,
    owner_name: str,
    segments: list[dict],
) -> bytes:
    """Minimal single-page-stream PDF (no external deps).

    ``segments`` items: ``{order, content, author}``.
    """
    lines: list[str] = [
        f'Title: {title}',
        f'Genre: {genre}',
        f'Author / owner: {owner_name}',
        '',
        'Premise:',
        premise or '',
        '',
        '--- Chapters ---',
        '',
    ]
    for seg in segments:
        lines.append(f"Part {seg.get('order', '?')} — {seg.get('author') or 'Anonymous'}")
        lines.append(seg.get('content') or '')
        lines.append('')

    # PDF text objects use Helvetica; strip non-latin for reliable embedding.
    body = '\n'.join(lines)
    ascii_body = body.encode('latin-1', errors='replace').decode('latin-1')
    escaped = _escape_pdf_text(ascii_body)

    # Simple multi-line text via Tj with newlines replaced by T* style manually.
    content_ops = ['BT', '/F1 11 Tf', '50 780 Td', '14 TL']
    first = True
    for raw_line in ascii_body.split('\n'):
        line = _escape_pdf_text(raw_line[:110])
        if first:
            content_ops.append(f'({line}) Tj')
            first = False
        else:
            content_ops.append('T*')
            content_ops.append(f'({line}) Tj')
    content_ops.append('ET')
    stream = '\n'.join(content_ops).encode('latin-1', errors='replace')

    objects: list[bytes] = []
    objects.append(b'1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n')
    objects.append(b'2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n')
    objects.append(
        b'3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
        b'/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n'
    )
    objects.append(
        f'4 0 obj<< /Length {len(stream)} >>stream\n'.encode('latin-1')
        + stream
        + b'\nendstream\nendobj\n'
    )
    objects.append(b'5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n')

    out = BytesIO()
    out.write(b'%PDF-1.4\n')
    offsets = [0]
    for obj in objects:
        offsets.append(out.tell())
        out.write(obj)
    xref_pos = out.tell()
    out.write(f'xref\n0 {len(objects) + 1}\n'.encode('latin-1'))
    out.write(b'0000000000 65535 f \n')
    for off in offsets[1:]:
        out.write(f'{off:010d} 00000 n \n'.encode('latin-1'))
    out.write(
        f'trailer<< /Size {len(objects) + 1} /Root 1 0 R >>\n'
        f'startxref\n{xref_pos}\n%%EOF\n'.encode('latin-1')
    )
    return out.getvalue()
