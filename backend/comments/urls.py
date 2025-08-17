from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CommentViewSet, CommentReactionViewSet

router = DefaultRouter()
router.register(r'comments', CommentViewSet)
router.register(r'comment-reactions', CommentReactionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
