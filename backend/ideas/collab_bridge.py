"""Bridge Bazaar ideas into Collab Hub projects."""

from __future__ import annotations

from collab.models import Project, ProjectMember, ProjectTask


def _ensure_crew_chat_room(project, idea):
    """Best-effort group room for the collab crew."""
    try:
        from chat.models import ChatRoom
    except Exception:
        return None

    room_name = f'Crew: {idea.title[:80]}'
    room = (
        ChatRoom.objects.filter(name=room_name, created_by=idea.owner)
        .order_by('-created_at')
        .first()
    )
    if room is None:
        room = ChatRoom.objects.create(name=room_name, created_by=idea.owner)
    member_ids = {idea.owner_id, *idea.collaborators.values_list('id', flat=True)}
    room.members.add(*member_ids)
    return room


def sync_collab_project(idea, *, new_member=None, member_role: str = ''):
    """Ensure a Collab project exists for this idea and sync members/tasks."""
    try:
        project = idea.collab_project
    except Project.DoesNotExist:
        project = None

    if project is None:
        project = Project.objects.create(
            title=idea.title[:200],
            description=(idea.description or '')[:2000],
            status='active' if idea.status in ('in_progress', 'completed') else 'planning',
            owner=idea.owner,
            source_idea=idea,
        )
        ProjectMember.objects.get_or_create(
            project=project,
            user=idea.owner,
            defaults={'role': 'Owner'},
        )
        for collab_user in idea.collaborators.all():
            ProjectMember.objects.get_or_create(
                project=project,
                user=collab_user,
                defaults={'role': 'Collaborator'},
            )
        _seed_role_tasks(project, idea)

    if new_member:
        ProjectMember.objects.get_or_create(
            project=project,
            user=new_member,
            defaults={'role': (member_role or 'Collaborator')[:64]},
        )

    _sync_idea_milestones(project, idea)
    _ensure_crew_chat_room(project, idea)
    return project


def _sync_idea_milestones(project, idea):
    """Seed project tasks from idea milestones when none exist yet."""
    if not idea.milestones or project.tasks.exists():
        return
    for item in idea.milestones[:12]:
        if not isinstance(item, dict):
            continue
        title = (item.get('title') or '').strip()
        if not title:
            continue
        status = 'done' if item.get('done') else 'todo'
        ProjectTask.objects.get_or_create(
            project=project,
            title=title[:200],
            defaults={'status': status},
        )


def _seed_role_tasks(project, idea):
    if project.tasks.exists():
        return
    for raw_role in (idea.roles_needed or [])[:8]:
        role = str(raw_role).strip()
        if not role:
            continue
        ProjectTask.objects.create(
            project=project,
            title=f'Role: {role}'[:200],
            status='todo',
        )
