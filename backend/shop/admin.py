from django.contrib import admin
from .models import CoinPack, CoinPurchase, ShopItem, Transaction

# Register your models here.
admin.site.register(ShopItem)
admin.site.register(Transaction)
admin.site.register(CoinPack)
admin.site.register(CoinPurchase)
