from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CreatorSuggestionsView,
    FollowView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    MeView,
    OnboardingOptionsView,
    ProfileViewSet,
    RegisterView,
    ResetPasswordView,
    UserFollowersView,
    UserFollowingView,
    UserMentionSearchView,
    UserProfileUpdateView,
    UserProfileView,
    UsernameAvailabilityView,
    VerifyEmailView,
    PromoteStaffView,
)

router = DefaultRouter()
router.register(r'profiles', ProfileViewSet)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('check-username/', UsernameAvailabilityView.as_view(), name='check-username'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('onboarding-options/', OnboardingOptionsView.as_view(), name='onboarding-options'),
    path('suggestions/', CreatorSuggestionsView.as_view(), name='suggestions'),
    path('mentions/', UserMentionSearchView.as_view(), name='user-mentions'),
    path('follow/', FollowView.as_view(), name='follow'),
    path('<int:user_id>/promote/', PromoteStaffView.as_view(), name='user-promote-staff'),
    path('<int:user_id>/followers/', UserFollowersView.as_view(), name='user-followers'),
    path('<int:user_id>/following/', UserFollowingView.as_view(), name='user-following'),
    path('<int:user_id>/update/', UserProfileUpdateView.as_view(), name='user-profile-update'),
    path('<int:user_id>/', UserProfileView.as_view(), name='user-profile'),
    path('', include(router.urls)),
]
