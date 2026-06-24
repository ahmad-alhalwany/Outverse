import secrets
import os

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.utils import timezone

from outverse.auth_utils import user_from_request
from rest_framework import viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.utils import create_notification
from reels.models import Reel

from .models import Follow, Profile, UserToken
from .serializers import (
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    UsernameAvailabilitySerializer,
    PrivateUserSerializer,
    ProfileSerializer,
    RegisterSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
)

User = get_user_model()
TOKEN_TTL_HOURS = 24
WORLD_OPTIONS = ['Nebula', 'Aether', 'Ember', 'Tidal', 'Verdant']


def _avatar_url(user, request):
    if getattr(user, 'avatar', None) and user.avatar:
        if request:
            return request.build_absolute_uri(user.avatar.url)
        return user.avatar.url
    return None


def _public_user_dict(user, request, is_following=False, posts_count=None):
    profile = getattr(user, 'profile', None)
    cover_photo = None
    points = 0
    achievements = []
    status = 'new'
    if profile:
        if getattr(profile, 'cover_photo', None):
            cover_photo = request.build_absolute_uri(profile.cover_photo.url) if request else profile.cover_photo.url
        points = profile.points
        achievements = profile.achievements or []
        status = profile.status
    return {
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'bio': user.bio,
        'location': getattr(user, 'location', '') or '',
        'avatar': _avatar_url(user, request),
        'posts_count': posts_count if posts_count is not None else getattr(user, 'posts_count', 0),
        'reels_count': getattr(user, 'reels_count', 0),
        'followers_count': getattr(user, 'followers_count', 0),
        'following_count': getattr(user, 'following_count', 0),
        'is_following': is_following,
        'cover_photo': cover_photo,
        'points': points,
        'achievements': achievements,
        'status': status,
    }


def _with_public_counts(queryset):
    reel_counts = Reel.objects.filter(
        user_id=OuterRef('pk'), is_active=True
    ).values('user_id').annotate(total=Count('id')).values('total')[:1]
    follower_counts = Follow.objects.filter(
        following_id=OuterRef('pk')
    ).values('following_id').annotate(total=Count('id')).values('total')[:1]
    following_counts = Follow.objects.filter(
        follower_id=OuterRef('pk')
    ).values('follower_id').annotate(total=Count('id')).values('total')[:1]
    return queryset.annotate(
        posts_count=Count('posts', distinct=True),
        reels_count=Coalesce(Subquery(reel_counts), Value(0)),
        followers_count=Coalesce(Subquery(follower_counts), Value(0)),
        following_count=Coalesce(Subquery(following_counts), Value(0)),
    )


def _user_payload(user, request=None):
    serializer = PrivateUserSerializer(user, context={'request': request})
    token, _ = Token.objects.get_or_create(user=user)
    return {'token': token.key, 'user': serializer.data}


def _frontend_base_url():
    return os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')


def _issue_token(user, token_type):
    UserToken.objects.filter(
        user=user,
        token_type=token_type,
        used_at__isnull=True,
    ).update(used_at=timezone.now())
    return UserToken.objects.create(
        user=user,
        token=secrets.token_urlsafe(32),
        token_type=token_type,
        expires_at=timezone.now() + timezone.timedelta(hours=TOKEN_TTL_HOURS),
    )


def _send_verification_email(user, token):
    if not user.email:
        return
    verify_url = f"{_frontend_base_url()}/login?verified=1&token={token.token}"
    send_mail(
        'Verify your Outverse account',
        f'Welcome to Outverse.\n\nVerify your email by opening:\n{verify_url}\n\nThis link expires in {TOKEN_TTL_HOURS} hours.',
        getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@outverse.local'),
        [user.email],
        fail_silently=False,
    )


def _send_password_reset_email(user, token):
    reset_url = f"{_frontend_base_url()}/reset-password?token={token.token}"
    send_mail(
        'Reset your Outverse password',
        f'Use this link to reset your password:\n{reset_url}\n\nThis link expires in {TOKEN_TTL_HOURS} hours.',
        getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@outverse.local'),
        [user.email],
        fail_silently=False,
    )


