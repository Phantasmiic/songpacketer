from django.test import TestCase

from songs.models import Song, SongVersion
from songs.services import find_song_candidates


class MatchingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        lord = Song.objects.create(
            source_id='s1',
            title="Lord Jesus You're Lovely",
            key='G',
            lyrics_plain='Lord Jesus you are lovely and precious to me',
            lyrics_chordpro='[G]Lord Je[D]sus you are [Em]lovely',
        )
        SongVersion.objects.create(song=lord, tune_name='Original', capo_default=0, lyrics_chordpro=lord.lyrics_chordpro)

        song2 = Song.objects.create(
            source_id='s2',
            title='Be Thou My Vision',
            key='D',
            lyrics_plain='Be thou my vision O Lord of my heart',
            lyrics_chordpro='[D]Be thou my [G]vision',
        )
        SongVersion.objects.create(song=song2, tune_name='Traditional', capo_default=2, lyrics_chordpro=song2.lyrics_chordpro)

    def test_fuzzy_misspelled_title_matches(self):
        results = find_song_candidates('Lord Jesus you are Lovel')
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0].title, "Lord Jesus You're Lovely")

    def test_lyric_fragment_matches_song(self):
        results = find_song_candidates('O Lord of my heart')
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0].title, 'Be Thou My Vision')

    def test_candidates_have_scores_for_feedback_loop(self):
        results = find_song_candidates('Lord Jesus')
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0].title, "Lord Jesus You're Lovely")
        self.assertGreater(results[0].score, 0)
