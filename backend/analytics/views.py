from rest_framework.views import APIView
from rest_framework.response import Response
from users.models import User
from challenges.models import Challenge
from ideas.models import Idea
from moods.models import Mood
from bottles.models import MessageBottle
from stories.models import Story
from shop.models import ShopItem

class PlatformAnalyticsView(APIView):
    def get(self, request):
        data = {
            'users': User.objects.count(),
            'challenges': Challenge.objects.count(),
            'ideas': Idea.objects.count(),
            'moods': Mood.objects.count(),
            'bottles': MessageBottle.objects.count(),
            'stories': Story.objects.count(),
            'shop_items': ShopItem.objects.count(),
        }
        return Response(data) 