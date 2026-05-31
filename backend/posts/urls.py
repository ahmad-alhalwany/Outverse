from django.urls import path, include
from rest_framework.routers import DefaultRouter
<<<<<<< HEAD
from .views import CommentViewSet, PostViewSet, SearchView

router = DefaultRouter()
router.register(r'posts', PostViewSet)
router.register(r'comments', CommentViewSet, basename='comment')

urlpatterns = [
    path('search/', SearchView.as_view(), name='search'),
    path('', include(router.urls)),
]
=======
from .views import PostViewSet

router = DefaultRouter()
router.register(r'posts', PostViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
