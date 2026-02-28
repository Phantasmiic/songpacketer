import json
from io import BytesIO
from time import perf_counter

from django.test import TestCase
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

from songs.models import Song
from songs.pdf import (
    TEXT_FONT_SIZE,
    _optimize_song_order,
    _prepare_song_layout,
    _simulate_order_metrics,
    estimate_packet_layout,
)
from songs.services import find_song_candidates
from songs.views import _resolve_song_payload


QUERIES_44 = [
    'Give up the world',
    'God eternal has a purpose - new tune',
    'My wandering days grew increasingly empty',
    'When I behold the wonders of your hand',
    'Though Thou art God, most glorious, high',
    'Down from His glory',
    'He stepped out of glory',
    "God's intention is to have us",
    'Hast thou heard Him, seen Him, known Him?',
    'Thou art the Rock everlasting',
    'I want to follow Him',
    'Nothing’s quite so precious',
    'Mary poured out her love offering',
    'Jesus Lord, I’m captured by Thy beauty',
    'Conflict today is fierce',
    'Now is come salvation and strength',
    'Would you choose to be a living overcomer?',
    'In Christ alone my hope is found',
    'O now I see the cleansing wave!',
    'Would you be free from your burden of sin?',
    'What can wash away my sin?  - original tune',
    'Redeemed—how I love to proclaim it!',
    'Something every heart is loving = new tune',
    'What about my sinful past?',
    'Now the Lord is the Spirit',
    'Christ has come to be life',
    'Christ is the tree of life',
    'The love of the truth',
    'Jesus, O living word of God',
    'Manna from heaven came down',
    'Many Weary Years I vainly sought a spring',
    'Have you been to Jesus for the cleansing pow’r?',
    'Once by Nature We Were Dead in Sin',
    'I’ve Got a River of Life',
    'Back in my Father’s house',
    'Jehovah’s Habitation',
    'Therefore with Joy Shall Ye Draw Water',
    'Therefore the Redeemed of the Lord',
    'Jesus Christ is the Rock Smitten',
    'What a friend we have in Jesus',
    'Oh what a mystery',
    'Wash me Lord',
    'Singing and praising',
    'Steal me away',
]


