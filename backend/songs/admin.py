from django.contrib import admin
from .models import Song, SongVersion


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ('title', 'key', 'language', 'created_at')
    search_fields = ('title', 'lyrics_plain')


@admin.register(SongVersion)
class SongVersionAdmin(admin.ModelAdmin):
    list_display = ('song', 'tune_name', 'capo_default')
    search_fields = ('song__title', 'tune_name')
