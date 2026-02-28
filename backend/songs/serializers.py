from rest_framework import serializers
from .models import SongVersion


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
