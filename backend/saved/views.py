from itertools import chain

from django.db.models import Case, IntegerField, When
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ThrottleMixin, UserBookmarkThrottle

from outverse.auth_utils import require_user

from posts.models import Post, SavedPost
from posts.serializers import PostSerializer
from reels.models import Reel, SavedReel
from reels.serializers import ReelSerializer
from ideas.models import Idea, SavedIdea
from ideas.serializers import IdeaSerializer
from stories.models import SavedStory, Story
from stories.serializers import StorySerializer


TYPE_MAP = {
    'post': ('post', SavedPost, Post, PostSerializer, 'post_id'),
    'reel': ('reel', SavedReel, Reel, ReelSerializer, 'reel_id'),
    'idea': ('idea', SavedIdea, Idea, IdeaSerializer, 'idea_id'),
    'story': ('story', SavedStory, Story, StorySerializer, 'story_id'),
}


class SavedItemViewSet(ThrottleMixin, viewsets.ViewSet):
    """Unified saved collection view.

    throttle_scopes = {
        'create': 'content.post_create',
        'perform_create': 'content.post_create',
        'update': 'content.draft_write',
        'partial_update': 'content.draft_write',
        'perform_update': 'content.draft_write',
        'destroy': 'content.draft_write',
        'perform_destroy': 'content.draft_write',
        'list': 'anon.read',
        'retrieve': 'anon.read',
    }

    GET /api/saved/?collection=posts|reels|ideas|stories|all
    DELETE /api/saved/{id}/ where id is f'{type}_{pk}', e.g. post_12.
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        user, err = require_user(request)
        if err:
            return err
        collection = request.query_params.get('collection', 'all').lower()
        allowed = {t[0] for t in TYPE_MAP.values()}
        if collection not in allowed and collection != 'all':
            return Response({'error': 'Invalid collection.'}, status=400)

        results = []
        for key, (type_name, saved_model, content_model, serializer_class, id_field) in TYPE_MAP.items():
            if collection != 'all' and key != collection:
                continue
            saved_rows = list(
                saved_model.objects.filter(user=user)
                .order_by('-created_at')
                .values_list(id_field, 'created_at')
            )
            if not saved_rows:
                continue
            saved_ids = [content_id for content_id, _ in saved_rows]
            # When bookmarks were saved, not the content's own pk — used to sort
            # the mixed "all" collection by recency instead of raw content id.
            saved_at_by_id = dict(saved_rows)
            ordering = Case(
                *[When(pk=pk, then=pos) for pos, pk in enumerate(saved_ids)],
                output_field=IntegerField(),
            )
            qs = content_model.objects.filter(pk__in=saved_ids).order_by(ordering)
            serializer = serializer_class(qs, many=True, context={'request': request})
            for idx, item in enumerate(serializer.data):
                content_id = saved_ids[idx]
                item_copy = dict(item)
                item_copy['saved_id'] = f"{type_name}_{content_id}"
                item_copy['saved_type'] = type_name
                results.append((saved_at_by_id[content_id], type_name, item_copy))

        results.sort(key=lambda x: x[0], reverse=True)
        return Response([item for _, _, item in results])

    def destroy(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        if not pk or '_' not in pk:
            return Response({'error': 'Invalid saved id.'}, status=400)
        type_name, raw_id = pk.split('_', 1)
        type_name = type_name.lower()
        try:
            mapping = next(m for m in TYPE_MAP.values() if m[0] == type_name)
        except StopIteration:
            return Response({'error': 'Unknown saved type.'}, status=400)
        saved_model, _, _, _, id_field = mapping
        try:
            instance = saved_model.objects.get(**{id_field: int(raw_id), 'user': user})
        except (ValueError, saved_model.DoesNotExist):
            return Response({'error': 'Saved item not found.'}, status=404)
        instance.delete()
        return Response(status=204)
