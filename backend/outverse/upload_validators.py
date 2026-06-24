import os

from django.core.exceptions import ValidationError


MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_AUDIO_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_FILE_UPLOAD_BYTES = 25 * 1024 * 1024

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.webm', '.m4v'}
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.ogg', '.m4a'}
DOCUMENT_EXTENSIONS = {'.pdf', '.txt', '.doc', '.docx'}

IMAGE_CONTENT_TYPES = {
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
}
VIDEO_CONTENT_TYPES = {
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
}
AUDIO_CONTENT_TYPES = {
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/mp4',
    'audio/x-m4a',
}
DOCUMENT_CONTENT_TYPES = {
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}


def _validate_upload(value, *, allowed_extensions, allowed_content_types, max_bytes, label):
    if not value:
        return
    extension = os.path.splitext(value.name or '')[1].lower()
    if extension not in allowed_extensions:
        raise ValidationError(f'Unsupported {label} file extension.')
    content_type = (getattr(value, 'content_type', '') or '').lower()
    if content_type not in allowed_content_types:
        raise ValidationError(f'Unsupported {label} content type.')
    if value.size > max_bytes:
        raise ValidationError(f'{label.capitalize()} file exceeds size limit.')


def validate_image_upload(value):
    _validate_upload(
        value,
        allowed_extensions=IMAGE_EXTENSIONS,
        allowed_content_types=IMAGE_CONTENT_TYPES,
        max_bytes=MAX_IMAGE_UPLOAD_BYTES,
        label='image',
    )


def validate_video_upload(value):
    _validate_upload(
        value,
        allowed_extensions=VIDEO_EXTENSIONS,
        allowed_content_types=VIDEO_CONTENT_TYPES,
        max_bytes=MAX_VIDEO_UPLOAD_BYTES,
        label='video',
    )


def validate_audio_upload(value):
    _validate_upload(
        value,
        allowed_extensions=AUDIO_EXTENSIONS,
        allowed_content_types=AUDIO_CONTENT_TYPES,
        max_bytes=MAX_AUDIO_UPLOAD_BYTES,
        label='audio',
    )


def validate_generic_upload(value):
    _validate_upload(
        value,
        allowed_extensions=IMAGE_EXTENSIONS | AUDIO_EXTENSIONS | DOCUMENT_EXTENSIONS,
        allowed_content_types=IMAGE_CONTENT_TYPES | AUDIO_CONTENT_TYPES | DOCUMENT_CONTENT_TYPES,
        max_bytes=MAX_FILE_UPLOAD_BYTES,
        label='file',
    )