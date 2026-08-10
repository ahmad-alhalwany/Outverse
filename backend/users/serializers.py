from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Experience, Profile

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name',
            'bio', 'avatar', 'location', 'is_verified', 'onboarding_completed', 'interests',
        ]
        read_only_fields = ['id']


class PrivateUserSerializer(UserSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'bio', 'avatar', 'location', 'is_staff', 'is_verified', 'is_shop_seller',
            'onboarding_completed', 'interests',
        ]
        read_only_fields = ['id', 'is_staff', 'is_verified', 'is_shop_seller']


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'bio', 'location', 'avatar', 'interests', 'onboarding_completed']
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'bio': {'required': False, 'allow_blank': True},
            'location': {'required': False, 'allow_blank': True},
            'avatar': {'required': False},
            'interests': {'required': False},
            'onboarding_completed': {'required': False},
        }


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password',
            'first_name', 'last_name',
        ]

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Username already taken.')
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Email already registered.')
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        Profile.objects.get_or_create(user=user)
        return user


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=6)


class UsernameAvailabilitySerializer(serializers.Serializer):
    username = serializers.CharField()

    def validate_username(self, value):
        return value.strip()


class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    cover_photo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'user', 'mood_history', 'points', 'karma',
            'achievements', 'status', 'cover_photo',
        ]


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = [
            'id', 'title', 'organization', 'start_date', 'end_date',
            'is_current', 'description',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        start_date = attrs.get('start_date') or getattr(self.instance, 'start_date', None)
        end_date = attrs.get('end_date') if 'end_date' in attrs else getattr(self.instance, 'end_date', None)
        is_current = attrs.get('is_current') if 'is_current' in attrs else getattr(self.instance, 'is_current', False)
        if is_current:
            attrs['end_date'] = None
        elif start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        return attrs
