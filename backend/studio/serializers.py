from rest_framework import serializers

from users.models import User

from .models import CanvasMedia, CanvasShape, CanvasStroke, CanvasText, DrawSession, SessionParticipant


class StudioUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar']


class CanvasStrokeSerializer(serializers.ModelSerializer):
    user = StudioUserSerializer(read_only=True)

    class Meta:
        model = CanvasStroke
        fields = ['id', 'user', 'points', 'color', 'width', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class CanvasMediaSerializer(serializers.ModelSerializer):
    user = StudioUserSerializer(read_only=True)

    class Meta:
        model = CanvasMedia
        fields = ['id', 'user', 'image', 'x', 'y', 'width', 'height', 'rotation', 'z_index', 'filter', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class CanvasShapeSerializer(serializers.ModelSerializer):
    user = StudioUserSerializer(read_only=True)

    class Meta:
        model = CanvasShape
        fields = ['id', 'user', 'kind', 'x', 'y', 'width', 'height', 'rotation', 'z_index', 'color', 'stroke_width', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class CanvasTextSerializer(serializers.ModelSerializer):
    user = StudioUserSerializer(read_only=True)

    class Meta:
        model = CanvasText
        fields = ['id', 'user', 'text', 'x', 'y', 'width', 'height', 'rotation', 'z_index', 'color', 'font_size', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class SessionParticipantSerializer(serializers.ModelSerializer):
    user = StudioUserSerializer(read_only=True)

    class Meta:
        model = SessionParticipant
        fields = ['user', 'joined_at']


class DrawSessionListSerializer(serializers.ModelSerializer):
    host = StudioUserSerializer(read_only=True)

    class Meta:
        model = DrawSession
        fields = ['id', 'title', 'host', 'mode', 'is_live', 'created_at', 'updated_at']
        read_only_fields = ['host', 'mode', 'created_at', 'updated_at']


class DrawSessionDetailSerializer(DrawSessionListSerializer):
    strokes = CanvasStrokeSerializer(many=True, read_only=True)
    media = CanvasMediaSerializer(many=True, read_only=True)
    shapes = CanvasShapeSerializer(many=True, read_only=True)
    texts = CanvasTextSerializer(many=True, read_only=True)
    participants = SessionParticipantSerializer(many=True, read_only=True)

    class Meta(DrawSessionListSerializer.Meta):
        fields = DrawSessionListSerializer.Meta.fields + ['strokes', 'media', 'shapes', 'texts', 'participants']
