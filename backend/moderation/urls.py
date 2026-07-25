from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContentAppealViewSet, FlaggedContentViewSet, ReportUserView

router = DefaultRouter()
router.register(r'flagged', FlaggedContentViewSet)
router.register(r'appeals', ContentAppealViewSet, basename='content-appeal')

urlpatterns = [
    path('report-user/', ReportUserView.as_view(), name='report-user'),
    path('', include(router.urls)),
]