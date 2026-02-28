import logging
import time
import requests
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.html import escape
from requests import RequestException
from rest_framework import status
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.views import APIView

from .imports import sync_songbase_english
from .models import Song, SongVersion
from .pdf import (
    RenderedSong,
    chordpro_to_lines,
    compute_packet_song_order,
    estimate_packet_layout,
    render_song_packet_pdf,
)
from .serializers import (
    MatchRequestSerializer,
    PacketRequestSerializer,
    SongVersionSerializer,
)
from .services import find_song_candidates, split_queries

logger = logging.getLogger(__name__)


def _debug_event(message: str) -> None:
    print(message, flush=True)
    logger.info(message)


class ApiRootView(APIView):
    def get(self, request):
        return Response(
            {
                'match_songs': reverse('songs-match', request=request),
                'song_versions_template': reverse('song-versions', args=[1], request=request),
                'sync_songbase_english': reverse('songs-sync', request=request),
                'songbase_source_sample': reverse('songs-source-sample', request=request),
                'songbase_source_sample_inspect': reverse('songs-source-sample-inspect', request=request),
                'packet_preview': reverse('packet-preview', request=request),
                'packet_generate': reverse('packet-generate', request=request),
                'packet_optimize_order': reverse('packet-optimize-order', request=request),
                'docs': {
                    'songbase_source_sample': {
                        'method': 'GET',
                        'path': '/api/songs/source-sample',
                        'description': 'Fetches one sample song from Songbase API v2 so you can inspect raw upstream fields.',
                        'sample_response': {
                            'source_url': 'https://songbase.life/api/v2/app_data',
                            'language': 'english',
                            'upstream_song_count': 1234,
                            'sample_song': {
                                'id': 123,
                                'title': 'Sample Title',
                                'lang': 'english',
                                'lyrics': '### Original tune\\n# Capo 2\\n[C]Line...',
                                'language_links': [456, 789],
                            },
                        },
                    },
                    'packet_formatting_mode': {
                        'field': 'maintain_original_order',
                        'applies_to': [
                            '/api/packet/preview',
                            '/api/packet/generate',
                            '/api/packet/optimize-order',
                        ],
                        'behavior': {
                            'true': 'Keep song order exactly as selected; render sequentially and allow overflow/splitting as needed.',
                            'false': 'Reorder songs with a packing heuristic to reduce page count and empty space.',
                        },
                    },
                    'packet_optimize_order': {
                        'method': 'POST',
                        'path': '/api/packet/optimize-order',
                        'description': 'Returns optimized selection order indices used for PDF generation.',
                    },
                },
            }
        )


class MatchSongsView(APIView):
    def post(self, request):
        serializer = MatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        input_text = serializer.validated_data.get('input_text', '')
        queries = serializer.validated_data.get('queries', [])
        normalized_queries = split_queries(input_text, queries)

        results = []
        for query in normalized_queries:
            candidates = find_song_candidates(query, limit=10)
            selected = candidates[0] if candidates and candidates[0].score >= 0.5 else None
            results.append(
                {
                    'input': query,
                    'selected': {
                        'song_id': selected.song_id,
                        'title': selected.title,
                        'key': selected.key,
                        'score': selected.score,
                    }
                    if selected
                    else None,
                    'candidates': [
                        {
                            'song_id': candidate.song_id,
                            'title': candidate.title,
                            'key': candidate.key,
                            'score': candidate.score,
                        }
                        for candidate in candidates
                    ],
                }
            )

        return Response({'results': results})


class SongVersionListView(APIView):
    def get(self, request, song_id: int):
        song = get_object_or_404(Song, id=song_id)
        versions = song.versions.all().order_by('tune_name', 'id')
        if not versions.exists():
            fallback = SongVersion.objects.create(
                song=song,
                tune_name='',
                capo_default=0,
                lyrics_chordpro=song.lyrics_chordpro,
                raw_html=song.raw_html,
            )
            versions = SongVersion.objects.filter(id=fallback.id)

        return Response(SongVersionSerializer(versions, many=True).data)


class SongbaseSyncView(APIView):
    def post(self, request):
        try:
            stats = sync_songbase_english()
            return Response(stats, status=status.HTTP_200_OK)
        except RequestException as exc:
            detail = f'Songbase sync failed: {exc}'
            return Response({'detail': detail}, status=status.HTTP_502_BAD_GATEWAY)


def _fetch_songbase_sample_payload() -> dict:
    base_url = settings.SONGBASE_API_URL.rstrip('/')
    headers = {}
    if settings.SONGBASE_API_TOKEN:
        headers['Authorization'] = f'Bearer {settings.SONGBASE_API_TOKEN}'

    upstream = requests.get(
        base_url,
        params={'language': 'english', 'updated_at': 0},
        headers=headers,
        timeout=45,
    )
    upstream.raise_for_status()

    payload = upstream.json()
    songs = payload.get('songs') if isinstance(payload, dict) else []
    if not isinstance(songs, list):
        songs = []
    sample_song = songs[0] if songs else None

    return {
        'source_url': base_url,
        'language': 'english',
        'upstream_song_count': len(songs),
        'sample_song': sample_song,
    }


