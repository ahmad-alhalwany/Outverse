"""Unified saved-items aggregator.

Outverse already stores saved posts in posts.SavedPost and saved reels in
reels.SavedReel. We now also save ideas (ideas.SavedIdea) and stories
(stories.SavedStory). This app exposes a single collection view so the frontend
can show one /saved page with tabs for all content types without migrating
legacy data.
"""
from django.apps import AppConfig


class SavedConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'saved'
