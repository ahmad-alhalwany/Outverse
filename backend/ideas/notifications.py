"""Idea Bazaar notification helpers."""

from notifications.utils import create_notification


def _actor_name(user) -> str:
    if not user:
        return 'Someone'
    full = f'{user.first_name or ""} {user.last_name or ""}'.strip()
    return full or user.username or 'Someone'


def notify_idea_pledge(*, idea, actor, amount: int):
    create_notification(
        recipient_id=idea.owner_id,
        actor_id=actor.id,
        verb='idea_pledge',
        idea=idea,
        text=f'pledged {amount} coins to "{idea.title[:40]}"',
        notification_type='idea_pledge',
    )


def notify_idea_comment(*, idea, actor):
    create_notification(
        recipient_id=idea.owner_id,
        actor_id=actor.id,
        verb='idea_comment',
        idea=idea,
        text=f'commented on "{idea.title[:40]}"',
        notification_type='idea_comment',
    )


def notify_idea_apply(*, idea, actor, role: str):
    create_notification(
        recipient_id=idea.owner_id,
        actor_id=actor.id,
        verb='idea_apply',
        idea=idea,
        text=f'applied as {role} on "{idea.title[:40]}"',
        notification_type='idea_apply',
    )


def notify_idea_application_response(*, idea, applicant, accepted: bool):
    create_notification(
        recipient_id=applicant.id,
        actor_id=idea.owner_id,
        verb='idea_accepted' if accepted else 'idea_rejected',
        idea=idea,
        text=(
            f'accepted your collaboration on "{idea.title[:40]}"'
            if accepted
            else f'declined your collaboration on "{idea.title[:40]}"'
        ),
        notification_type='idea_accepted' if accepted else 'idea_rejected',
    )