class Packet44MetricsTests(TestCase):
    def _prepare_dataset(self):
        songs = []
        unmatched = []
        for query in QUERIES_44:
            candidates = find_song_candidates(query, limit=10)
            if not candidates:
                unmatched.append(query)
                continue
            selected_song = Song.objects.get(id=candidates[0].song_id)
            version = selected_song.versions.order_by('id').first()
            songs.append(
                _resolve_song_payload(
                    {
                        'song_id': selected_song.id,
                        'version_id': version.id if version else None,
                        'capo': version.capo_default if version else 0,
                    }
                )
            )

        self.assertFalse(unmatched, f'Unmatched inputs: {unmatched}')
        self.assertEqual(len(songs), 44)

        page_width, page_height = LETTER
        h_margin = 18
        v_margin = 72
        line_height = 14
        center_x = page_width / 2.0
        column_width = min(center_x - h_margin, page_width - h_margin - center_x)
        top = page_height - v_margin
        bottom = v_margin
        usable_height = top - bottom

        pdf = canvas.Canvas(BytesIO(), pagesize=LETTER)
        prepared = {
            index: _prepare_song_layout(pdf, song, column_width, TEXT_FONT_SIZE, line_height)
            for index, song in enumerate(songs)
        }
        return songs, prepared, top, bottom, usable_height, line_height

    def test_packet_metrics_for_44_song_input(self):
        if Song.objects.count() == 0:
            self.skipTest('No songs in database. Run song sync first.')

        songs, prepared, top, bottom, usable_height, line_height = self._prepare_dataset()

        original_order = list(range(len(songs)))
        previous_order = estimate_packet_layout(
            songs=songs,
            maintain_original_order=False,
            usable_height=usable_height,
            top=top,
            bottom=bottom,
            line_height=line_height,
        )['order']
        optimized_order = _optimize_song_order(
            prepared=prepared,
            maintain_original_order=False,
            top=top,
            bottom=bottom,
            usable_height=usable_height,
        )

        original_metrics = _simulate_order_metrics(
            original_order, prepared, top, bottom, usable_height
        )
        previous_metrics = _simulate_order_metrics(
            previous_order, prepared, top, bottom, usable_height
        )
        optimized_metrics = _simulate_order_metrics(
            optimized_order, prepared, top, bottom, usable_height
        )

        report = {
            'songs_resolved': len(songs),
            'original': original_metrics,
            'previous_order': previous_metrics,
            'optimized': optimized_metrics,
        }
        print('\nPACKET_44_METRICS=' + json.dumps(report, ensure_ascii=False))

        self.assertLessEqual(optimized_metrics['pages'], original_metrics['pages'])

    def test_packet_44_benchmark_attempts(self):
        if Song.objects.count() == 0:
            self.skipTest('No songs in database. Run song sync first.')

        songs, prepared, top, bottom, usable_height, line_height = self._prepare_dataset()
        original_order = list(range(len(songs)))
        previous_order = estimate_packet_layout(
            songs=songs,
            maintain_original_order=False,
            usable_height=usable_height,
            top=top,
            bottom=bottom,
            line_height=line_height,
        )['order']

        baseline_rows = [
            ('original', _simulate_order_metrics(original_order, prepared, top, bottom, usable_height)),
            ('previous_order', _simulate_order_metrics(previous_order, prepared, top, bottom, usable_height)),
        ]

        attempts = [40, 60, 100, 200, 500]
        optimized_rows = []
        for attempt in attempts:
            started = perf_counter()
            order = _optimize_song_order(
                prepared=prepared,
                maintain_original_order=False,
                top=top,
                bottom=bottom,
                usable_height=usable_height,
                bucket_attempts=attempt,
            )
            runtime_ms = (perf_counter() - started) * 1000.0
            optimized_rows.append(
                (
                    f'optimized_{attempt}',
                    _simulate_order_metrics(order, prepared, top, bottom, usable_height),
                    runtime_ms,
                )
            )

        all_rows = [(label, metrics, None) for label, metrics in baseline_rows] + optimized_rows
        print('\nPACKET_44_BENCHMARK_TABLE')
        print('label|pages|song_page_spill|stanza_page_spill|stanza_col_spill|whitespace|runtime_ms')
        for label, metrics, runtime_ms in all_rows:
            runtime_display = f'{runtime_ms:.2f}' if runtime_ms is not None else 'N/A'
            print(
                f"{label}|{metrics['pages']}|{metrics['song_page_spill']}|"
                f"{metrics['stanza_page_spill']}|{metrics['stanza_col_spill']}|"
                f"{metrics['whitespace']:.2f}|{runtime_display}"
            )

        best_pages = min(row[1]['pages'] for row in optimized_rows)
        self.assertLessEqual(best_pages, baseline_rows[0][1]['pages'])

    def test_packet_44_compare_objective_order(self):
        if Song.objects.count() == 0:
            self.skipTest('No songs in database. Run song sync first.')

        songs, prepared, top, bottom, usable_height, line_height = self._prepare_dataset()
        previous_order = estimate_packet_layout(
            songs=songs,
            maintain_original_order=False,
            usable_height=usable_height,
            top=top,
            bottom=bottom,
            line_height=line_height,
        )['order']

        rows = [
            ('previous_order', _simulate_order_metrics(previous_order, prepared, top, bottom, usable_height)),
        ]
        objective_orders = [
            ('song_page_spill>pages', ('song_page_spill', 'pages', 'stanza_page_spill', 'stanza_col_spill')),
            ('pages>song_page_spill', ('pages', 'song_page_spill', 'stanza_page_spill', 'stanza_col_spill')),
        ]
        for label, objective_priority in objective_orders:
            order = _optimize_song_order(
                prepared=prepared,
                maintain_original_order=False,
                top=top,
                bottom=bottom,
                usable_height=usable_height,
                bucket_attempts=40,
                objective_priority=objective_priority,
            )
            rows.append((label, _simulate_order_metrics(order, prepared, top, bottom, usable_height)))

        print('\nPACKET_44_OBJECTIVE_ORDER_COMPARISON')
        print('label|pages|song_page_spill|stanza_page_spill|stanza_col_spill|whitespace')
        for label, metrics in rows:
            print(
                f"{label}|{metrics['pages']}|{metrics['song_page_spill']}|"
                f"{metrics['stanza_page_spill']}|{metrics['stanza_col_spill']}|"
                f"{metrics['whitespace']:.2f}"
            )

        self.assertEqual(len(rows), 3)
