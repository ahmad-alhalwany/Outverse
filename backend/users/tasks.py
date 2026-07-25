"""
Async tasks for users app.
"""
from __future__ import annotations

import json
import zipfile
import tempfile
import os
from datetime import timedelta
from django.utils import timezone
from django.conf import settings

# Celery tasks (replace with actual Celery task decorator when Celery is configured)
# from celery import shared_task


def _process_gdpr_export(export_id: int):
    """
    Process GDPR data export asynchronously.
    Creates a ZIP file with all user data in JSON format.
    """
    from users.models import GDPRExport, User
    from django.contrib.auth import get_user_model
    from posts.models import Post, Comment, Reaction, SavedPost, PostVote
    from reels.models import Reel, ReelComment, ReelLike, SavedReel
    from stories.models import Story
    from bottles.models import MessageBottle
    from chat.models import ChatRoom, ChatMessage
    from communities.models import Community, CommunityMembership
    from subscriptions.models import CreatorSubscription, CreatorSubscriptionPayout
    from shop.models import ShopItem, Order
    from capsules.models import TimeCapsule
    from questions.models import Question, RitualParticipation
    from notifications.models import Notification

    User = get_user_model()

    try:
        export = GDPRExport.objects.get(id=export_id)
    except GDPRExport.DoesNotExist:
        return

    export.status = 'processing'
    export.save(update_fields=['status'])

    user = export.user

    try:
        # Create temporary directory for export files
        with tempfile.TemporaryDirectory() as tmpdir:
            # User profile
            profile_data = {
                'id': export.user.id,
                'username': export.user.username,
                'email': export.user.email,
                'first_name': export.user.first_name,
                'last_name': export.user.last_name,
                'bio': export.user.bio,
                'location': export.user.location,
                'is_verified': export.user.is_verified,
                'badge_verified': export.user.badge_verified,
                'is_staff': export.user.is_staff,
                'date_joined': export.user.date_joined.isoformat() if export.user.date_joined else None,
                'last_login': export.user.last_login.isoformat() if export.user.last_login else None,
                'interests': export.user.interests,
                'spender_tier': export.user.spender_tier,
            }
            _write_json(tmpdir, 'profile.json', profile_data)

            # Posts
            posts = list(Post.objects.filter(user_id=export.user.id).values(
                'id', 'post_type', 'text', 'mood', 'tags', 'visibility',
                'reply_control', 'created_at', 'views', 'comments_count',
                'likes_count', 'shares_count', 'reposts_count',
                'inspiration_question_id', 'community_id'
            ))
            _write_json(tmpdir, 'posts.json', posts)

            # Comments
            comments = list(Comment.objects.filter(user_id=export.user.id).values(
                'id', 'post_id', 'parent_id', 'text', 'gif_url', 'sticker_url',
                'created_at', 'edited_at', 'pin_order', 'sparked_by_author'
            ))
            _write_json(tmpdir, 'comments.json', comments)

            # Reactions
            reactions = list(Reaction.objects.filter(user_id=export.user.id).values(
                'id', 'post_id', 'type', 'created_at'
            ))
            _write_json(tmpdir, 'reactions.json', reactions)

            # Saved posts
            saved = list(SavedPost.objects.filter(user_id=export.user.id).values(
                'id', 'post_id', 'collection_id', 'created_at'
            ))
            _write_json(tmpdir, 'saved_posts.json', saved)

            # Reels
            reels = list(Reel.objects.filter(user_id=export.user.id).values(
                'id', 'caption', 'mood', 'tags', 'visibility', 'music_track_id',
                'filter_style', 'is_active', 'created_at', 'views',
                'likes_count', 'comments_count', 'shares_count'
            ))
            _write_json(tmpdir, 'reels.json', reels)

            # Reel comments
            reel_comments = list(ReelComment.objects.filter(user_id=export.user.id).values(
                'id', 'reel_id', 'parent_id', 'text', 'gif_url', 'sticker_url', 'created_at'
            ))
            _write_json(tmpdir, 'reel_comments.json', reel_comments)

            # Reel likes
            reel_likes = list(ReelLike.objects.filter(user_id=export.user.id).values(
                'id', 'reel_id', 'type', 'created_at'
            ))
            _write_json(tmpdir, 'reel_likes.json', reel_likes)

            # Saved reels
            saved_reels = list(SavedReel.objects.filter(user_id=export.user.id).values(
                'id', 'reel_id', 'created_at'
            ))
            _write_json(tmpdir, 'saved_reels.json', saved_reels)

            # Stories
            stories = list(Story.objects.filter(user_id=export.user.id).values(
                'id', 'text', 'mood', 'background_type', 'background_value',
                'visibility', 'expires_at', 'created_at'
            ))
            _write_json(tmpdir, 'stories.json', stories)

            # Follows
            from users.models import Follow
            follows = list(export.user.following.values('following_id', 'created_at'))
            followers = list(export.user.followers.values('follower_id', 'created_at'))
            _write_json(tmpdir, 'follows.json', {
                'following': follows,
                'followers': followers,
            })

            # Blocks, mutes, restricts
            from users.models import UserBlock, UserMute, UserRestrict
            blocks = list(UserBlock.objects.filter(blocker_id=export.user.id).values('blocked_id', 'created_at'))
            blocked_by = list(UserBlock.objects.filter(blocked_id=export.user.id).values('blocker_id', 'created_at'))
            mutes = list(UserMute.objects.filter(muter_id=export.user.id).values('muted_id', 'created_at'))
            restricts = list(UserRestrict.objects.filter(restricter_id=export.user.id).values('restricted_id', 'created_at'))
            _write_json(tmpdir, 'social_controls.json', {
                'blocks': blocks,
                'blocked_by': blocked_by,
                'mutes': mutes,
                'restricts': restricts,
            })

            # Bottles
            bottles = list(MessageBottle.objects.filter(user_id=export.user.id).values(
                'id', 'message', 'mood', 'latitude', 'longitude', 'status', 'created_at', 'opened_at'
            ))
            _write_json(tmpdir, 'bottles.json', bottles)

            # Chat rooms
            rooms = list(ChatRoom.objects.filter(members=export.user).values(
                'id', 'name', 'room_type', 'created_at'
            ))
            _write_json(tmpdir, 'chat_rooms.json', rooms)

            # Chat messages (last 1000 to limit size)
            messages = list(ChatMessage.objects.filter(user_id=export.user.id).order_by('-created_at')[:1000].values(
                'id', 'room_id', 'text', 'message_type', 'created_at'
            ))
            _write_json(tmpdir, 'chat_messages.json', messages)

            # Communities
            memberships = list(CommunityMembership.objects.filter(user_id=export.user.id).values(
                'id', 'community_id', 'is_moderator', 'status', 'joined_at'
            ))
            _write_json(tmpdir, 'community_memberships.json', memberships)

            # Subscriptions
            subs = list(CreatorSubscription.objects.filter(fan_id=export.user.id).values(
                'id', 'creator_id', 'tier_id', 'status', 'current_period_end', 'created_at'
            ))
            _write_json(tmpdir, 'creator_subscriptions.json', subs)

            # Shop orders
            orders = list(Order.objects.filter(user_id=export.user.id).values(
                'id', 'item_id', 'quantity', 'total_cents', 'status', 'created_at'
            ))
            _write_json(tmpdir, 'shop_orders.json', orders)

            # Time capsules
            capsules = list(TimeCapsule.objects.filter(user_id=export.user.id).values(
                'id', 'title', 'message', 'unlock_at', 'opened_at', 'status', 'created_at'
            ))
            _write_json(tmpdir, 'time_capsules.json', capsules)

            # Questions & rituals
            questions = list(Question.objects.filter(user_id=export.user.id).values(
                'id', 'text', 'category', 'is_active', 'created_at'
            ))
            rituals = list(RitualParticipation.objects.filter(user_id=export.user.id).values(
                'id', 'question_id', 'date', 'response', 'created_at'
            ))
            _write_json(tmpdir, 'questions.json', {
                'questions': questions,
                'rituals': rituals,
            })

            # Notifications
            notifications = list(Notification.objects.filter(user_id=export.user.id).values(
                'id', 'actor_id', 'verb', 'post_id', 'reel_id', 'story_id',
                'read', 'created_at'
            )[:5000])  # Limit to last 5000
            _write_json(tmpdir, 'notifications.json', notifications)

            # Preferences
            from preferences.models import UserPreferences
            prefs = UserPreferences.objects.filter(user_id=export.user.id).first()
            if prefs:
                _write_json(tmpdir, 'preferences.json', {
                    'locale': prefs.locale,
                    'theme': prefs.theme,
                    'profile_visibility': prefs.profile_visibility,
                    'bottle_privacy': prefs.bottle_privacy,
                    'online_status_visible': prefs.online_status_visible,
                    'read_receipts_enabled': prefs.read_receipts_enabled,
                    'weirdness_level': prefs.weirdness_level,
                    'dm_policy': prefs.dm_policy,
                    'comment_policy': prefs.comment_policy,
                    'mention_policy': prefs.mention_policy,
                    'tag_policy': prefs.tag_policy,
                    'hidden_words': prefs.hidden_words,
                    'quiet_hours_start': str(prefs.quiet_hours_start) if prefs.quiet_hours_start else None,
                    'quiet_hours_end': str(prefs.quiet_hours_end) if prefs.quiet_hours_end else None,
                })

            # Create ZIP
            zip_path = os.path.join(settings.MEDIA_ROOT, 'gdpr_exports', f'export_{export.id}.zip')
            os.makedirs(os.path.dirname(zip_path), exist_ok=True)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(tmpdir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, tmpdir)
                        zf.write(file_path, arcname)

            # Update export record
            export.status = 'completed'
            export.file_path = zip_path
            export.file_size = os.path.getsize(zip_path)
            export.completed_at = timezone.now()
            export.save(update_fields=['status', 'file_path', 'file_size', 'completed_at'])

    except Exception as e:
        export.status = 'failed'
        export.error_message = str(e)
        export.save(update_fields=['status', 'error_message'])


def _write_json(tmpdir: str, filename: str, data):
    """Helper to write JSON file to temp directory."""
    import os
    import json
    from django.core.serializers.json import DjangoJSONEncoder

    path = os.path.join(tmpdir, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2)


# For non-Celery environments, run inline
def _process_gdpr_export_inline(export_id: int):
    """Run export inline (for non-Celery environments)."""
    _process_gdpr_export(export_id)


# Celery task wrapper (uncomment when Celery is configured)
# @shared_task
def process_gdpr_export(export_id: int):
    _process_gdpr_export(export_id)


# Inline delay function for non-Celery environments
def _delay_inline(export_id: int):
    """Run export inline with error handling."""
    try:
        _process_gdpr_export(export_id)
    except Exception as e:
        from users.models import GDPRExport
        try:
            export = GDPRExport.objects.get(id=export_id)
            export.status = 'failed'
            export.error_message = str(e)
            export.save(update_fields=['status', 'error_message'])
        except GDPRExport.DoesNotExist:
            pass


# Celery-style delay (replace with actual Celery when available)
def delay(export_id: int):
    """Queue export processing."""
    # For now, run inline. Replace with actual Celery task when available.
    _delay_inline(export_id)


# Export for use in views
_process_gdpr_export = delay