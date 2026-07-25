from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from collab.models import Project, ProjectMember, ProjectTask

PROJECTS = [
    {
        'title': 'Cosmic Zine: Issue One',
        'description': 'A community-made zine collecting short stories, art, and poetry from across Outverse worlds.',
        'status': 'active',
        'tasks': [
            {'title': 'Collect submissions', 'status': 'done'},
            {'title': 'Pick cover art', 'status': 'in_progress'},
            {'title': 'Layout and typesetting', 'status': 'todo'},
            {'title': 'Final proofread', 'status': 'todo'},
        ],
    },
    {
        'title': 'Interactive Bedtime Story App',
        'description': 'A branching bedtime story where kids can choose what happens next, built collaboratively by writers and illustrators.',
        'status': 'planning',
        'tasks': [
            {'title': 'Sketch the story tree', 'status': 'in_progress'},
            {'title': 'Write chapter one', 'status': 'todo'},
        ],
    },
    {
        'title': 'Outverse Documentary Shorts',
        'description': 'A three-part video series interviewing creators about their strangest abandoned ideas.',
        'status': 'completed',
        'tasks': [
            {'title': 'Film interviews', 'status': 'done'},
            {'title': 'Edit episode 1', 'status': 'done'},
            {'title': 'Edit episode 2', 'status': 'done'},
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed the Collaboration Hub with demo projects, members, and tasks.'

    def handle(self, *args, **options):
        User = get_user_model()
        users = list(User.objects.order_by('id')[:10])
        if not users:
            self.stdout.write(self.style.WARNING('No users exist yet — create a user before seeding.'))
            return

        created = 0
        for i, spec in enumerate(PROJECTS):
            owner = users[i % len(users)]
            project, was_created = Project.objects.get_or_create(
                title=spec['title'],
                defaults={
                    'description': spec['description'],
                    'status': spec['status'],
                    'owner': owner,
                },
            )
            if was_created:
                created += 1

            ProjectMember.objects.get_or_create(
                project=project, user=owner,
                defaults={'role': 'Owner', 'current_task': spec['tasks'][0]['title'] if spec['tasks'] else ''},
            )
            # Every known user joins as a member of at least one project so the hub
            # shows populated content no matter which demo account is logged in.
            for user in users:
                if user.id == owner.id:
                    continue
                ProjectMember.objects.get_or_create(
                    project=project, user=user,
                    defaults={'role': 'Collaborator', 'current_task': spec['tasks'][-1]['title'] if spec['tasks'] else ''},
                )

            for task_spec in spec['tasks']:
                ProjectTask.objects.get_or_create(
                    project=project,
                    title=task_spec['title'],
                    defaults={'status': task_spec['status'], 'assignee': owner},
                )

        self.stdout.write(self.style.SUCCESS(f'Collaboration Hub ready ({created} new projects).'))
