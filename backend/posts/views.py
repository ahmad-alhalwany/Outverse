from collections import Counter

from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Case, F, IntegerField, Q, When
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from outverse.auth_utils import require_user, user_from_request
from users.models import Follow
from notifications.utils import create_notification
from bottles.models import MessageBottle
from ideas.models import Idea
from narratives.models import Story
from reels.models import Reel
from shop.models import ShopItem

from .models import Comment, CommentReaction, Post, PostMedia, Reaction, SavedPost
from .serializers import (
    CommentSerializer,
    PostMediaSerializer,
    PostSerializer,
    reaction_counts_for_comment,
    reaction_counts_for_post,
)

VALID_REACTIONS = {r[0] for r in Reaction.REACTION_TYPES}
User = get_user_model()


def _snippet(text, max_len=60):
    text = (text or '').strip()
    return text if len(text) <= max_len else f"{text[:max_len].strip()}…"


class SearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({
                'users': [],
                'posts': [],
                'reels': [],
                'ideas': [],
                'stories': [],
                'bottles': [],
                'shop': [],
            })

        users = User.objects.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        )[:5]
        posts = Post.objects.filter(
            text__icontains=query
        ).select_related('user').order_by('-created_at')[:5]
        reels = Reel.objects.filter(
            Q(caption__icontains=query) | Q(tags__icontains=query)
        ).select_related('user').order_by('-created_at')[:5]
        ideas = Idea.objects.filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        ).select_related('owner').order_by('-created_at')[:5]
        bottles = MessageBottle.objects.filter(
            message__icontains=query
        ).select_related('sender').order_by('-created_at')[:5]
        stories = Story.objects.filter(
            Q(title__icontains=query) | Q(premise__icontains=query)
        ).select_related('owner').order_by('-updated_at')[:5]
        shop_items = ShopItem.objects.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        ).select_related('creator').order_by('-created_at')[:5]

        user_results = []
        for user in users:
            avatar = None
            if getattr(user, 'avatar', None):
                avatar = request.build_absolute_uri(user.avatar.url)
            full = f"{user.first_name or ''} {user.last_name or ''}".strip()
            user_results.append({
                'id': user.id,
                'username': user.username,
                'name': full or user.username,
                'avatar': avatar,
            })

        post_results = [{
            'id': post.id,
            'snippet': _snippet(post.text),
            'author': post.user.username if post.user else '',
        } for post in posts]
        reel_results = [{
            'id': reel.id,
            'caption': _snippet(reel.caption),
            'author': reel.user.username if reel.user else '',
            'tags': reel.tags or [],
        } for reel in reels]
        idea_results = [{
            'id': idea.id,
            'title': idea.title,
            'description': _snippet(idea.description),
            'owner': idea.owner.username if idea.owner else '',
        } for idea in ideas]
        bottle_results = [{
            'id': bottle.id,
            'message': _snippet(bottle.message),
            'emotion_type': bottle.emotion_type,
            'sender': bottle.sender.username if bottle.sender else '',
        } for bottle in bottles]
        story_results = [{
            'id': story.id,
            'title': story.title,
            'description': _snippet(story.premise),
            'owner': story.owner.username if story.owner else '',
        } for story in stories]
        shop_results = [{
            'id': item.id,
            'name': item.name,
            'description': _snippet(item.description),
            'creator': item.creator.username if item.creator else '',
            'price': item.price,
        } for item in shop_items]

        return Response({
            'users': user_results,
            'posts': post_results,
            'reels': reel_results,
            'ideas': idea_results,
            'stories': story_results,
            'bottles': bottle_results,
            'shop': shop_results,
        })


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer

    def get_permissions(self):
        if self.action in (
            'list', 'retrieve', 'trending', 'trending_tags', 'increment_views',
        ):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        viewer = user_from_request(self.request)
        if viewer:
            ctx['saved_ids'] = set(
                SavedPost.objects.filter(user=viewer).values_list(
                    'post_id', flat=True
                )
            )
        return ctx

    def get_queryset(self):
        qs = Post.objects.all().order_by('-created_at')
        if self.action != 'list':
            return qs
        author_id = self.request.query_params.get('author')
        if author_id:
            qs = qs.filter(user_id=author_id)
        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tags__contains=[tag])
        feed = self.request.query_params.get('feed')
        viewer = user_from_request(self.request)
        if feed == 'following' and viewer:
            following_ids = Follow.objects.filter(
                follower_id=viewer.id
            ).values_list('following_id', flat=True)
            qs = qs.filter(user_id__in=list(following_ids))
        return qs

    def perform_create(self, serializer):
        serializer.save(user=user_from_request(self.request))

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if post.user_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if post.user_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(
        detail=True,
        methods=['post'],
        parser_classes=[MultiPartParser, FormParser],
    )
    def add_media(self, request, pk=None):
        post = self.get_object()
        files = request.FILES.getlist('media')
        start = post.media.count()
        created = []
        for idx, media_file in enumerate(files):
            content_type = getattr(media_file, 'content_type', '') or ''
            media_type = 'video' if content_type.startswith('video') else 'image'
            created.append(
                PostMedia.objects.create(
                    post=post,
                    media_file=media_file,
                    media_type=media_type,
                    order=start + idx,
                )
            )
        serializer = PostMediaSerializer(
            created, many=True, context={'request': request}
        )
        return Response(serializer.data, status=201)

    @action(detail=False, methods=['get'])
    def trending(self, request):
        cache_key = 'posts:trending'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        qs = Post.objects.all().order_by(
            '-likes_count', '-views', '-created_at'
        )[:5]
        payload = self.get_serializer(qs, many=True).data
        cache.set(cache_key, payload, 300)
        return Response(payload)

    @action(detail=False, methods=['get'])
    def trending_tags(self, request):
        cached = cache.get('posts:trending_tags')
        if cached is not None:
            return Response(cached)
        counter: Counter[str] = Counter()
        for post in Post.objects.order_by('-created_at')[:400]:
            for tag in post.tags or []:
                name = str(tag).strip().lstrip('#')
                if name:
                    counter[name] += 1
        payload = [{'tag': tag, 'count': count} for tag, count in counter.most_common(12)]
        cache.set('posts:trending_tags', payload, 300)
        return Response(payload)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def increment_views(self, request, pk=None):
        post = self.get_object()
        post.views = F('views') + 1
        post.save(update_fields=['views'])
        post.refresh_from_db()
        return Response({'views': post.views})

    increment_views.throttle_classes = [AnonRateThrottle]

    @action(detail=False, methods=['get'])
    def saved(self, request):
        user, err = require_user(request)
        if err:
            return err
        post_ids = list(
            SavedPost.objects.filter(user=user)
            .order_by('-created_at')
            .values_list('post_id', flat=True)
        )
        if not post_ids:
            return Response([])
        ordering = Case(
            *[When(id=post_id, then=position) for position, post_id in enumerate(post_ids)],
            output_field=IntegerField(),
        )
        qs = (
            Post.objects.filter(id__in=post_ids)
            .select_related('user')
            .order_by(ordering)
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def toggle_save(self, request, pk=None):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        with transaction.atomic():
            existing = SavedPost.objects.select_for_update().filter(user=user, post=post).first()
            if existing:
                existing.delete()
                return Response({'saved': False})
            try:
                SavedPost.objects.get_or_create(user=user, post=post)
            except IntegrityError:
                return Response({'saved': True})
        return Response({'saved': True})

    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        post = self.get_object()
        post.shares_count = F('shares_count') + 1
        post.save(update_fields=['shares_count'])
        post.refresh_from_db()
        return Response({'shares_count': post.shares_count})

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        rtype = request.data.get('reaction')
        if rtype is not None and rtype not in VALID_REACTIONS:
            return Response({'error': 'Invalid reaction.'}, status=400)

        existing = Reaction.objects.filter(post=post, user=user).first()
        if rtype is None or (existing and existing.type == rtype):
            if existing:
                existing.delete()
            my_reaction = None
        elif existing:
            existing.type = rtype
            existing.save(update_fields=['type'])
            my_reaction = rtype
        else:
            Reaction.objects.create(post=post, user=user, type=rtype)
            my_reaction = rtype
            create_notification(
                recipient_id=post.user_id,
                actor_id=user.id,
                verb='reaction',
                post=post,
                text='reacted to your post',
            )

        total = post.reactions.count()
        post.likes_count = total
        post.save(update_fields=['likes_count'])
        return Response({
            'reaction_counts': reaction_counts_for_post(post),
            'my_reaction': my_reaction,
            'total': total,
        })


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Comment.objects.select_related('user').prefetch_related('reactions')
        post_id = self.request.query_params.get('post')
        if post_id:
            qs = qs.filter(post_id=post_id)
        if self.action == 'list':
            qs = qs.filter(parent__isnull=True)
        return qs.order_by('created_at')

    def _sync_count(self, post):
        post.comments_count = post.comments.count()
        post.save(update_fields=['comments_count'])

    def perform_create(self, serializer):
        user = user_from_request(self.request)
        comment = serializer.save(user=user)
        self._sync_count(comment.post)
        verb_text = (
            'replied to your comment'
            if comment.parent_id
            else 'commented on your post'
        )
        recipient_id = (
            comment.parent.user_id
            if comment.parent_id
            else comment.post.user_id
        )
        create_notification(
            recipient_id=recipient_id,
            actor_id=user.id,
            verb='comment',
            post=comment.post,
            text=verb_text,
        )

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.user_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        post = instance.post
        instance.delete()
        self._sync_count(post)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.user_id != user.id and comment.post.user_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        rtype = request.data.get('reaction')
        if rtype is not None and rtype not in VALID_REACTIONS:
            return Response({'error': 'Invalid reaction.'}, status=400)

        existing = CommentReaction.objects.filter(
            comment=comment, user=user
        ).first()
        if rtype is None or (existing and existing.type == rtype):
            if existing:
                existing.delete()
            my_reaction = None
        elif existing:
            existing.type = rtype
            existing.save(update_fields=['type'])
            my_reaction = rtype
        else:
            CommentReaction.objects.create(
                comment=comment, user=user, type=rtype
            )
            my_reaction = rtype

        return Response({
            'reaction_counts': reaction_counts_for_comment(comment),
            'my_reaction': my_reaction,
        })


class StaffPostModerationView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        posts = (
            Post.objects.select_related('user')
            .order_by('-created_at')[:100]
        )
        payload = PostSerializer(posts, many=True, context={'request': request}).data
        return Response(payload)

    def delete(self, request):
        post_id = request.data.get('post_id')
        if not post_id:
            return Response({'error': 'post_id is required.'}, status=400)
        post = Post.objects.filter(id=post_id).first()
        if not post:
            return Response({'error': 'Post not found.'}, status=404)
        post.delete()
        return Response(status=204)


class StaffCommentModerationView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        post_id = request.query_params.get('post_id')
        qs = Comment.objects.select_related('user', 'post').order_by('-created_at')
        if post_id:
            qs = qs.filter(post_id=post_id)
        serializer = CommentSerializer(qs[:200], many=True, context={'request': request})
        return Response(serializer.data)

    def delete(self, request):
        comment_id = request.data.get('comment_id')
        if not comment_id:
            return Response({'error': 'comment_id is required.'}, status=400)
        comment = Comment.objects.filter(id=comment_id).first()
        if not comment:
            return Response({'error': 'Comment not found.'}, status=404)
        post = comment.post
        comment.delete()
        post.comments_count = post.comments.count()
        post.save(update_fields=['comments_count'])
        return Response(status=204)
