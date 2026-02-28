from django.test import TestCase

from songs.markup import parse_songbase_lyrics


class SongbaseMarkupParserTests(TestCase):
    def test_parses_multi_tune_and_hides_metadata_from_body(self):
        raw = """### Original tune
# Capo 1
# Note about tune
1
[C]Line one

### New tune
# Capo 3
2
[D]Second tune line
"""
        parsed = parse_songbase_lyrics(raw)

        self.assertEqual(parsed['tune_count'], 2)

        tune_1 = parsed['tunes'][0]
        self.assertEqual(tune_1['tune_name'], 'Original tune')
        self.assertEqual(tune_1['capo_default'], 1)
        self.assertIn('Note about tune', tune_1['comments'])
        self.assertNotIn('# Capo', tune_1['body_chordpro'])
        self.assertNotIn('###', tune_1['body_chordpro'])
        self.assertIn('[C]Line one', tune_1['body_chordpro'])

        tune_2 = parsed['tunes'][1]
        self.assertEqual(tune_2['tune_name'], 'New tune')
        self.assertEqual(tune_2['capo_default'], 3)
        self.assertIn('[D]Second tune line', tune_2['body_chordpro'])

    def test_new_line_literal_becomes_blank_line(self):
        parsed = parse_songbase_lyrics('[C]Line A\nnew line\n[G]Line B')
        body = parsed['tunes'][0]['body_chordpro']
        self.assertEqual(body, '[C]Line A\n\n[G]Line B')
