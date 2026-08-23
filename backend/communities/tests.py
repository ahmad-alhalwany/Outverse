from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import Community, CommunityRitualParticipation
from .ritual import complete_ritual, current_streak, get_today_prompt

User = get_user_model()


class CommunityRitualTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='x')
        self.community = Community.objects.create(name='Test Space', slug='test-space')

    def test_prompt_is_stable_within_a_day(self):
        self.assertEqual(get_today_prompt(self.community), get_today_prompt(self.community))

    def test_complete_and_streak(self):
        self.assertEqual(current_streak(self.community, self.user), 0)
        complete_ritual(self.community, self.user)
        self.assertEqual(current_streak(self.community, self.user), 1)
        CommunityRitualParticipation.objects.create(
            community=self.community, user=self.user,
            date=timezone.now().date() - timedelta(days=1),
            completed_at=timezone.now(),
        )
        self.assertEqual(current_streak(self.community, self.user), 2)
