<<<<<<< HEAD
from collections import Counter

from django.contrib.auth import get_user_model
from django.db.models import F, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from outverse.auth_utils import require_user, user_from_request
from users.models import Follow
from notifications.utils import create_notification

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
            return Response({'users': [], 'posts': []})

        users = User.objects.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        )[:5]
        posts = Post.objects.filter(
            text__icontains=query
        ).select_related('user').order_by('-created_at')[:5]

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

        return Response({'users': user_results, 'posts': post_results})

=======
from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import F
from .models import Post
from .serializers import PostSerializer

# Create your views here.
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer
<<<<<<< HEAD

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
        qs = Post.objects.all().order_by(
            '-likes_count', '-views', '-created_at'
        )[:5]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def trending_tags(self, request):
        counter: Counter[str] = Counter()
        for post in Post.objects.order_by('-created_at')[:400]:
            for tag in post.tags or []:
                name = str(tag).strip().lstrip('#')
                if name:
                    counter[name] += 1
        return Response(
            [{'tag': tag, 'count': count} for tag, count in counter.most_common(12)]
        )

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def increment_views(self, request, pk=None):
        post = self.get_object()
        post.views = F('views') + 1
        post.save(update_fields=['views'])
        post.refresh_from_db()
        return Response({'views': post.views})

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
        qs = Post.objects.filter(id__in=post_ids).select_related('user')
        by_id = {p.id: p for p in qs}
        ordered = [by_id[i] for i in post_ids if i in by_id]
        serializer = self.get_serializer(ordered, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def toggle_save(self, request, pk=None):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        existing = SavedPost.objects.filter(user=user, post=post).first()
        if existing:
            existing.delete()
            return Response({'saved': False})
        SavedPost.objects.create(user=user, post=post)
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
=======
    
    def perform_create(self, serializer):
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def increment_views(self, request, pk=None):
        post = self.get_object()
        post.views = F('views') + 1
        post.save()
        post.refresh_from_db()
        return Response({'views': post.views})
    
    @action(detail=True, methods=['post'])
    def increment_likes(self, request, pk=None):
        post = self.get_object()
        post.likes_count = F('likes_count') + 1
        post.save()
        post.refresh_from_db()
        return Response({'likes_count': post.likes_count})
    
    def list(self, request, *args, **kwargs):
        """تحديث عدد التعليقات لجميع المنشورات قبل إرجاعها"""
        queryset = self.get_queryset()
        for post in queryset:
            post.update_comments_count()
        return super().list(request, *args, **kwargs)
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
