from datetime import timedelta
from types import SimpleNamespace
from unittest import TestCase as PlainTestCase

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from posts.models import Post

from .feed_ranker import (
    COLD_BASE_MULTIPLIER,
    COLD_CREATIVITY_MULTIPLIER,
    DEFAULT_FEATURE_WEIGHTS,
    EVERGREEN_POOL_SIZE,
    score_post,
    rank_for_you_queryset,
)

User = get_user_model()


def _fake_post(**overrides):
    defaults = dict(
        id=1, user_id=1, post_type='normal', mood='', tags=[],
        likes_count=0, comments_count=0, shares_count=0, reposts_count=0,
        views=0, inspiration_question_id=None, is_boosted=False,
        created_at=timezone.now(),
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


class ColdStartWeightTests(PlainTestCase):
    """score_post() is a pure function — no DB needed to test the cold-start bias."""

    def test_cold_weights_favor_creativity_over_base(self):
        now = timezone.now()
        creative_post = _fake_post(id=1, user_id=1, post_type='question', created_at=now)
        popular_post = _fake_post(id=2, user_id=2, likes_count=50, comments_count=20, created_at=now)

        warm_weights = DEFAULT_FEATURE_WEIGHTS
        cold_weights = dict(DEFAULT_FEATURE_WEIGHTS)
        cold_weights['creativity'] *= COLD_CREATIVITY_MULTIPLIER
        cold_weights['base'] *= COLD_BASE_MULTIPLIER

        def score(post, weights):
            return score_post(
                post, affinity={}, following_ids=set(), interests=[], now=now,
                feature_weights=weights,
            )

        warm_gap = score(popular_post, warm_weights) - score(creative_post, warm_weights)
        cold_gap = score(popular_post, cold_weights) - score(creative_post, cold_weights)

        # The popular post's lead over the creative one must shrink once the
        # cold-start weights kick in — that's the whole point of the bias.
        self.assertLess(cold_gap, warm_gap)


class EvergreenPoolTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='viewer', password='x')
        self.author = User.objects.create_user(username='author', password='x')

    def test_old_high_engagement_post_is_reachable(self):
        old_post = Post.objects.create(
            user=self.author, text='old but great', likes_count=100, comments_count=40,
        )
        Post.objects.filter(id=old_post.id).update(
            created_at=timezone.now() - timedelta(days=90),
        )
        for i in range(5):
            Post.objects.create(user=self.author, text=f'recent {i}')

        ranked = list(rank_for_you_queryset(Post.objects.all(), self.user))
        self.assertIn(old_post.id, [p.id for p in ranked])

    def test_evergreen_pool_size_is_bounded(self):
        self.assertGreater(EVERGREEN_POOL_SIZE, 0)
