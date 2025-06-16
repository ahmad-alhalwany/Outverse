from django.contrib import admin
from .models import ShopItem, Transaction

# Register your models here.
admin.site.register(ShopItem)
admin.site.register(Transaction)
