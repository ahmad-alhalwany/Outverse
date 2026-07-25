from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from notifications.marketing import send_campaign
from notifications.models import MarketingCampaign


class Command(BaseCommand):
    help = (
        'Send a marketing campaign (by id) to its resolved segment. Normally campaigns '
        'are sent via the admin UI (synchronous send-on-click); use this command to '
        'retry a campaign or trigger it from an external scheduler instead.'
    )

    def add_arguments(self, parser):
        parser.add_argument('campaign_id', type=int)
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Log recipients without actually sending email.',
        )

    def handle(self, *args, **options):
        try:
            campaign = MarketingCampaign.objects.get(id=options['campaign_id'])
        except MarketingCampaign.DoesNotExist:
            raise CommandError('Campaign not found.')
        if campaign.status == 'sent' and not options['dry_run']:
            raise CommandError('Campaign already sent.')

        dry_run = options['dry_run']
        if not dry_run:
            campaign.status = 'sending'
            campaign.save(update_fields=['status'])

        sent = send_campaign(campaign, dry_run=dry_run)

        if not dry_run:
            campaign.status = 'sent'
            campaign.recipient_count = sent
            campaign.sent_at = timezone.now()
            campaign.save(update_fields=['status', 'recipient_count', 'sent_at'])

        verb = 'Would send' if dry_run else 'Sent'
        self.stdout.write(self.style.SUCCESS(f'{verb} to {sent} recipients.'))
