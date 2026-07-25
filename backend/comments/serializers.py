from rest_framework import serializers
from .models import Comment, CommentReaction
from users.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']

class CommentReactionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = CommentReaction
        fields = ['id', 'user', 'reaction', 'created_at']

class CommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    replies = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'post', 'user', 'user_id', 'parent', 'text', 'gif_url', 
            'sticker_url', 'custom_style', 'created_at', 'updated_at', 
            'likes_count', 'is_pinned', 'replies', 'reactions', 
            'reaction_counts', 'user_reaction'
        ]
        read_only_fields = ['created_at', 'updated_at', 'likes_count', 'is_pinned']

    def get_replies(self, obj):
        if obj.parent is None:  # فقط للتعليقات الرئيسية
            if hasattr(obj, '_prefetched_objects_cache') and 'replies' in obj._prefetched_objects_cache:
                replies = obj.replies.all()
            else:
                replies = getattr(obj, 'prefetched_replies', None)
                if replies is None:
                    replies = obj.replies.select_related('user').prefetch_related('reactions').order_by('created_at')
            return CommentSerializer(replies, many=True, context=self.context).data
        return []

    def get_reactions(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'reactions' in obj._prefetched_objects_cache:
            reactions = obj.reactions.all()
        else:
            reactions = getattr(obj, 'prefetched_reactions', None)
            if reactions is None:
                reactions = obj.reactions.select_related('user').all()
        return CommentReactionSerializer(reactions, many=True).data

    def get_reaction_counts(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'reactions' in obj._prefetched_objects_cache:
            reactions = obj.reactions.all()
        else:
            reactions = getattr(obj, 'prefetched_reactions', None)
            if reactions is None:
                reactions = obj.reactions.all()
        counts = {}
        for reaction in reactions:
            counts[reaction.reaction] = counts.get(reaction.reaction, 0) + 1
        return counts

    def get_user_reaction(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if hasattr(obj, '_prefetched_objects_cache') and 'reactions' in obj._prefetched_objects_cache:
                reactions = obj.reactions.all()
            else:
                reactions = getattr(obj, 'prefetched_reactions', None)
            
            if reactions is not None:
                for reaction in reactions:
                    if reaction.user_id == request.user.id:
                        return reaction.reaction
                return None
            try:
                user_reaction = CommentReaction.objects.get(comment=obj, user=request.user)
                return user_reaction.reaction
            except CommentReaction.DoesNotExist:
                return None
        return None

class CommentCreateSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Comment
        fields = ['post', 'user_id', 'parent', 'text', 'gif_url', 'sticker_url', 'custom_style']

class CommentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['text', 'gif_url', 'sticker_url', 'custom_style']

class CommentReactionCreateSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = CommentReaction
        fields = ['comment', 'user_id', 'reaction']
