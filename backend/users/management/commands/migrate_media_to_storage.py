"""
One-time migration: upload every file in the local MEDIA_ROOT to the
configured S3-compatible storage backend, preserving relative paths so
existing model FileField/ImageField values keep resolving correctly.

Run this once after setting AWS_STORAGE_BUCKET_NAME (and the matching
AWS_* env vars) to move existing uploads off local disk and onto the
CDN-fronted bucket. Safe to re-run — already-uploaded files are skipped.
"""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.files.base import File
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        'Upload every file in the local MEDIA_ROOT to the configured S3-compatible '
        'storage backend, preserving relative paths. Requires AWS_STORAGE_BUCKET_NAME '
        'to be set. Safe to re-run — files already present in the target storage are skipped.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='List what would be uploaded without actually uploading.',
        )

    def handle(self, *args, **options):
        if not getattr(settings, 'USE_S3_MEDIA_STORAGE', False):
            raise CommandError(
                'AWS_STORAGE_BUCKET_NAME is not set — configure S3/R2 storage in your '
                'environment (see outverse/settings.py) before running this migration.'
            )

        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.is_dir():
            self.stdout.write(self.style.WARNING(f'No local media directory found at {media_root}.'))
            return

        dry_run = options['dry_run']
        uploaded = 0
        skipped = 0
        failed = 0

        for local_path in sorted(media_root.rglob('*')):
            if not local_path.is_file():
                continue
            relative_name = local_path.relative_to(media_root).as_posix()

            if default_storage.exists(relative_name):
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(f'[DRY RUN] Would upload: {relative_name}')
                uploaded += 1
                continue

            try:
                with open(local_path, 'rb') as fh:
                    default_storage.save(relative_name, File(fh))
                uploaded += 1
            except Exception as e:
                failed += 1
                self.stderr.write(self.style.ERROR(f'Failed to upload {relative_name}: {e}'))

        verb = 'Would upload' if dry_run else 'Uploaded'
        self.stdout.write(self.style.SUCCESS(
            f'{verb}: {uploaded}, skipped (already present): {skipped}, failed: {failed}'
        ))
