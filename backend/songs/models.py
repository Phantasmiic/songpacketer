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


class SongPacket(models.Model):
    session_key = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=255)
    current_state = models.JSONField(default=dict, blank=True)
    latest_version_number = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    current_version = models.ForeignKey(
        'SongPacketVersion',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )

    class Meta:
        indexes = [
            models.Index(fields=['session_key', 'updated_at']),
        ]

    def __str__(self) -> str:
        return f'{self.title} (session={self.session_key})'


class SongPacketVersion(models.Model):
    packet = models.ForeignKey(SongPacket, related_name='versions', on_delete=models.CASCADE)
    version_number = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True)
    page_count = models.PositiveIntegerField(null=True, blank=True)
    song_spills = models.PositiveIntegerField(null=True, blank=True)
    previous_version = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='next_versions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('packet', 'version_number')
        indexes = [
            models.Index(fields=['packet', 'version_number']),
        ]

    def __str__(self) -> str:
        return f'{self.packet.title} v{self.version_number}'


class SongPacketEditEvent(models.Model):
    packet = models.ForeignKey(SongPacket, related_name='edit_events', on_delete=models.CASCADE)
    packet_version = models.ForeignKey(
        SongPacketVersion,
        null=True,
        blank=True,
        related_name='edit_events',
        on_delete=models.SET_NULL,
    )
    event_type = models.CharField(max_length=64, default='update')
    summary = models.CharField(max_length=255, blank=True)
    change = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['packet', 'created_at']),
        ]

    def __str__(self) -> str:
        return f'{self.packet.title} {self.event_type} @{self.created_at.isoformat()}'