class SongbaseSourceSampleView(APIView):
    def get(self, request):
        try:
            payload = _fetch_songbase_sample_payload()
        except RequestException as exc:
            detail = f'Songbase sample fetch failed: {exc}'
            return Response({'detail': detail}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(payload)


class SongbaseSourceSampleInspectView(APIView):
    def get(self, request):
        try:
            payload = _fetch_songbase_sample_payload()
        except RequestException as exc:
            detail = f'Songbase sample fetch failed: {exc}'
            return Response({'detail': detail}, status=status.HTTP_502_BAD_GATEWAY)

        song = payload.get('sample_song') or {}
        lyrics = song.get('lyrics') or ''
        title = song.get('title') or '(untitled)'
        song_id = song.get('id') or '-'

        html = f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Songbase Sample Inspect</title>
    <style>
      body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #111; }}
      .card {{ max-width: 1000px; border: 1px solid #ddd; border-radius: 10px; padding: 16px; }}
      .meta {{ margin-bottom: 12px; color: #444; }}
      details {{ border: 1px solid #ddd; border-radius: 8px; padding: 10px; background: #fafafa; }}
      summary {{ cursor: pointer; font-weight: 600; }}
      textarea {{
        width: 100%;
        min-height: 220px;
        max-height: 70vh;
        margin-top: 10px;
        resize: vertical;
        overflow: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        line-height: 1.35;
      }}
      .link {{ margin-top: 12px; display: inline-block; }}
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Songbase Raw Sample</h2>
      <div class="meta">
        <div><strong>Source:</strong> {escape(payload.get('source_url') or '')}</div>
        <div><strong>Total English Songs:</strong> {escape(str(payload.get('upstream_song_count') or 0))}</div>
        <div><strong>Sample Song:</strong> #{escape(str(song_id))} - {escape(title)}</div>
      </div>
      <details open>
        <summary>Lyrics (raw upstream field) - expandable + scrollable</summary>
        <textarea readonly>{escape(lyrics)}</textarea>
      </details>
      <a class="link" href="{escape(reverse('songs-source-sample', request=request))}">View raw JSON response</a>
    </div>
  </body>
</html>
"""
        return HttpResponse(html)


def _resolve_song_payload(selection: dict) -> RenderedSong:
    song = get_object_or_404(Song, id=selection['song_id'])
    version_id = selection.get('version_id')
    capo_override = selection.get('capo')
    chordpro_override = selection.get('chordpro_override', '')
    title_override = (selection.get('title_override') or '').strip()

    if version_id:
        version = get_object_or_404(SongVersion, id=version_id, song=song)
    else:
        version = song.versions.order_by('id').first()

    chordpro = ''
    capo = 0
    if version:
        chordpro = version.lyrics_chordpro or song.lyrics_chordpro
        capo = version.capo_default
    else:
        chordpro = song.lyrics_chordpro

    if chordpro_override:
        chordpro = chordpro_override

    if capo_override is not None:
        capo = capo_override

    return RenderedSong(
        title=title_override or song.title,
        key=song.key,
        capo=capo,
        lines=chordpro_to_lines(chordpro),
        force_new_page=selection.get('force_new_page', False),
    )


class PacketPreviewView(APIView):
    def post(self, request):
        started_at = time.perf_counter()
        serializer = PacketRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        selections = serializer.validated_data['selections']
        maintain_original_order = serializer.validated_data.get('maintain_original_order', False)
        _debug_event(
            f'packet.preview.start selections={len(selections)} '
            f'maintain_original_order={maintain_original_order}'
        )

        resolve_started = time.perf_counter()
        songs = []
        for index, item in enumerate(selections, start=1):
            songs.append(_resolve_song_payload(item))
            if index % 10 == 0 or index == len(selections):
                _debug_event(
                    'packet.preview.resolve_progress '
                    f'resolved={index}/{len(selections)} '
                    f'elapsed_ms={(time.perf_counter() - resolve_started) * 1000:.1f}'
                )

        page_height = 792
        vertical_margin = 72
        top = page_height - vertical_margin
        usable_height = page_height - vertical_margin * 2
        layout_started = time.perf_counter()
        layout = estimate_packet_layout(
            songs=songs,
            maintain_original_order=maintain_original_order,
            usable_height=usable_height,
            top=top,
            bottom=vertical_margin,
        )
        layout_ms = (time.perf_counter() - layout_started) * 1000
        total_ms = (time.perf_counter() - started_at) * 1000
        _debug_event(
            'packet.preview.done '
            f'songs={len(songs)} placements={len(layout["placements"])} '
            f'pages={layout["page_count"]} layout_ms={layout_ms:.1f} total_ms={total_ms:.1f}'
        )

        response = {
            'page_count': layout['page_count'],
            'maintain_original_order': maintain_original_order,
            'placements': layout['placements'],
            'debug': {
                'selection_count': len(selections),
                'placement_count': len(layout['placements']),
                'layout_ms': round(layout_ms, 1),
                'total_ms': round(total_ms, 1),
            },
        }
        return Response(response)


class PacketGenerateView(APIView):
    def post(self, request):
        serializer = PacketRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        songs = [_resolve_song_payload(item) for item in serializer.validated_data['selections']]
        maintain_original_order = serializer.validated_data.get('maintain_original_order', False)
        order = compute_packet_song_order(
            songs=songs,
            maintain_original_order=maintain_original_order,
        )
        pdf_bytes, metrics = render_song_packet_pdf(
            songs,
            maintain_original_order=maintain_original_order,
            draw_order=order,
            include_metrics=True,
        )

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="song-packet.pdf"'
        response['X-Packet-Pages'] = str(metrics.get('pages', 0))
        response['X-Packet-Song-Spills'] = str(metrics.get('song_page_spill', 0))
        return response


class PacketOptimizeOrderView(APIView):
    def post(self, request):
        serializer = PacketRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        songs = [_resolve_song_payload(item) for item in serializer.validated_data['selections']]
        maintain_original_order = serializer.validated_data.get('maintain_original_order', False)
        order = compute_packet_song_order(
            songs=songs,
            maintain_original_order=maintain_original_order,
        )

        return Response(
            {
                'order': order,
                'maintain_original_order': maintain_original_order,
                'count': len(order),
            }
        )
