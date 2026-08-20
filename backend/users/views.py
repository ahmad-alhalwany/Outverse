import logging
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
from outverse.rate_limit import rate_limit_response
from rest_framework import viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.utils import create_notification
from reels.models import Reel

from .achievements import full_achievements_for_profile
from .models import Experience, Follow, Profile, UserBlock, UserMute, UserRestrict, UserToken
from .social import (
    apply_block_side_effects,
    blocked_user_ids,
    feed_hidden_author_ids,
    is_blocked_between,
    social_status_for,
)
from .serializers import (
    ForgotPasswordSerializer,
    ExperienceSerializer,
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
logger = logging.getLogger(__name__)
WORLD_OPTIONS = ['The Lab', 'The Bazaar', 'The Vault', 'Story Forge', 'Madness Shop']


def _avatar_url(user, request):
    if getattr(user, 'avatar', None) and user.avatar:
        if request:
            return request.build_absolute_uri(user.avatar.url)
        return user.avatar.url
    return None


def _unlocked_achievement_titles(achievements):
    titles = set()
    for achievement in achievements or []:
        progress = achievement.get('progress') or 0
        goal = achievement.get('goal') or 0
        if achievement.get('completed') or (goal and progress >= goal):
            titles.add(achievement.get('title'))
    return titles


def _public_user_dict(user, request, is_following=False, posts_count=None, social=None):
    profile = getattr(user, 'profile', None)
    cover_photo = None
    points = 0
    karma = 0
    achievements = []
    status = 'new'
    if profile:
        if getattr(profile, 'cover_photo', None):
            cover_photo = request.build_absolute_uri(profile.cover_photo.url) if request else profile.cover_photo.url
        points = profile.points
        karma = getattr(profile, 'karma', 0) or 0
        achievements = profile.achievements or []
        status = profile.status
    result = {
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
        'badge_verified': getattr(user, 'badge_verified', False),
        'spender_tier': getattr(user, 'spender_tier', 'none'),
        'cover_photo': cover_photo,
        'points': points,
        'karma': karma,
        'achievements': achievements,
        'status': status,
    }
    if social is not None:
        result['social'] = social
    return result


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
    """Best-effort — a mail-provider hiccup must never 500 a request whose
    real work (account/token already created in the DB) already succeeded."""
    if not user.email:
        return
    verify_url = f"{_frontend_base_url()}/login?verified=1&token={token.token}"
    try:
        send_mail(
            'Verify your Outverse account',
            f'Welcome to Outverse.\n\nVerify your email by opening:\n{verify_url}\n\nThis link expires in {TOKEN_TTL_HOURS} hours.',
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@outverse.local'),
            [user.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception('Failed to send verification email to user %s', user.id)


def _send_password_reset_email(user, token):
    reset_url = f"{_frontend_base_url()}/reset-password?token={token.token}"
    try:
        send_mail(
            'Reset your Outverse password',
            f'Use this link to reset your password:\n{reset_url}\n\nThis link expires in {TOKEN_TTL_HOURS} hours.',
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@outverse.local'),
            [user.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception('Failed to send password reset email to user %s', user.id)


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
        limited = rate_limit_response(request, 'register', limit=10, window=3600)
        if limited:
            return limited
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        verification_token = _issue_token(user, UserToken.EMAIL_VERIFICATION)
        _send_verification_email(user, verification_token)
        return Response(_user_payload(user, request), status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        limited = rate_limit_response(request, 'login', limit=30, window=300)
        if limited:
            return limited
        # Accept username or email (mobile UI often collects email).
        identifier = (
            request.data.get('username')
            or request.data.get('email')
            or ''
        ).strip()
        password = request.data.get('password')
        login_username = identifier
        if identifier and '@' in identifier:
            matched = User.objects.filter(email__iexact=identifier).first()
            if matched:
                login_username = matched.username
        user = authenticate(
            request, username=login_username, password=password
        )
        if not user:
            return Response({'error': 'Invalid credentials.'}, status=400)
        if getattr(getattr(user, 'profile', None), 'status', None) == 'suspended':
            return Response(
                {'error': 'This account has been suspended.', 'code': 'account_suspended'},
                status=403,
            )
        # Staff/superusers (local demo/admin) skip the email gate.
        if not user.is_verified and not (user.is_staff or user.is_superuser):
            return Response(
                {'error': 'Please verify your email before logging in.', 'code': 'email_not_verified'},
                status=403,
            )
        from .models import UserTwoFactor
        tf = UserTwoFactor.objects.filter(user=user, is_enabled=True).first()
        if tf:
            from .account_views import _issue_two_fa_pending
            pending = _issue_two_fa_pending(user)
            return Response({
                'requires_2fa': True,
                'pending_token': pending.token,
            })
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


class ResendVerificationEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        limited = rate_limit_response(request, 'resend_verification', limit=5, window=3600)
        if limited:
            return limited
        email = (request.data.get('email') or '').strip()
        user = User.objects.filter(email__iexact=email).first() if email else None
        if user and not user.is_verified and user.email:
            token = _issue_token(user, UserToken.EMAIL_VERIFICATION)
            _send_verification_email(user, token)
        return Response({'message': 'If that account needs verifying, a new link has been sent.'})


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        limited = rate_limit_response(request, 'forgot_password', limit=5, window=3600)
        if limited:
            return limited
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


class UserByUsernameView(APIView):
    """Resolves a @username to a full public profile (case-insensitive)."""
    permission_classes = [AllowAny]

    def get(self, request, username):
        user = (
            _with_public_counts(
                User.objects.select_related('profile').filter(username__iexact=username)
            ).first()
        )
        if not user:
            return Response({'detail': 'Not found.'}, status=404)
        viewer = user_from_request(request)
        if viewer and viewer.id != user.id and is_blocked_between(viewer.id, user.id):
            return Response({'detail': 'Not found.'}, status=404)
        is_following = False
        social = None
        if viewer and viewer.id != user.id:
            is_following = Follow.objects.filter(
                follower_id=viewer.id, following_id=user.id
            ).exists()
            social = social_status_for(viewer.id, user.id)
        return Response(
            _public_user_dict(user, request, is_following=is_following, social=social)
        )


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



def _passport_data_for_user(user):
    """Compute passport stamps for any user."""
    from bottles.models import MessageBottle
    from capsules.models import TimeCapsule
    from communities.models import CommunityMembership
    from ideas.models import Idea
    from reels.models import LiveSession

    try:
        from questions.ritual import current_streak
    except Exception:
        current_streak = lambda _u: 0  # noqa: E731

    live_count = LiveSession.objects.filter(user=user, status='ended').count()
    stamps = {
        'lab_streak': current_streak(user),
        'bottles_caught': MessageBottle.objects.filter(caught_by=user).count(),
        'ideas_launched': Idea.objects.filter(owner=user).count(),
        'capsules_opened': TimeCapsule.objects.filter(user=user, opened_at__isnull=False).count(),
        'communities_joined': CommunityMembership.objects.filter(user=user, status='active').count(),
        'lives_hosted': live_count,
    }
    worlds = [
        {'world': 'The Lab', 'key': 'lab', 'count': stamps['lab_streak'], 'label': 'day streak'},
        {'world': 'The Vault', 'key': 'bottles', 'count': stamps['bottles_caught'], 'label': 'bottles caught'},
        {'world': 'The Bazaar', 'key': 'ideas', 'count': stamps['ideas_launched'], 'label': 'ideas launched'},
        {'world': 'Time Capsules', 'key': 'capsules', 'count': stamps['capsules_opened'], 'label': 'capsules opened'},
        {'world': 'Communities', 'key': 'communities', 'count': stamps['communities_joined'], 'label': 'joined'},
        {'world': 'Live', 'key': 'live', 'count': stamps['lives_hosted'], 'label': 'lives hosted'},
    ]
    return {'stamps': stamps, 'worlds': worlds}


class PassportsView(APIView):
    """World passport stamps computed from existing activity tables."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_passport_data_for_user(request.user))


class ExperienceListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = Experience.objects.filter(user=request.user)
        return Response(ExperienceSerializer(rows, many=True).data)

    def post(self, request):
        serializer = ExperienceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        experience = serializer.save(user=request.user)
        return Response(ExperienceSerializer(experience).data, status=201)


class ExperienceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_experience(self, request, experience_id):
        return get_object_or_404(Experience, id=experience_id, user=request.user)

    def patch(self, request, experience_id):
        experience = self._get_experience(request, experience_id)
        serializer = ExperienceSerializer(experience, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, experience_id):
        experience = self._get_experience(request, experience_id)
        experience.delete()
        return Response(status=204)


class PublicExperienceView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        target_user = get_object_or_404(User, id=user_id)
        viewer = user_from_request(request)
        if viewer and is_blocked_between(viewer.id, target_user.id):
            return Response({'error': 'Profile unavailable.'}, status=404)
        rows = Experience.objects.filter(user=target_user)
        return Response(ExperienceSerializer(rows, many=True).data)


class PublicPassportsView(APIView):
    """Public passport stamps for any user by ID."""

    permission_classes = [AllowAny]

    def get(self, request, user_id):
        target_user = get_object_or_404(User, id=user_id)
        viewer = user_from_request(request)
        if viewer and is_blocked_between(viewer.id, target_user.id):
            return Response({'error': 'Profile unavailable.'}, status=404)
        return Response(_passport_data_for_user(target_user))

class YearInView(APIView):
    """Annual emotional recap for the signed-in user — Outverse's "Wrapped".

    ``GET /api/users/me/year/?year=2026``
    Aggregates posts, capsules opened, rooms joined, ritual streak, top
    categories and tags, first post of the year, total words written, and
    voice notes. Returns a single JSON object shaped for a one-page
    animated recap on the frontend.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            year = int(request.query_params.get('year', timezone.now().year))
        except (TypeError, ValueError):
            year = timezone.now().year
        year_start = timezone.make_aware(
            __import__('datetime').datetime(year, 1, 1)
        )
        year_end = timezone.make_aware(
            __import__('datetime').datetime(year + 1, 1, 1)
        )
        user = request.user

        from posts.models import Post, PostMedia
        from capsules.models import TimeCapsule
        from chat.models import ChatRoom
        try:
            from questions.models import RitualParticipation
        except Exception:
            RitualParticipation = None

        posts_qs = Post.objects.filter(user=user, created_at__gte=year_start, created_at__lt=year_end)
        posts_count = posts_qs.count()
        words_written = 0
        longest_post_chars = 0
        first_post = None
        for p in posts_qs.order_by('created_at'):
            words_written += len(p.text.split())
            longest_post_chars = max(longest_post_chars, len(p.text))
            if first_post is None and p.text.strip():
                first_post = {
                    'id': p.id,
                    'text': p.text[:160],
                    'created_at': p.created_at.isoformat(),
                }

        # Top tags
        tag_counts: dict[str, int] = {}
        for tags in posts_qs.exclude(tags=[]).values_list('tags', flat=True):
            for tag in tags:
                if not tag:
                    continue
                key = str(tag).strip().lower()
                if not key:
                    continue
                tag_counts[key] = tag_counts.get(key, 0) + 1
        top_tags = sorted(tag_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]

        # Top categories — from posts that answer a question (inspired_posts link)
        # and from ritual participations.
        cat_counts: dict[str, int] = {}
        if RitualParticipation is not None:
            for rp in RitualParticipation.objects.filter(
                user=user, date__gte=year_start.date(), date__lt=year_end.date(),
                completed_at__isnull=False,
            ).select_related('question'):
                if rp.question and rp.question.category:
                    cat_counts[rp.question.category] = cat_counts.get(rp.question.category, 0) + 1
        # Count posts whose linked question category (if any) — heuristic via tags is skipped.
        top_categories = sorted(cat_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]

        # Capsules
        capsules_created = TimeCapsule.objects.filter(
            user=user, created_at__gte=year_start, created_at__lt=year_end
        ).count()
        capsules_opened = TimeCapsule.objects.filter(
            user=user, opened_at__gte=year_start, opened_at__lt=year_end
        ).count()

        # Rooms joined — approximate via membership where room was created this year.
        rooms_joined = (
            ChatRoom.objects
            .filter(members=user, created_at__gte=year_start, created_at__lt=year_end)
            .distinct().count()
        )

        # Rituals
        ritual_days = 0
        ritual_max_streak = 0
        if RitualParticipation is not None:
            # distinct(): a day can have both a morning and evening row —
            # count calendar days, not participation rows.
            ritual_dates = sorted(set(
                RitualParticipation.objects.filter(
                    user=user, date__gte=year_start.date(), date__lt=year_end.date(),
                    completed_at__isnull=False,
                ).values_list('date', flat=True)
            ))
            ritual_days = len(ritual_dates)
            # Compute max consecutive-day streak.
            prev = None
            run = 0
            for d in ritual_dates:
                if prev is not None and (d - prev).days == 1:
                    run += 1
                else:
                    run = 1
                ritual_max_streak = max(ritual_max_streak, run)
                prev = d

        # Voice notes
        voice_notes = (
            PostMedia.objects
            .filter(media_type='audio', post__user=user,
                    post__created_at__gte=year_start, post__created_at__lt=year_end)
            .count()
        )

        return Response({
            'year': year,
            'posts_count': posts_count,
            'words_written': words_written,
            'longest_post_chars': longest_post_chars,
            'first_post': first_post,
            'top_tags': [{'tag': t, 'count': c} for t, c in top_tags],
            'top_categories': [{'category': c, 'count': n} for c, n in top_categories],
            'capsules_created': capsules_created,
            'capsules_opened': capsules_opened,
            'rooms_joined': rooms_joined,
            'ritual_days': ritual_days,
            'ritual_max_streak': ritual_max_streak,
            'voice_notes': voice_notes,
            'username': user.username,
            'display_name': (f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username),
        })


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
        if following_ids:
            qs = qs.exclude(id__in=following_ids)
        if viewer:
            hidden_ids = feed_hidden_author_ids(viewer.id)
            if hidden_ids:
                qs = qs.exclude(id__in=hidden_ids)

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
        if viewer and viewer.id != user_id and is_blocked_between(viewer.id, user_id):
            return Response({'error': 'Profile unavailable.'}, status=404)
        is_following = False
        social = None
        if viewer and viewer.id != user_id:
            is_following = Follow.objects.filter(
                follower_id=viewer.id, following_id=user_id
            ).exists()
            social = social_status_for(viewer.id, user_id)
        payload = _public_user_dict(user, request, is_following=is_following, social=social)
        payload['achievements'] = full_achievements_for_profile(payload['achievements'])
        return Response(payload)


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
        viewer = user_from_request(request)
        if viewer and viewer.id != user_id and is_blocked_between(viewer.id, user_id):
            return Response({'detail': 'Not found.'}, status=404)
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
        viewer = user_from_request(request)
        if viewer and viewer.id != user_id and is_blocked_between(viewer.id, user_id):
            return Response({'detail': 'Not found.'}, status=404)
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
        if is_blocked_between(follower_id, int(following_id)):
            return Response({'error': 'Cannot follow this user.'}, status=403)

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
    permission_classes = [IsAdminUser]

    def perform_update(self, serializer):
        previous_unlocked = _unlocked_achievement_titles(serializer.instance.achievements)
        previous_status = serializer.instance.status
        profile = serializer.save()
        if profile.status != previous_status:
            from audit.utils import log_action
            log_action(
                self.request, 'UPDATE',
                f'Changed @{profile.user.username} status: {previous_status} -> {profile.status}.',
                target_user=profile.user,
            )
        newly_unlocked = _unlocked_achievement_titles(profile.achievements) - previous_unlocked
        for achievement in profile.achievements or []:
            if achievement.get('title') in newly_unlocked:
                create_notification(
                    recipient_id=profile.user_id,
                    actor_id=None,
                    verb='achievement_unlocked',
                    notification_type='achievement',
                    text=(
                        f"Unlocked \"{achievement.get('title', 'Achievement')}\"! "
                        f"{achievement.get('progress', 0)}/{achievement.get('goal', 0)} "
                        f"{achievement.get('category', '')} completed."
                    ),
                )


class PromoteStaffView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        if user.is_staff:
            return Response({'promoted': False, 'detail': 'User is already staff.'})
        user.is_staff = True
        user.save(update_fields=['is_staff'])
        from audit.utils import log_action
        log_action(request, 'UPDATE', f'Promoted @{user.username} to staff.', target_user=user)
        return Response({'promoted': True, 'user_id': user.id})


class ToggleShadowBanView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        user.is_shadow_banned = not user.is_shadow_banned
        user.save(update_fields=['is_shadow_banned'])
        from audit.utils import log_action
        log_action(
            request, 'MODERATE',
            f'{"Shadow-banned" if user.is_shadow_banned else "Lifted shadow-ban for"} @{user.username}.',
            target_user=user,
        )
        return Response({'is_shadow_banned': user.is_shadow_banned, 'user_id': user.id})


class UserSocialView(APIView):
    """Block, mute, or restrict another user."""

    permission_classes = [IsAuthenticated]

    ACTIONS = {
        'block': UserBlock,
        'mute': UserMute,
        'restrict': UserRestrict,
    }
    FIELD_MAP = {
        'block': ('blocker', 'blocked'),
        'mute': ('muter', 'muted'),
        'restrict': ('restricter', 'restricted'),
    }

    def post(self, request):
        action = (request.data.get('action') or '').lower()
        target_id = request.data.get('user_id')
        if action not in self.ACTIONS:
            return Response({'error': 'Invalid action.'}, status=400)
        if not target_id:
            return Response({'error': 'user_id is required.'}, status=400)
        try:
            target_id = int(target_id)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid user_id.'}, status=400)
        if target_id == request.user.id:
            return Response({'error': 'Invalid target.'}, status=400)
        if not User.objects.filter(id=target_id).exists():
            return Response({'error': 'User not found.'}, status=404)

        model = self.ACTIONS[action]
        a_field, b_field = self.FIELD_MAP[action]
        lookup = {a_field: request.user, f'{b_field}_id': target_id}
        if request.data.get('undo'):
            model.objects.filter(**lookup).delete()
            active = False
        else:
            _, created = model.objects.get_or_create(**lookup)
            active = True
            if action == 'block' and created:
                apply_block_side_effects(request.user.id, target_id)

        return Response({
            'action': action,
            'user_id': target_id,
            'active': active,
            'social': social_status_for(request.user.id, target_id),
        })


class UserSocialListView(APIView):
    permission_classes = [IsAuthenticated]

    LISTS = {
        'blocked': (UserBlock, 'blocked', 'blocked_id'),
        'muted': (UserMute, 'muted', 'muted_id'),
        'restricted': (UserRestrict, 'restricted', 'restricted_id'),
    }
    FILTER_FIELDS = {
        'blocked': 'blocker',
        'muted': 'muter',
        'restricted': 'restricter',
    }

    def get(self, request):
        list_type = (request.query_params.get('type') or 'blocked').lower()
        if list_type not in self.LISTS:
            return Response({'error': 'Invalid type.'}, status=400)
        model, rel, id_field = self.LISTS[list_type]
        filter_field = self.FILTER_FIELDS[list_type]
        ids = list(
            model.objects.filter(**{filter_field: request.user}).values_list(id_field, flat=True)
        )
        users = _with_public_counts(
            User.objects.filter(id__in=ids).select_related('profile')
        )
        return Response([
            _public_user_dict(u, request, social=social_status_for(request.user.id, u.id))
            for u in users
        ])
