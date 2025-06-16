from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = []  # السماح للجميع مؤقتاً أثناء التطوير
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action', 'user', 'created_at']
    search_fields = ['description', 'ip_address', 'user__email']
    ordering_fields = ['created_at', 'action']
    ordering = ['-created_at'] 