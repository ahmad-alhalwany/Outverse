from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CreatorSuggestionsView,
    FollowView,
    LoginView,
    LogoutView,
    MeView,
    ProfileViewSet,
    RegisterView,
    UserFollowersView,
    UserFollowingView,
    UserMentionSearchView,
    UserProfileUpdateView,
    UserProfileView,
)

router = DefaultRouter()
router.register(r'profiles', ProfileViewSet)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('suggestions/', CreatorSuggestionsView.as_view(), name='suggestions'),
    path('mentions/', UserMentionSearchView.as_view(), name='user-mentions'),
    path('follow/', FollowView.as_view(), name='follow'),
    path('<int:user_id>/followers/', UserFollowersView.as_view(), name='user-followers'),
    path('<int:user_id>/following/', UserFollowingView.as_view(), name='user-following'),
    path('<int:user_id>/update/', UserProfileUpdateView.as_view(), name='user-profile-update'),
    path('<int:user_id>/', UserProfileView.as_view(), name='user-profile'),
    path('', include(router.urls)),
]
