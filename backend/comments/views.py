from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import F
from .models import Comment, CommentReaction
from .serializers import (
    CommentSerializer, CommentCreateSerializer, CommentUpdateSerializer,
    CommentReactionCreateSerializer, CommentReactionSerializer
)

class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return CommentCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CommentUpdateSerializer
        return CommentSerializer

    def get_queryset(self):
        queryset = Comment.objects.all()
        post_id = self.request.query_params.get('post', None)
        if post_id is not None:
            queryset = queryset.filter(post_id=post_id, parent=None)  # فقط التعليقات الرئيسية
        return queryset

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

class CommentReactionViewSet(viewsets.ModelViewSet):
    queryset = CommentReaction.objects.all()
    serializer_class = CommentReactionSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return CommentReactionCreateSerializer
        return CommentReactionSerializer
