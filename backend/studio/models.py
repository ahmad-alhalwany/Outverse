from django.conf import settings
from django.db import models

from outverse.upload_validators import validate_image_upload


class DrawSession(models.Model):
    """Creation Studio — solo by default, becomes a real-time shared room once invited."""

    MODE_CHOICES = [('solo', 'Solo'), ('live', 'Live')]

    title = models.CharField(max_length=200, default='Untitled session')
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='draw_sessions')
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='solo', db_index=True)
    is_live = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class SessionInvite(models.Model):
    """A host inviting a followed friend into a session — flips it live."""

    STATUS_CHOICES = [('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')]

    session = models.ForeignKey(DrawSession, on_delete=models.CASCADE, related_name='invites')
    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='studio_invites_sent')
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='studio_invites_received')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'invite {self.from_user_id} -> {self.to_user_id} for session {self.session_id}'


class SessionParticipant(models.Model):
    """Presence — who is currently connected to a session."""

    session = models.ForeignKey(DrawSession, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='studio_sessions')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('session', 'user')

    def __str__(self):
        return f'{self.user_id} in session {self.session_id}'


class CanvasStroke(models.Model):
    """One freehand stroke — normalized rows instead of one growing JSON blob."""

    session = models.ForeignKey(DrawSession, on_delete=models.CASCADE, related_name='strokes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='canvas_strokes')
    points = models.JSONField(default=list)
    color = models.CharField(max_length=20, default='#5B21B6')
    width = models.PositiveSmallIntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'stroke {self.id} in session {self.session_id}'


class CanvasMedia(models.Model):
    """An image placed on the canvas — positioned/resized independently of strokes."""

    session = models.ForeignKey(DrawSession, on_delete=models.CASCADE, related_name='media')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='canvas_media')
    image = models.ImageField(upload_to='studio_media/', validators=[validate_image_upload])
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    width = models.FloatField(default=200)
    height = models.FloatField(default=200)
    rotation = models.FloatField(default=0)
    z_index = models.IntegerField(default=0)
    filter = models.CharField(max_length=200, blank=True, default='', help_text='CSS filter() string, e.g. "brightness(1.1) contrast(1.05)"')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['z_index', 'created_at']

    def __str__(self):
        return f'media {self.id} in session {self.session_id}'


class CanvasShape(models.Model):
    """A basic shape (rectangle/circle/line) placed on the canvas."""

    KIND_CHOICES = [('rectangle', 'Rectangle'), ('circle', 'Circle'), ('line', 'Line')]

    session = models.ForeignKey(DrawSession, on_delete=models.CASCADE, related_name='shapes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='canvas_shapes')
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    width = models.FloatField(default=120)
    height = models.FloatField(default=120)
    rotation = models.FloatField(default=0)
    z_index = models.IntegerField(default=0)
    color = models.CharField(max_length=20, default='#5B21B6')
    stroke_width = models.PositiveSmallIntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['z_index', 'created_at']

    def __str__(self):
        return f'{self.kind} {self.id} in session {self.session_id}'
