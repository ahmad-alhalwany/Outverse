from django.contrib.auth import authenticate, get_user_model
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from outverse.auth_utils import user_from_request
from rest_framework import viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.utils import create_notification

from .models import Follow, Profile
from .serializers import (
    ProfileSerializer,
    RegisterSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
)

User = get_user_model()


def _avatar_url(user, request):
    if getattr(user, 'avatar', None) and user.avatar:
        if request:
            return request.build_absolute_uri(user.avatar.url)
        return user.avatar.url
    return None


def _public_user_dict(user, request, is_following=False, posts_count=None):
    return {
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'bio': user.bio,
        'location': getattr(user, 'location', '') or '',
        'avatar': _avatar_url(user, request),
        'posts_count': posts_count if posts_count is not None else user.posts.count(),
        'followers_count': Follow.objects.filter(following_id=user.id).count(),
        'following_count': Follow.objects.filter(follower_id=user.id).count(),
        'is_following': is_following,
    }


def _user_payload(user, request=None):
    serializer = UserSerializer(user, context={'request': request})
    token, _ = Token.objects.get_or_create(user=user)
    return {'token': token.key, 'user': serializer.data}


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
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
        return Response(_user_payload(user, request))


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user, context={'request': request})
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
        qs = User.objects.annotate(
            posts_count=Count('posts', distinct=True),
            followers_count=Count('followers', distinct=True),
        ).order_by('-posts_count', '-followers_count', '-id')
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


class UserProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
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
        is_following = False
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
        return Response([
            {
                **_public_user_dict(f.follower, request),
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
        return Response([
            {
                **_public_user_dict(f.following, request),
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

        existing = Follow.objects.filter(
            follower_id=follower_id, following_id=following_id
        ).first()
        if existing:
            existing.delete()
            is_following = False
        else:
            Follow.objects.create(
                follower_id=follower_id, following_id=following_id
            )
            is_following = True
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
