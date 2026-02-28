from django.test import TestCase

from songs.pdf import (
    LYRIC_FONT,
    TEXT_FONT_SIZE,
    RenderedSong,
    _extract_chord_runs,
    _prepare_song_layout,
    _split_into_stanza_blocks,
    _simulate_order_metrics,
    _wrapped_song_rows,
    chordpro_to_lines,
    estimate_packet_layout,
    render_song_packet_pdf,
)
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from io import BytesIO


class PdfTests(TestCase):
    def test_chord_alignment_preserves_word_positions(self):
        lines = chordpro_to_lines('[C]Lord [G]Jesus')
        chord, lyric = lines[0]
        self.assertIn('C', chord)
        self.assertIn('G', chord)
        self.assertEqual(lyric, 'Lord Jesus')

    def test_chords_keep_exact_anchor_positions(self):
        lines = chordpro_to_lines('[C]ab [G]cd [Am]ef')
        chord, lyric = lines[0]
        self.assertEqual(lyric, 'ab cd ef')
        self.assertEqual(chord[0], 'C')
        self.assertEqual(chord[3], 'G')
        self.assertEqual(chord[6], 'A')

    def test_extract_chord_runs_keeps_indices(self):
        runs = _extract_chord_runs('C  G   Am')
        self.assertEqual(runs, [(0, 'C'), (3, 'G'), (7, 'Am')])

    def test_pdf_generation_returns_bytes(self):
        song = RenderedSong(
            title='Test Song',
            key='C',
            capo=0,
            lines=chordpro_to_lines('[C]Hello [G]world'),
        )
        payload = render_song_packet_pdf([song])
        self.assertTrue(payload.startswith(b'%PDF'))
        self.assertGreater(len(payload), 500)

    def test_optimized_layout_handles_oversized_song_without_loop(self):
        long_song = RenderedSong(
            title='Long Song',
            key='D',
            capo=0,
            lines=[('C', 'line') for _ in range(220)],
        )
        layout = estimate_packet_layout(
            songs=[long_song],
            maintain_original_order=False,
            usable_height=720,
            top=756,
            bottom=36,
        )
        self.assertGreaterEqual(layout['page_count'], 1)
        self.assertGreaterEqual(len(layout['placements']), 1)
        self.assertTrue(layout['placements'][0]['split'])

    def test_wrapped_rows_stay_within_column_width(self):
        song = RenderedSong(
            title='Wrap Test',
            key='C',
            capo=0,
            lines=chordpro_to_lines('[C]This is a very long lyric line that should wrap before crossing columns'),
        )
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=LETTER)
        page_width, _ = LETTER
        margin = 36
        gutter = 18
        column_width = (page_width - margin * 2 - gutter) / 2

        rows = _wrapped_song_rows(pdf, song, column_width, TEXT_FONT_SIZE)
        for row in rows:
            if row.kind == 'lyric':
                self.assertLessEqual(
                    pdf.stringWidth(row.lyric, LYRIC_FONT, TEXT_FONT_SIZE),
                    column_width + 0.01,
                )

    def test_stanza_blocks_split_on_blank_line(self):
        song = RenderedSong(
            title='Stanza Split',
            key='C',
            capo=0,
            lines=[
                ('C', 'Line one'),
                ('G', 'Line two'),
                ('', ''),
                ('Am', 'Line three'),
            ],
        )
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=LETTER)
        page_width, _ = LETTER
        margin = 36
        gutter = 18
        column_width = (page_width - margin * 2 - gutter) / 2
        blocks = _split_into_stanza_blocks(
            _wrapped_song_rows(pdf, song, column_width, TEXT_FONT_SIZE)
        )

        self.assertGreaterEqual(len(blocks), 2)

    def test_render_metrics_match_simulation(self):
        songs = [
            RenderedSong(
                title='Very Long',
                key='C',
                capo=0,
                lines=[('', f'line {i} text text text text text') for i in range(140)],
            ),
            RenderedSong(
                title='Forced',
                key='D',
                capo=0,
                lines=chordpro_to_lines('[D]short line'),
                force_new_page=True,
            ),
            RenderedSong(
                title='Normal',
                key='G',
                capo=3,
                lines=chordpro_to_lines('[G]hello [D]world'),
            ),
        ]
        order = [0, 1, 2]
        payload, render_metrics = render_song_packet_pdf(
            songs,
            maintain_original_order=True,
            draw_order=order,
            include_metrics=True,
        )
        self.assertTrue(payload.startswith(b'%PDF'))

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
            idx: _prepare_song_layout(pdf, song, column_width, TEXT_FONT_SIZE, line_height)
            for idx, song in enumerate(songs)
        }
        sim_metrics = _simulate_order_metrics(order, prepared, top, bottom, usable_height)

        self.assertEqual(render_metrics['pages'], sim_metrics['pages'])
        self.assertEqual(render_metrics['song_page_spill'], sim_metrics['song_page_spill'])
        self.assertEqual(render_metrics['stanza_page_spill'], sim_metrics['stanza_page_spill'])
        self.assertEqual(render_metrics['stanza_col_spill'], sim_metrics['stanza_col_spill'])
