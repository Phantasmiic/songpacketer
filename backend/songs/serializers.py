from rest_framework import serializers
from .models import SongPacket, SongPacketEditEvent, SongPacketVersion, SongVersion


class MatchRequestSerializer(serializers.Serializer):
    input_text = serializers.CharField(required=False, allow_blank=True)
    queries = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )


class SongVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SongVersion
        fields = ('id', 'tune_name', 'capo_default', 'lyrics_chordpro')


class PacketSelectionSerializer(serializers.Serializer):
    input_text = serializers.CharField(required=False, allow_blank=True)
    song_id = serializers.IntegerField()
    version_id = serializers.IntegerField(required=False, allow_null=True)
    capo = serializers.IntegerField(required=False, min_value=0, max_value=12)
    chordpro_override = serializers.CharField(required=False, allow_blank=True)
    title_override = serializers.CharField(required=False, allow_blank=True)
    force_new_page = serializers.BooleanField(required=False, default=False)


class PacketRequestSerializer(serializers.Serializer):
    selections = PacketSelectionSerializer(many=True)
    maintain_original_order = serializers.BooleanField(required=False, default=False)


class SongPacketVersionMetaSerializer(serializers.ModelSerializer):
    class Meta:
        model = SongPacketVersion
        fields = (
            'id',
            'version_number',
            'description',
            'page_count',
            'song_spills',
            'created_at',
            'previous_version_id',
        )


class SongPacketEditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SongPacketEditEvent
        fields = (
            'id',
            'event_type',
            'summary',
            'change',
            'created_at',
            'packet_version_id',
        )


class SongPacketSerializer(serializers.ModelSerializer):
    latest_version = serializers.SerializerMethodField()
    current_version = SongPacketVersionMetaSerializer(read_only=True)

    class Meta:
        model = SongPacket
        fields = (
            'id',
            'title',
            'latest_version_number',
            'created_at',
            'updated_at',
            'current_version',
            'latest_version',
        )

    def get_latest_version(self, obj: SongPacket):
        version = obj.versions.order_by('-version_number').first()
        if not version:
            return None
        return SongPacketVersionMetaSerializer(version).data


class SongPacketCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    initial_state = serializers.JSONField(required=False)


class SongPacketStateUpdateSerializer(serializers.Serializer):
    state = serializers.JSONField()
    event_type = serializers.CharField(required=False, max_length=64, allow_blank=True)
    summary = serializers.CharField(required=False, max_length=255, allow_blank=True)
    change = serializers.JSONField(required=False)


class SongPacketSaveVersionSerializer(serializers.Serializer):
    description = serializers.CharField(required=False, allow_blank=True)


class SongPacketActivateVersionSerializer(serializers.Serializer):
    version_id = serializers.IntegerField()
