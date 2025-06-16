from django.shortcuts import render
from rest_framework import viewsets
from .models import FlaggedContent
from .serializers import FlaggedContentSerializer

# Create your views here.

class FlaggedContentViewSet(viewsets.ModelViewSet):
    queryset = FlaggedContent.objects.all().order_by('-created_at')
    serializer_class = FlaggedContentSerializer
