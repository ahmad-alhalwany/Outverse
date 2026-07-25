from rest_framework import serializers

from .models import Question, QuestionSuggestion


class QuestionSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'category', 'category_label', 'language', 'tags']
        read_only_fields = fields


class QuestionSuggestionSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = QuestionSuggestion
        fields = ['id', 'text', 'category', 'category_label', 'language', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']
