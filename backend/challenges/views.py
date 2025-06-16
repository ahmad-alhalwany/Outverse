from django.shortcuts import render
from rest_framework import viewsets
from .models import Challenge
from .serializers import ChallengeSerializer

# Create your views here.

class ChallengeViewSet(viewsets.ModelViewSet):
    queryset = Challenge.objects.all().order_by('-created_at')
    serializer_class = ChallengeSerializer