def _get_active_token(token_value, token_type):
    token = UserToken.objects.filter(
        token=token_value,
        token_type=token_type,
        used_at__isnull=True,
    ).select_related('user').first()
    if not token or token.expires_at <= timezone.now():
        return None
    return token


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        verification_token = _issue_token(user, UserToken.EMAIL_VERIFICATION)
        _send_verification_email(user, verification_token)
        return Response(_user_payload(user, request), status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(
            request, username=username, password=password
        )
        if not user:
            return Response({'error': 'Invalid credentials.'}, status=400)
        if not user.is_verified:
            return Response(
                {'error': 'Please verify your email before logging in.', 'code': 'email_not_verified'},
                status=403,
            )
        return Response(_user_payload(user, request))


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token_value = request.data.get('token', '').strip()
        token = _get_active_token(token_value, UserToken.EMAIL_VERIFICATION)
        if not token:
            return Response({'error': 'Invalid or expired verification token.'}, status=400)
        user = token.user
        user.is_verified = True
        user.save(update_fields=['is_verified'])
        token.mark_used()
        return Response({'verified': True})


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        user = User.objects.filter(email__iexact=email).first()
        if user:
            token = _issue_token(user, UserToken.PASSWORD_RESET)
            _send_password_reset_email(user, token)
        return Response({'message': 'If an account exists for that email, a reset link has been sent.'})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = _get_active_token(serializer.validated_data['token'], UserToken.PASSWORD_RESET)
        if not token:
            return Response({'error': 'Invalid or expired reset token.'}, status=400)
        user = token.user
        new_password = serializer.validated_data['new_password']
        try:
            validate_password(new_password, user=user)
        except ValidationError as exc:
            return Response({'error': exc.messages[0]}, status=400)
        user.set_password(new_password)
        user.save(update_fields=['password'])
        token.mark_used()
        Token.objects.filter(user=user).delete()
        return Response({'reset': True})


class UsernameAvailabilityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        serializer = UsernameAvailabilitySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data['username']
        available = bool(username) and not User.objects.filter(username__iexact=username).exists()
        return Response({'available': available})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = PrivateUserSerializer(request.user, context={'request': request})
        return Response(serializer.data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=204)


def _following_ids_for_viewer(request):
    viewer = user_from_request(request)
    if not viewer:
        return set()
    return set(
        Follow.objects.filter(follower_id=viewer.id)
        .values_list('following_id', flat=True)
    )


class UserMentionSearchView(APIView):
    """Autocomplete users for @mentions in comments."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 1:
            return Response([])
        users = User.objects.filter(
            Q(username__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
        ).order_by('username')[:10]
        results = []
        for user in users:
            full = f"{user.first_name or ''} {user.last_name or ''}".strip()
            results.append({
                'id': user.id,
                'username': user.username,
                'name': full or user.username,
                'avatar': _avatar_url(user, request),
            })
        return Response(results)


class CreatorSuggestionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        viewer = user_from_request(request)
        exclude_id = request.query_params.get('exclude') or (
            viewer.id if viewer else None
        )
        qs = _with_public_counts(User.objects.filter(is_verified=True)).order_by(
            '-posts_count', '-followers_count', '-id'
        )
        if exclude_id:
            qs = qs.exclude(id=exclude_id)

        following_ids = _following_ids_for_viewer(request)

        results = []
        for user in qs[:6]:
            avatar = None
            if getattr(user, 'avatar', None):
                avatar = request.build_absolute_uri(user.avatar.url)
            results.append({
                'id': user.id,
                'username': user.username,
                'avatar': avatar,
                'bio': user.bio,
                'posts_count': user.posts_count,
                'followers_count': user.followers_count,
                'is_following': user.id in following_ids,
            })
        return Response(results)


class OnboardingOptionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'worlds': WORLD_OPTIONS})


class UserProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        user = get_object_or_404(_with_public_counts(User.objects.select_related('profile').all()), id=user_id)
        viewer = user_from_request(request)
        is_following = False
        if viewer and viewer.id != user_id:
            is_following = Follow.objects.filter(
                follower_id=viewer.id, following_id=user_id
            ).exists()
        return Response(_public_user_dict(user, request, is_following=is_following))


class UserProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        if request.user.id != int(user_id):
            return Response({'error': 'Not allowed.'}, status=403)
        user = get_object_or_404(User, id=user_id)
        serializer = UserProfileUpdateSerializer(
            user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        profile, _ = Profile.objects.get_or_create(user=user)
        if 'cover_photo' in request.FILES:
            profile.cover_photo = request.FILES['cover_photo']
            profile.save(update_fields=['cover_photo'])
        is_following = False
        user = _with_public_counts(User.objects.select_related('profile').filter(id=user.id)).first()
        return Response(_public_user_dict(user, request, is_following=is_following))


class UserFollowersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        following_ids = _following_ids_for_viewer(request)
        rows = (
            Follow.objects.filter(following_id=user_id)
            .select_related('follower')
            .order_by('-created_at')[:200]
        )
        users = _with_public_counts(
            User.objects.filter(id__in=[f.follower_id for f in rows])
        )
        by_id = {user.id: user for user in users}
        return Response([
            {
                **_public_user_dict(by_id.get(f.follower_id, f.follower), request),
                'is_following': f.follower_id in following_ids,
            }
            for f in rows
        ])


class UserFollowingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        following_ids = _following_ids_for_viewer(request)
        rows = (
            Follow.objects.filter(follower_id=user_id)
            .select_related('following')
            .order_by('-created_at')[:200]
        )
        users = _with_public_counts(
            User.objects.filter(id__in=[f.following_id for f in rows])
        )
        by_id = {user.id: user for user in users}
        return Response([
            {
                **_public_user_dict(by_id.get(f.following_id, f.following), request),
                'is_following': f.following_id in following_ids,
            }
            for f in rows
        ])


class FollowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        following_id = request.data.get('following_id')
        if not following_id:
            return Response(
                {'error': 'following_id is required.'},
                status=400,
            )
        follower_id = request.user.id
        if str(follower_id) == str(following_id):
            return Response(
                {'error': "You can't follow yourself."}, status=400
            )
        if not User.objects.filter(id=following_id).exists():
            return Response({'error': 'User not found.'}, status=404)

        with transaction.atomic():
            existing = Follow.objects.select_for_update().filter(
                follower_id=follower_id, following_id=following_id
            ).first()
            if existing:
                existing.delete()
                is_following = False
            else:
                try:
                    _, created = Follow.objects.get_or_create(
                        follower_id=follower_id, following_id=following_id
                    )
                except IntegrityError:
                    created = False
                is_following = created
                if created:
                    create_notification(
                        recipient_id=following_id,
                        actor_id=follower_id,
                        verb='follow',
                        text='started following you',
                    )

        followers_count = Follow.objects.filter(
            following_id=following_id
        ).count()
        return Response({
            'is_following': is_following,
            'followers_count': followers_count,
        })


class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAdminUser()]


class PromoteStaffView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        if user.is_staff:
            return Response({'promoted': False, 'detail': 'User is already staff.'})
        user.is_staff = True
        user.save(update_fields=['is_staff'])
        return Response({'promoted': True, 'user_id': user.id})
