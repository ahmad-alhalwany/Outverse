from rest_framework.views import APIView
from rest_framework.response import Response

class SystemHealthView(APIView):
    def get(self, request):
        # يمكنك لاحقاً جعل هذه البيانات ديناميكية حسب حالة النظام الفعلية
        services = [
            {"name": "API Gateway", "status": "operational", "color": "#4caf50", "lastCheck": "Just now"},
            {"name": "Database", "status": "operational", "color": "#4caf50", "lastCheck": "Just now"},
            {"name": "Redis Cache", "status": "degraded", "color": "#FFB300", "lastCheck": "2 mins ago"},
            {"name": "Email Service", "status": "down", "color": "#FF3B3B", "lastCheck": "5 mins ago"},
        ]
        return Response({"services": services}) 