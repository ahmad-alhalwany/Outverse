from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from outverse.upload_validators import validate_image_upload


class User(AbstractUser):
    SPENDER_TIER_CHOICES = [
        ('none', 'None'),
        ('bronze', 'Bronze Patron'),
        ('silver', 'Silver Patron'),
        ('gold', 'Gold Patron'),
    ]

    bio = models.TextField(max_length=500, blank=True, null=True)
    avatar = models.ImageField(
        upload_to='avatars/',
        null=True,
        blank=True,
        validators=[validate_image_upload],
    )
    location = models.CharField(max_length=120, blank=True, default='')
    is_verified = models.BooleanField(default=False, db_index=True)
    badge_verified = models.BooleanField(default=False, db_index=True)
    # Soft moderation: hide from public feeds without hard-banning the account.
    is_shadow_banned = models.BooleanField(default=False, db_index=True)
    onboarding_completed = models.BooleanField(default=False)
    interests = models.JSONField(default=list, blank=True)
    # Cosmetic patron badge unlocked by cumulative coin spend (shop
    # purchases + tips sent) — recomputed in shop.spending.update_spender_tier
    # after every spend event rather than derived live on each profile view.
    spender_tier = models.CharField(
        max_length=10, choices=SPENDER_TIER_CHOICES, default='none', db_index=True,
    )
    # Gates listing digital/physical Shop products — granted via SellerApplication
    # approval. `idea`-type listings stay open to every user regardless of this flag.
    is_shop_seller = models.BooleanField(default=False, db_index=True)

    def __str__(self):
        return self.username


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='following',
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followers',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower_id} -> {self.following_id}"


class UserBlock(models.Model):
    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocking',
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocked_by',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('blocker', 'blocked')

    def __str__(self):
        return f"{self.blocker_id} blocked {self.blocked_id}"


class UserMute(models.Model):
    muter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='muting',
    )
    muted = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='muted_by',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('muter', 'muted')

    def __str__(self):
        return f"{self.muter_id} muted {self.muted_id}"


class UserRestrict(models.Model):
    restricter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='restricting',
    )
    restricted = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='restricted_by',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('restricter', 'restricted')

    def __str__(self):
        return f"{self.restricter_id} restricted {self.restricted_id}"


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    mood_history = models.JSONField(default=list, blank=True)
    points = models.IntegerField(default=1250, help_text='Outverse coins for the shop')
    karma = models.IntegerField(default=0, help_text='Reddit-style karma from post votes')
    achievements = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=100, default='new', db_index=True)
    cover_photo = models.ImageField(
        upload_to='profile_covers/',
        null=True,
        blank=True,
        validators=[validate_image_upload],
    )

    def __str__(self):
        return f"{self.user.username}'s profile"


class Experience(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='experiences',
    )
    title = models.CharField(max_length=120)
    organization = models.CharField(max_length=120)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['-is_current', '-start_date', '-id']

    def __str__(self):
        return f"{self.user_id}: {self.title} at {self.organization}"


class UserToken(models.Model):
    EMAIL_VERIFICATION = 'email_verification'
    PASSWORD_RESET = 'password_reset'
    TWO_FA_PENDING = 'two_fa_pending'
    TOKEN_TYPES = [
        (EMAIL_VERIFICATION, 'Email verification'),
        (PASSWORD_RESET, 'Password reset'),
        (TWO_FA_PENDING, 'Two-factor pending login'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tokens',
    )
    token = models.CharField(max_length=128, unique=True, db_index=True)
    token_type = models.CharField(max_length=32, choices=TOKEN_TYPES, db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_active(self):
        return self.used_at is None and self.expires_at > timezone.now()

    def mark_used(self):
        self.used_at = timezone.now()
        self.save(update_fields=['used_at'])


class SocialAuthAccount(models.Model):
    PROVIDERS = [
        ('google', 'Google'),
        ('apple', 'Apple'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='social_accounts',
    )
    provider = models.CharField(max_length=20, choices=PROVIDERS, db_index=True)
    provider_uid = models.CharField(max_length=255, db_index=True)
    email = models.EmailField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('provider', 'provider_uid')

    def __str__(self):
        return f"{self.provider}:{self.provider_uid} -> {self.user_id}"


class UserTwoFactor(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='two_factor',
    )
    totp_secret = models.CharField(max_length=64)
    is_enabled = models.BooleanField(default=False)
    backup_codes = models.JSONField(default=list, blank=True)
    enabled_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"2FA user {self.user_id} enabled={self.is_enabled}"


class VerificationRequest(models.Model):
    STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='verification_requests',
    )
    reason = models.TextField()
    links = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=16, choices=STATUS, default='pending', db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='verification_reviews',
    )
    review_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"verification {self.user_id} ({self.status})"


class SellerApplication(models.Model):
    STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='seller_applications',
    )
    reason = models.TextField()
    links = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=16, choices=STATUS, default='pending', db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='seller_application_reviews',
    )
    review_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"seller application {self.user_id} ({self.status})"


class GDPRExportRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gdpr_exports',
    )
    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default='pending', db_index=True,
    )
    file_path = models.CharField(max_length=512, blank=True, default='')
    file_size = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"gdpr export {self.user_id} ({self.status})"


# Alias used by users.tasks
GDPRExport = GDPRExportRequest

