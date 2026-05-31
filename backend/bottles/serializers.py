import hashlib



from datetime import timedelta



from django.utils import timezone

from rest_framework import serializers



from outverse.auth_utils import user_from_request



from .models import MessageBottle





def _viewer_from_context(context):

    request = context.get('request')

    if request:

        user = user_from_request(request)

        if user:

            return user.id

    return context.get('viewer_id')





class BottleThrowSerializer(serializers.ModelSerializer):

    """Used when a user throws a new bottle into the cosmos."""

    expires_at = serializers.DateTimeField(source='expiry_time', read_only=True)



    class Meta:

        model = MessageBottle

        fields = [

            'id', 'message', 'emotion_type',

            'location_lat', 'location_lng', 'created_at', 'expires_at',

        ]

        read_only_fields = ['id', 'created_at', 'expires_at']



    def create(self, validated_data):

        request = self.context.get('request')

        user = user_from_request(request) if request else None

        if not user:

            raise serializers.ValidationError('Authentication required.')

        return MessageBottle.objects.create(

            sender_id=user.id,

            expiry_time=timezone.now() + timedelta(hours=24),

            **validated_data,

        )





class BottleCatchSerializer(serializers.ModelSerializer):

    sender_anon_id = serializers.SerializerMethodField()



    class Meta:

        model = MessageBottle

        fields = [

            'id', 'message', 'emotion_type', 'location_lat',

            'location_lng', 'created_at', 'sender_anon_id',

        ]



    def get_sender_anon_id(self, obj):

        raw = f"outverse-bottle-{obj.sender_id}".encode('utf-8')

        return hashlib.sha256(raw).hexdigest()[:12]





class BottleMapSerializer(serializers.ModelSerializer):

    expires_at = serializers.DateTimeField(source='expiry_time', read_only=True)

    is_mine = serializers.SerializerMethodField()

    message = serializers.SerializerMethodField()



    class Meta:

        model = MessageBottle

        fields = [

            'id', 'emotion_type', 'location_lat',

            'location_lng', 'created_at', 'expires_at',

            'is_mine', 'message',

        ]



    def get_is_mine(self, obj):

        viewer = _viewer_from_context(self.context)

        return bool(viewer and str(obj.sender_id) == str(viewer))



    def get_message(self, obj):

        if not self.get_is_mine(obj):

            return None

        return obj.message





class BottleRecentSerializer(serializers.ModelSerializer):

    expires_at = serializers.DateTimeField(source='expiry_time', read_only=True)

    is_mine = serializers.SerializerMethodField()

    message = serializers.SerializerMethodField()



    class Meta:

        model = MessageBottle

        fields = [

            'id', 'emotion_type', 'message',

            'location_lat', 'location_lng', 'created_at', 'expires_at',

            'is_mine',

        ]



    def get_is_mine(self, obj):

        viewer = _viewer_from_context(self.context)

        return bool(viewer and str(obj.sender_id) == str(viewer))



    def get_message(self, obj):

        if not self.get_is_mine(obj):

            return None

        return obj.message


