from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CommentViewSet, PostViewSet, SearchView, StaffCommentModerationView, StaffPostModerationView

router = DefaultRouter()
router.register(r'posts', PostViewSet)
router.register(r'comments', CommentViewSet, basename='comment')

urlpatterns = [
    path('search/', SearchView.as_view(), name='search'),
    path('staff/posts/', StaffPostModerationView.as_view(), name='staff-posts'),
    path('staff/comments/', StaffCommentModerationView.as_view(), name='staff-comments'),
    path('', include(router.urls)),
]
