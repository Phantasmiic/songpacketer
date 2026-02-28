from django.urls import path

from .views import (
    ApiRootView,
    MatchSongsView,
    PacketGenerateView,
    PacketOptimizeOrderView,
    PacketPreviewView,
    SongbaseSourceSampleInspectView,
    SongbaseSourceSampleView,
    SongbaseSyncView,
    SongVersionListView,
)

urlpatterns = [
    path('', ApiRootView.as_view(), name='api-root'),
    path('songs/match', MatchSongsView.as_view(), name='songs-match'),
    path('songs/<int:song_id>/versions', SongVersionListView.as_view(), name='song-versions'),
    path('songs/sync', SongbaseSyncView.as_view(), name='songs-sync'),
    path('songs/source-sample', SongbaseSourceSampleView.as_view(), name='songs-source-sample'),
    path('songs/source-sample/inspect', SongbaseSourceSampleInspectView.as_view(), name='songs-source-sample-inspect'),
    path('packet/preview', PacketPreviewView.as_view(), name='packet-preview'),
    path('packet/generate', PacketGenerateView.as_view(), name='packet-generate'),
    path('packet/optimize-order', PacketOptimizeOrderView.as_view(), name='packet-optimize-order'),
]
