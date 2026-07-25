from django.conf import settings
from django.db import models


class Idea(models.Model):
    STATUS_CHOICES = [
        ('proposed', 'مقترح'),
        ('in_progress', 'قيد التنفيذ'),
        ('completed', 'مكتمل'),
    ]
    CATEGORY_CHOICES = [
        ('technology', 'Technology'),
        ('design', 'Design'),
        ('writing', 'Writing'),
        ('art', 'Art'),
        ('education', 'Education'),
        ('environment', 'Environment'),
        ('health', 'Health'),
        ('social', 'Social Impact'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_ideas',
    )
    collaborators = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='collaborated_ideas',
        blank=True,
    )
    votes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='voted_ideas',
        blank=True,
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='proposed'
    )
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default='other'
    )
    cover_url = models.URLField(blank=True)
    roles_needed = models.JSONField(default=list, blank=True)
    funding_goal = models.PositiveIntegerField(null=True, blank=True)
    funding_raised = models.PositiveIntegerField(default=0)
    tags = models.JSONField(default=list, blank=True)
    target_date = models.DateField(null=True, blank=True)
    milestones = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class CollaborationRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_REJECTED, "Rejected"),
    ]

    idea = models.ForeignKey(Idea, on_delete=models.CASCADE, related_name="collaboration_requests")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="idea_collaboration_requests")
    role = models.CharField(max_length=120)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("idea", "user", "role")

    def __str__(self):
        return f"{self.user} -> {self.idea} ({self.role})"


class IdeaPledge(models.Model):
    idea = models.ForeignKey(Idea, on_delete=models.CASCADE, related_name="pledges")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="idea_pledges")
    amount = models.PositiveIntegerField()
    is_anonymous = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} pledged {self.amount} to {self.idea}"


class IdeaComment(models.Model):
    idea = models.ForeignKey(Idea, on_delete=models.CASCADE, related_name="idea_comments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="idea_comments")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user} on {self.idea}"


class SavedIdea(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_ideas',
    )
    idea = models.ForeignKey(
        Idea,
        on_delete=models.CASCADE,
        related_name='saved_by',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('user', 'idea')
        ordering = ['-created_at']

    def __str__(self):
        return f"user {self.user_id} saved idea {self.idea_id}"
