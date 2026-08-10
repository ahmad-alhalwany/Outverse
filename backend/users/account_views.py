"""Account security: OAuth, 2FA, GDPR export/delete, verification."""

from __future__ import annotations

import secrets

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from outverse.rate_limit import rate_limit_response

from .data_export import build_user_export
from .models import Profile, SellerApplication, SocialAuthAccount, UserToken, UserTwoFactor, VerificationRequest
from .oauth_google import GoogleAuthError, username_from_google, verify_google_id_token
from .oauth_apple import AppleAuthError, username_from_apple, verify_apple_identity_token
from .totp import (
    generate_backup_codes,
    generate_totp_secret,
    hash_backup_code,
    provisioning_uri,
    verify_backup_code,
    verify_totp,
)
from .views import _user_payload

User = get_user_model()
TWO_FA_PENDING_MINUTES = 5


def _issue_two_fa_pending(user):
    UserToken.objects.filter(
        user=user,
        token_type=UserToken.TWO_FA_PENDING,
        used_at__isnull=True,
    ).update(used_at=timezone.now())
    return UserToken.objects.create(
        user=user,
        token=secrets.token_urlsafe(32),
        token_type=UserToken.TWO_FA_PENDING,
        expires_at=timezone.now() + timezone.timedelta(minutes=TWO_FA_PENDING_MINUTES),
    )


def _two_factor_record(user):
    return UserTwoFactor.objects.filter(user=user).first()


def _complete_login(user, request):
    return Response(_user_payload(user, request))


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        limited = rate_limit_response(request, 'google_auth', limit=20, window=300)
        if limited:
            return limited
        id_token = (request.data.get('id_token') or '').strip()
        try:
            data = verify_google_id_token(id_token)
        except GoogleAuthError as exc:
            return Response({'error': str(exc)}, status=400)

        provider_uid = data.get('sub')
        email = (data.get('email') or '').lower()
        if not provider_uid:
            return Response({'error': 'Invalid Google profile.'}, status=400)

        social = SocialAuthAccount.objects.filter(
            provider='google', provider_uid=provider_uid,
        ).select_related('user').first()
        if social:
            user = social.user
        else:
            user = User.objects.filter(email__iexact=email).first() if email else None
            if not user:
                user = User.objects.create_user(
                    username=username_from_google(data, User),
                    email=email,
                    password=secrets.token_urlsafe(32),
                    first_name=(data.get('given_name') or '')[:150],
                    last_name=(data.get('family_name') or '')[:150],
                    is_verified=True,
                )
                Profile.objects.get_or_create(user=user)
            SocialAuthAccount.objects.get_or_create(
                provider='google',
                provider_uid=provider_uid,
                defaults={'user': user, 'email': email},
            )

        tf = _two_factor_record(user)
        if tf and tf.is_enabled:
            pending = _issue_two_fa_pending(user)
            return Response({
                'requires_2fa': True,
                'pending_token': pending.token,
            })
        return _complete_login(user, request)


class AppleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        limited = rate_limit_response(request, 'apple_auth', limit=20, window=300)
        if limited:
            return limited
        identity_token = (
            request.data.get('identity_token')
            or request.data.get('id_token')
            or ''
        ).strip()
        try:
            data = verify_apple_identity_token(identity_token)
        except AppleAuthError as exc:
            return Response({'error': str(exc)}, status=400)

        provider_uid = data.get('sub')
        email = (data.get('email') or '').lower()
        if not provider_uid:
            return Response({'error': 'Invalid Apple profile.'}, status=400)

        social = SocialAuthAccount.objects.filter(
            provider='apple', provider_uid=provider_uid,
        ).select_related('user').first()
        if social:
            user = social.user
        else:
            user = User.objects.filter(email__iexact=email).first() if email else None
            if not user:
                user = User.objects.create_user(
                    username=username_from_apple(data, User),
                    email=email or f'{provider_uid[:16]}@privaterelay.appleid.com',
                    password=secrets.token_urlsafe(32),
                    is_verified=True,
                )
                Profile.objects.get_or_create(user=user)
            SocialAuthAccount.objects.get_or_create(
                provider='apple',
                provider_uid=provider_uid,
                defaults={'user': user, 'email': email},
            )

        tf = _two_factor_record(user)
        if tf and tf.is_enabled:
            pending = _issue_two_fa_pending(user)
            return Response({
                'requires_2fa': True,
                'pending_token': pending.token,
            })
        return _complete_login(user, request)


class TwoFactorSetupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tf, _ = UserTwoFactor.objects.get_or_create(
            user=request.user,
            defaults={'totp_secret': generate_totp_secret()},
        )
        if not tf.totp_secret:
            tf.totp_secret = generate_totp_secret()
            tf.save(update_fields=['totp_secret'])
        return Response({
            'secret': tf.totp_secret,
            'otpauth_uri': provisioning_uri(tf.totp_secret, request.user.email or request.user.username),
            'is_enabled': tf.is_enabled,
        })

    def post(self, request):
        code = (request.data.get('code') or '').strip()
        tf = UserTwoFactor.objects.filter(user=request.user).first()
        if not tf or not verify_totp(tf.totp_secret, code):
            return Response({'error': 'Invalid authentication code.'}, status=400)
        backup = generate_backup_codes()
        tf.is_enabled = True
        tf.enabled_at = timezone.now()
        tf.backup_codes = [hash_backup_code(c) for c in backup]
        tf.save(update_fields=['is_enabled', 'enabled_at', 'backup_codes'])
        return Response({
            'enabled': True,
            'backup_codes': backup,
        })

    def delete(self, request):
        password = request.data.get('password') or ''
        if not request.user.check_password(password):
            return Response({'error': 'Invalid password.'}, status=400)
        UserTwoFactor.objects.filter(user=request.user).delete()
        return Response({'enabled': False})


class TwoFactorLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        pending_token = (request.data.get('pending_token') or '').strip()
        code = (request.data.get('code') or '').strip()
        token = UserToken.objects.filter(
            token=pending_token,
            token_type=UserToken.TWO_FA_PENDING,
            used_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).select_related('user').first()
        if not token:
            return Response({'error': 'Login session expired.'}, status=400)

        user = token.user
        tf = _two_factor_record(user)
        if not tf or not tf.is_enabled:
            token.mark_used()
            return _complete_login(user, request)

        ok = verify_totp(tf.totp_secret, code)
        if not ok and tf.backup_codes:
            ok = verify_backup_code(tf.backup_codes, code)
            if ok:
                digest = hash_backup_code(code)
                tf.backup_codes = [h for h in tf.backup_codes if h != digest]
                tf.save(update_fields=['backup_codes'])

        if not ok:
            return Response({'error': 'Invalid authentication code.'}, status=400)

        token.mark_used()
        return _complete_login(user, request)


class AccountExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_user_export(request.user))


class AccountDeactivateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password') or ''
        if not request.user.check_password(password):
            return Response({'error': 'Invalid password.'}, status=400)
        request.user.is_active = False
        request.user.save(update_fields=['is_active'])
        Token.objects.filter(user=request.user).delete()
        return Response({'deactivated': True})


class AccountDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password') or ''
        confirmation = (request.data.get('confirmation') or '').strip()
        if confirmation != 'DELETE':
            return Response({'error': 'Type DELETE to confirm.'}, status=400)
        if not request.user.check_password(password):
            return Response({'error': 'Invalid password.'}, status=400)
        user_id = request.user.id
        with transaction.atomic():
            Token.objects.filter(user_id=user_id).delete()
            User.objects.filter(id=user_id).delete()
        return Response({'deleted': True})


class VerificationRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.badge_verified:
            return Response({'badge_verified': True, 'requests': []})
        rows = VerificationRequest.objects.filter(user=request.user).order_by('-created_at')[:5]
        return Response({
            'badge_verified': False,
            'is_verified': request.user.is_verified,
            'requests': [
                {
                    'id': r.id,
                    'status': r.status,
                    'reason': r.reason,
                    'links': r.links,
                    'created_at': r.created_at.isoformat(),
                    'review_note': r.review_note,
                }
                for r in rows
            ],
        })

    def post(self, request):
        if request.user.badge_verified:
            return Response({'error': 'Already verified.'}, status=400)
        if VerificationRequest.objects.filter(user=request.user, status='pending').exists():
            return Response({'error': 'You already have a pending request.'}, status=400)
        reason = (request.data.get('reason') or '').strip()
        if len(reason) < 20:
            return Response({'error': 'Please explain why you should be verified (20+ chars).'}, status=400)
        links = request.data.get('links') or []
        if not isinstance(links, list):
            links = []
        req = VerificationRequest.objects.create(
            user=request.user,
            reason=reason[:2000],
            links=[str(u)[:500] for u in links[:5]],
        )
        return Response({'id': req.id, 'status': req.status}, status=201)


class AdminVerificationReviewView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        rows = VerificationRequest.objects.filter(status='pending').select_related('user')[:50]
        return Response([
            {
                'id': r.id,
                'user_id': r.user_id,
                'username': r.user.username,
                'reason': r.reason,
                'links': r.links,
                'created_at': r.created_at.isoformat(),
            }
            for r in rows
        ])

    def post(self, request, request_id):
        action = (request.data.get('action') or '').lower()
        if action not in ('approve', 'reject'):
            return Response({'error': 'Invalid action.'}, status=400)
        req = VerificationRequest.objects.filter(pk=request_id).select_related('user').first()
        if not req:
            return Response({'error': 'Not found.'}, status=404)
        req.status = 'approved' if action == 'approve' else 'rejected'
        req.reviewed_by = request.user
        req.review_note = (request.data.get('note') or '')[:1000]
        req.save(update_fields=['status', 'reviewed_by', 'review_note'])
        if action == 'approve':
            req.user.badge_verified = True
            req.user.save(update_fields=['badge_verified'])
        return Response({'id': req.id, 'status': req.status})


class SellerApplicationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_shop_seller:
            return Response({'is_shop_seller': True, 'requests': []})
        rows = SellerApplication.objects.filter(user=request.user).order_by('-created_at')[:5]
        return Response({
            'is_shop_seller': False,
            'requests': [
                {
                    'id': r.id,
                    'status': r.status,
                    'reason': r.reason,
                    'links': r.links,
                    'created_at': r.created_at.isoformat(),
                    'review_note': r.review_note,
                }
                for r in rows
            ],
        })

    def post(self, request):
        if request.user.is_shop_seller:
            return Response({'error': 'You are already an approved seller.'}, status=400)
        if SellerApplication.objects.filter(user=request.user, status='pending').exists():
            return Response({'error': 'You already have a pending application.'}, status=400)
        reason = (request.data.get('reason') or '').strip()
        if len(reason) < 20:
            return Response({'error': 'Please explain what you plan to sell (20+ chars).'}, status=400)
        links = request.data.get('links') or []
        if not isinstance(links, list):
            links = []
        app = SellerApplication.objects.create(
            user=request.user,
            reason=reason[:2000],
            links=[str(u)[:500] for u in links[:5]],
        )
        return Response({'id': app.id, 'status': app.status}, status=201)


class AdminSellerApplicationReviewView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        rows = SellerApplication.objects.filter(status='pending').select_related('user')[:50]
        return Response([
            {
                'id': r.id,
                'user_id': r.user_id,
                'username': r.user.username,
                'reason': r.reason,
                'links': r.links,
                'created_at': r.created_at.isoformat(),
            }
            for r in rows
        ])

    def post(self, request, request_id):
        action = (request.data.get('action') or '').lower()
        if action not in ('approve', 'reject'):
            return Response({'error': 'Invalid action.'}, status=400)
        app = SellerApplication.objects.filter(pk=request_id).select_related('user').first()
        if not app:
            return Response({'error': 'Not found.'}, status=404)
        app.status = 'approved' if action == 'approve' else 'rejected'
        app.reviewed_by = request.user
        app.review_note = (request.data.get('note') or '')[:1000]
        app.save(update_fields=['status', 'reviewed_by', 'review_note'])
        if action == 'approve':
            app.user.is_shop_seller = True
            app.user.save(update_fields=['is_shop_seller'])
        return Response({'id': app.id, 'status': app.status})
