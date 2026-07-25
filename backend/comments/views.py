from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ThrottleMixin, UserCommentThrottle
from django.contrib.auth import get_user_model
from django.db.models import F
from moderation.ai_moderation import auto_moderate, moderate_text
from .models import Comment, CommentReaction
from .serializers import (
    CommentSerializer, CommentCreateSerializer, CommentUpdateSerializer,
    CommentReactionCreateSerializer, CommentReactionSerializer
)

User = get_user_model()

class CommentViewSet(ThrottleMixin, viewsets.ModelViewSet):
    queryset = Comment.objects.all()
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

    serializer_class = CommentSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return CommentCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CommentUpdateSerializer
        return CommentSerializer

    def get_queryset(self):
        from django.db.models import Prefetch
        queryset = Comment.objects.select_related('user').prefetch_related(
            Prefetch('reactions', queryset=CommentReaction.objects.select_related('user')),
            Prefetch('replies', queryset=Comment.objects.select_related('user').prefetch_related(
                Prefetch('reactions', queryset=CommentReaction.objects.select_related('user'))
            ).order_by('created_at'))
        )
        post_id = self.request.query_params.get('post', None)
        if post_id is not None:
            queryset = queryset.filter(post_id=post_id, parent=None)  # فقط التعليقات الرئيسية
        return queryset

    def create(self, request, *args, **kwargs):
        text_content = request.data.get('text', '')
        mod_result = moderate_text(text_content) if text_content else None
        if mod_result and mod_result.get('flagged'):
            reporter_user = User.objects.filter(pk=request.data.get('user_id')).first()
            auto_moderate(text=text_content, content_type='comment', user=reporter_user, result=mod_result)
            return Response({
                'error': 'Comment flagged by AI moderation.',
                'moderation': {'flagged': True, 'categories': mod_result.get('categories', {})},
            }, status=403)

        response = super().create(request, *args, **kwargs)
        if mod_result and response.status_code == 201 and response.data.get('id'):
            reporter_user = User.objects.filter(pk=request.data.get('user_id')).first()
            auto_moderate(
                text=text_content, content_type='comment', object_id=response.data['id'],
                user=reporter_user, result=mod_result,
            )
        return response

    def perform_create(self, serializer):
        comment = serializer.save()
        # تحديث عدد التعليقات في الـ Post
        comment.post.comments_count = F('comments_count') + 1
        comment.post.save()

    def perform_destroy(self, instance):
        # تقليل عدد التعليقات في الـ Post
        instance.post.comments_count = F('comments_count') - 1
        instance.post.save()
        instance.delete()

    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        comment = self.get_object()
        comment.is_pinned = not comment.is_pinned
        comment.save()
        return Response({'is_pinned': comment.is_pinned})

    @action(detail=True, methods=['post'])
    def add_reaction(self, request, pk=None):
        comment = self.get_object()
        reaction = request.data.get('reaction')
        user_id = request.data.get('user_id')
        
        if not reaction or not user_id:
            return Response(
                {'error': 'reaction and user_id are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # التحقق من أن التفاعل صحيح
        valid_reactions = [choice[0] for choice in CommentReaction.REACTION_CHOICES]
        if reaction not in valid_reactions:
            return Response(
                {'error': 'Invalid reaction'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # إنشاء أو تحديث التفاعل
        reaction_obj, created = CommentReaction.objects.get_or_create(
            comment=comment,
            user_id=user_id,
            defaults={'reaction': reaction}
        )
        
        if not created:
            # إذا كان نفس التفاعل، احذفه
            if reaction_obj.reaction == reaction:
                reaction_obj.delete()
                comment.likes_count = F('likes_count') - 1
            else:
                # إذا كان تفاعل مختلف، غيّره
                reaction_obj.reaction = reaction
                reaction_obj.save()
        else:
            comment.likes_count = F('likes_count') + 1
        
        comment.save()
        
        return Response({
            'reaction': reaction if created or reaction_obj.reaction == reaction else None,
            'likes_count': comment.likes_count
        })

    @action(detail=True, methods=['get'])
    def reactions(self, request, pk=None):
        comment = self.get_object()
        reactions = CommentReaction.objects.filter(comment=comment)
        serializer = CommentReactionSerializer(reactions, many=True)
        return Response(serializer.data)

class CommentReactionViewSet(ThrottleMixin, viewsets.ModelViewSet):
    queryset = CommentReaction.objects.all()
    serializer_class = CommentReactionSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return CommentReactionCreateSerializer
        return CommentReactionSerializer
