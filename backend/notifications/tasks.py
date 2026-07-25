"""
Email notification and digest tasks.
"""
from __future__ import annotations

from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mass_mail
from django.db.models import Count, Q
from django.utils.html import strip_tags


def _send_email_batch(emails: list[tuple[str, str, str, list[str]]]):
    """Send a batch of emails. Each email is (subject, message, from_email, recipient_list)."""
    if not emails:
        return 0
    try:
        sent = send_mass_mail(emails, fail_silently=False)
        return sent
    except Exception as e:
        # Log error in production
        print(f"Email batch send failed: {e}")
        return 0


def build_digest_html(user, notifications: list, digest_type: str) -> str:
    """Build HTML email for daily/weekly digest."""
    if not notifications:
        return ""
    
    # Group by type
    by_type = {}
    for n in notifications:
        key = n.verb
        if key not in by_type:
            by_type[key] = []
        by_type[key].append(n)
    
    sections = []
    for verb, items in by_type.items():
        sections.append(f"""
        <h3 style="color: #1a1a2e; border-bottom: 2px solid #6366f1; padding-bottom: 8px;">
            {verb.replace('_', ' ').title()} ({len(items)})
        </h3>
        <ul style="list-style: none; padding: 0;">
        {''.join(f'<li style="margin: 8px 0;">{strip_tags(i.text)}</li>' for i in items[:10])}
        {'<li style="color: #64748b; font-size: 14px;">...and ' + str(len(items) - 10) + ' more</li>' if len(items) > 10 else ''}
        </ul>
        """)
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Outverse</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Your {digest_type} digest</p>
        </div>
        
        <p style="font-size: 16px;">Hi <strong>{strip_tags(user.username)}</strong>,</p>
        <p style="font-size: 16px;">Here's what happened while you were away:</p>
        
        {''.join(sections)}
        
        <div style="margin-top: 32px; padding: 16px; background: #f1f5f9; border-radius: 8px; text-align: center;">
            <a href="https://outverse.app/notifications" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                View all notifications
            </a>
        </div>
        
        <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 32px;">
            You received this because you have email notifications enabled.<br>
            <a href="https://outverse.app/settings/notifications" style="color: #64748b;">Manage preferences</a>
        </p>
    </body>
    </html>
    """
    return html


def build_digest_text(user, notifications: list, digest_type: str) -> str:
    """Build plain text version of digest."""
    if not notifications:
        return ""
    
    lines = [f"Your {digest_type} Outverse digest", "=" * 40, ""]
    
    by_type = {}
    for n in notifications:
        key = n.verb
        if key not in by_type:
            by_type[key] = []
        by_type[key].append(n)
    
    for verb, items in by_type.items():
        lines = [f"{verb.replace('_', ' ').title()} ({len(items)})", "-" * 20]
        for item in items[:10]:
            lines.append(f"  • {strip_tags(item.text)}")
        if len(items) > 10:
            lines.append(f"  ...and {len(items) - 10} more")
        lines.append("")
    
    lines.append("View all: https://outverse.app/notifications")
    return "\n".join(lines)


def _send_digest_email(user, notifications, digest_type, dry_run=False):
    """Send a single digest email to a user."""
    if not notifications:
        return 0
    
    html = build_digest_html(user, notifications, digest_type)
    text = build_digest_text(user, notifications, digest_type)
    
    subject = f"Your {digest_type} Outverse digest"
    from_email = settings.DEFAULT_FROM_EMAIL
    
    if dry_run:
        print(f"[DRY RUN] Would send {digest_type} digest to {user.email} with {len(notifications)} notifications")
        return 1
    
    try:
        from django.core.mail import EmailMultiAlternatives
        email = EmailMultiAlternatives(
            subject=subject,
            body=build_digest_text(user, notifications, digest_type),
            from_email=from_email,
            to=[user.email],
        )
        email.attach_alternative(build_digest_html(user, notifications, digest_type), "text/html")
        email.send(fail_silently=False)
        return 1
    except Exception as e:
        print(f"Failed to send digest to {user.email}: {e}")
        return 0


def send_daily_digests(dry_run=False):
    """Send daily digest emails to users with daily frequency preference."""
    from django.contrib.auth import get_user_model
    from django.db.models import Prefetch
    from notifications.models import Notification, EmailPreference
    
    User = get_user_model()
    
    # Get users with daily digest preference
    now = timezone.now()
    yesterday = now - timedelta(days=1)
    
    users = User.objects.filter(
        email_preferences__digest_frequency='daily',
        email_preferences__digest_time__lte=timezone.now().time(),
    ).select_related('email_preferences').prefetch_related(
        Prefetch(
            'notifications',
            queryset=Notification.objects.filter(
                created_at__gte=yesterday,
                created_at__lt=now,
            ).select_related('actor', 'post', 'reel', 'story'),
            to_attr='recent_notifications'
        )
    )
    
    sent = 0
    for user in users:
        prefs = user.email_preferences
        # Filter notifications based on user preferences
        notifications = user.recent_notifications
        
        # Filter by notification type preferences
        filtered = []
        for n in notifications:
            if n.verb == 'reaction' and not prefs.likes:
                continue
            elif n.verb == 'comment' and not prefs.comments:
                continue
            elif n.verb == 'follow' and not prefs.follows:
                continue
            elif n.verb == 'mention' and not prefs.mentions:
                continue
            elif n.verb == 'share' and not prefs.shares:
                continue
            elif n.verb == 'tip' and not prefs.tips:
                continue
            elif n.verb == 'reaction' and not prefs.story_reactions:
                continue
            elif n.verb == 'follow' and not prefs.new_follower:
                continue
            filtered.append(n)
        
        sent += _send_digest_email(user, filtered, 'daily', dry_run)
    
    return sent


def send_weekly_digests(dry_run=False):
    """Send weekly digest emails to users with weekly frequency preference."""
    from django.contrib.auth import get_user_model
    from django.db.models import Prefetch
    from notifications.models import Notification, EmailPreference
    
    User = get_user_model()
    
    # Get users with weekly digest preference
    now = timezone.now()
    week_ago = now - timedelta(days=7)
    
    users = User.objects.filter(
        email_preferences__digest_frequency='weekly',
        email_preferences__digest_time__lte=timezone.now().time(),
    ).select_related('email_preferences').prefetch_related(
        Prefetch(
            'notifications',
            queryset=Notification.objects.filter(
                created_at__gte=week_ago,
                created_at__lt=now,
            ).select_related('actor', 'post', 'reel', 'story'),
            to_attr='recent_notifications'
        )
    )
    
    sent = 0
    for user in users:
        prefs = user.email_preferences
        notifications = user.recent_notifications
        
        filtered = []
        for n in notifications:
            if n.verb == 'reaction' and not prefs.likes:
                continue
            elif n.verb == 'comment' and not prefs.comments:
                continue
            elif n.verb == 'follow' and not prefs.follows:
                continue
            elif n.verb == 'mention' and not prefs.mentions:
                continue
            elif n.verb == 'share' and not prefs.shares:
                continue
            elif n.verb == 'tip' and not prefs.tips:
                continue
            elif n.verb == 'reaction' and not prefs.story_reactions:
                continue
            elif n.verb == 'follow' and not prefs.new_follower:
                continue
            filtered.append(n)
        
        sent += _send_digest_email(user, filtered, 'weekly', dry_run)
    
    return sent


# Celery task wrappers (uncomment when Celery is configured)
# @shared_task
def task_send_daily_digests():
    return send_daily_digests()


# @shared_task
def task_send_weekly_digests():
    return send_weekly_digests()


# @shared_task
def task_send_notification_email(notification_id):
    """Send immediate email for a specific notification (for high-priority types)."""
    from notifications.models import Notification, EmailPreference
    from django.contrib.auth import get_user_model
    from django.core.mail import EmailMultiAlternatives
    from django.conf import settings
    
    User = get_user_model()
    
    try:
        notification = Notification.objects.select_related('recipient').get(id=notification_id)
    except Notification.DoesNotExist:
        return 0
    
    user = notification.recipient
    prefs = EmailPreference.objects.filter(user=user).first()
    
    # Check if user wants email for this notification type
    if prefs:
        if notification.verb == 'reaction' and not prefs.likes:
            return 0
        elif notification.verb == 'comment' and not prefs.comments:
            return 0
        elif notification.verb == 'follow' and not prefs.follows:
            return 0
        elif notification.verb == 'mention' and not prefs.mentions:
            return 0
        elif notification.verb == 'share' and not prefs.shares:
            return 0
        elif notification.verb == 'tip' and not prefs.tips:
            return 0
        elif notification.verb == 'reaction' and not prefs.story_reactions:
            return 0
        elif notification.verb == 'follow' and not prefs.new_follower:
            return 0
    
    # Send email
    subject = f"Outverse: {notification.text[:60]}"
    text = f"{notification.text}\n\nView: https://outverse.app/notifications"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 16px;">
            <h1 style="color: white; margin: 0;">Outverse</h1>
        </div>
        <p style="font-size: 16px;">{strip_tags(notification.text)}</p>
        <div style="text-align: center; margin-top: 24px;">
            <a href="https://outverse.app/notifications" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                View notification
            </a>
        </div>
    """
    
    try:
        email = EmailMultiAlternatives(
            subject=subject,
            body=text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[notification.recipient.email],
        )
        email.attach_alternative(html, "text/html")
        email.send(fail_silently=False)
        return 1
    except Exception as e:
        print(f"Failed to send notification email: {e}")
        return 0