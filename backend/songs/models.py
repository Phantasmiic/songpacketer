from django.db import models


class Song(models.Model):
    source_id = models.CharField(max_length=128, unique=True)
    title = models.CharField(max_length=255)
    key = models.CharField(max_length=32, blank=True)
    language = models.CharField(max_length=32, default='english')
    lyrics_plain = models.TextField(blank=True)
    lyrics_chordpro = models.TextField(blank=True)
    raw_lyrics_source = models.TextField(blank=True)
    parsed_lyrics_ast = models.JSONField(default=dict, blank=True)
    raw_html = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['title']),
            models.Index(fields=['language']),
        ]

    def __str__(self) -> str:
        return self.title


class SongVersion(models.Model):
    song = models.ForeignKey(Song, related_name='versions', on_delete=models.CASCADE)
    tune_name = models.CharField(max_length=255, blank=True)
    capo_default = models.PositiveSmallIntegerField(default=0)
    lyrics_chordpro = models.TextField(blank=True)
    raw_html = models.TextField(blank=True)

    class Meta:
        unique_together = ('song', 'tune_name')

    def __str__(self) -> str:
        return f'{self.song.title} ({self.tune_name or "default"})'
