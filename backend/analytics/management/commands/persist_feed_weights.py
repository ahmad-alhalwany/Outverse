from django.core.management.base import BaseCommand

from analytics.feed_ranker import (
    get_learned_feature_weights,
    maybe_rebuild_stale_interest_vectors,
    persist_feed_weights_snapshot,
)


class Command(BaseCommand):
    help = 'Compute and persist feed ranking feature weights to FeedRankingSnapshot.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--source',
            default='engagement_7d',
            help='Snapshot source label (default: engagement_7d).',
        )

    def handle(self, *args, **options):
        weights = get_learned_feature_weights()
        snapshot = persist_feed_weights_snapshot(weights=weights, source=options['source'])
        maybe_rebuild_stale_interest_vectors()
        self.stdout.write(
            self.style.SUCCESS(
                f'Persisted feed weights snapshot #{snapshot.id} '
                f'(source={snapshot.source}, keys={len(weights)})',
            )
        )
