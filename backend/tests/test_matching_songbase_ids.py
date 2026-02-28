from django.test import TestCase

from songs.models import Song
from songs.services import find_song_candidates


class SongbaseIdResolutionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        Song.objects.create(
            source_id='491',
            title='For Her',
            key='C',
            language='english',
            lyrics_plain="Don't you want to know your God? For her.",
        )
        Song.objects.create(
            source_id='596',
            title='Do Come, O Do Come',
            key='D',
            language='english',
            lyrics_plain='Drink a river pure and clear. Do come oh do come.',
        )
        Song.objects.create(
            source_id='3853',
            title="He's the rock who's following me!",
            key='G',
            language='english',
            lyrics_plain='Jesus Christ is the rock smitten, who was struck to save me from sin.',
        )
        Song.objects.create(
            source_id='433',
            title='Something every heart is loving',
            key='F',
            language='english',
            lyrics_plain='Something every heart is loving, if not Jesus none can rest.',
        )

        # Similar distractors to make ranking behavior realistic.
        Song.objects.create(
            source_id='9991',
            title='Jesus Christ Is the Same Yesterday and Today, Yes, Even Forever',
            key='A',
            language='english',
            lyrics_plain='Christ remains forever the same.',
        )
        Song.objects.create(
            source_id='9992',
            title='Speak to the Rock',
            key='E',
            language='english',
            lyrics_plain='Speak to the rock and drink.',
        )

    def _top_source_id(self, query: str) -> str:
        candidates = find_song_candidates(query, limit=10)
        self.assertGreater(len(candidates), 0, f'No candidates returned for query: {query}')
        top = Song.objects.get(id=candidates[0].song_id)
        return top.source_id

    def test_for_her_resolves_to_491(self):
        self.assertEqual(self._top_source_id('For her'), '491')

    def test_dont_you_want_to_know_your_god_resolves_to_491(self):
        self.assertEqual(self._top_source_id("Don't you want to know your God"), '491')

    def test_do_come_oh_do_come_resolves_to_596(self):
        self.assertEqual(self._top_source_id('Do come oh do come'), '596')

    def test_drink_a_river_pure_and_clear_resolves_to_596(self):
        self.assertEqual(self._top_source_id('Drink a river pure and clear'), '596')

    def test_jesus_christ_is_the_rock_smitten_resolves_to_3853(self):
        self.assertEqual(self._top_source_id('Jesus Christ is the rock smitten'), '3853')

    def test_tune_annotation_suffix_is_ignored(self):
        self.assertEqual(
            self._top_source_id('Something every heart is loving = new tune'),
            '433',
        )
