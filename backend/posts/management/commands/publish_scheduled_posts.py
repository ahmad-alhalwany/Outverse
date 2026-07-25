from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from posts.models import Post, PostMedia, ScheduledMedia, ScheduledPost


class Command(BaseCommand):
    """Publishes due ScheduledPost rows. No task queue (Celery) exists in
    this project, so this is meant to be invoked on a cron/scheduled-task
    timer (e.g. every minute) rather than run continuously."""

    help = 'Publish scheduled posts whose publish_at has passed.'

    def handle(self, *args, **options):
        due = ScheduledPost.objects.filter(status='pending', publish_at__lte=timezone.now())
        published, failed = 0, 0
        for scheduled in due:
            try:
                with transaction.atomic():
                    post = self._publish(scheduled)
                    scheduled.status = 'published'
                    scheduled.published_post = post
                    scheduled.error = ''
                    scheduled.save(update_fields=['status', 'published_post', 'error'])
                published += 1
            except Exception as exc:
                scheduled.status = 'failed'
                scheduled.error = str(exc)[:255]
                scheduled.save(update_fields=['status', 'error'])
                failed += 1
        self.stdout.write(self.style.SUCCESS(f'Published {published}, failed {failed}.'))

    def _publish(self, scheduled):
        payload = scheduled.payload or {}
        text = (payload.get('text') or '').strip()
        if not text:
            raise ValueError('payload.text is empty.')

        from subscriptions.models import CreatorTier

        required_tier_id = payload.get('required_tier_id')
        if required_tier_id and not CreatorTier.objects.filter(
            pk=required_tier_id, creator_id=scheduled.user_id,
        ).exists():
            required_tier_id = None

        post = Post.objects.create(
            user=scheduled.user,
            post_type='normal',
            text=text,
            mood=payload.get('mood', ''),
            tags=payload.get('tags') or [],
            visibility=payload.get('visibility') or 'public',
            required_tier_id=required_tier_id,
        )

        community_id = payload.get('community_id')
        if community_id:
            from communities.models import Community

            community = Community.objects.filter(pk=community_id).first()
            if community and community.memberships.filter(user_id=scheduled.user_id, status='approved').exists():
                post.community = community
                post.save(update_fields=['community'])
                Community.objects.filter(pk=community.id).update(posts_count=F('posts_count') + 1)

        self._publish_media(scheduled, post)
        return post

    def _publish_media(self, scheduled, post):
        payload = scheduled.payload or {}
        media_ids = payload.get('media_ids') or []
        if not isinstance(media_ids, (list, tuple)):
            media_ids = []
        media_qs = ScheduledMedia.objects.filter(scheduled_post=scheduled)
        payload_media = media_qs.filter(id__in=media_ids)
        media_by_id = {media.id: media for media in media_qs.order_by('order', 'id')}
        for media in payload_media:
            media_by_id.setdefault(media.id, media)
        for idx, media in enumerate(sorted(media_by_id.values(), key=lambda item: (item.order, item.id))):
            PostMedia.objects.create(
                post=post,
                media_file=media.media_file,
                media_type=media.media_type,
                order=idx,
            )
