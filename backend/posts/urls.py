from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CommentViewSet,
    OrbitListViewSet,
    PostDraftViewSet,
    PostViewSet,
    SavedCollectionViewSet,
    ScheduledPostViewSet,
    SearchView,
    StaffCommentModerationView,
    StaffPostModerationView,
)

router = DefaultRouter()
router.register(r'posts', PostViewSet)
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'drafts', PostDraftViewSet, basename='post-draft')
router.register(r'collections', SavedCollectionViewSet, basename='saved-collection')
router.register(r'scheduled-posts', ScheduledPostViewSet, basename='scheduled-post')
router.register(r'orbit-lists', OrbitListViewSet, basename='orbit-list')

urlpatterns = [
    path('search/', SearchView.as_view(), name='search'),
    path('staff/posts/', StaffPostModerationView.as_view(), name='staff-posts'),
    path('staff/comments/', StaffCommentModerationView.as_view(), name='staff-comments'),
    path('', include(router.urls)),
]
