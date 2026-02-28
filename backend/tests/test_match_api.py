from django.urls import reverse
from rest_framework.test import APITestCase

from songs.models import Song, SongVersion


class MatchApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        lord = Song.objects.create(
            source_id='api-s1',
            title="Lord Jesus You're Lovely",
            key='G',
            lyrics_plain='Lord Jesus you are lovely and precious to me',
            lyrics_chordpro='[G]Lord Je[D]sus you are [Em]lovely',
        )
        SongVersion.objects.create(song=lord, tune_name='Original', capo_default=0, lyrics_chordpro=lord.lyrics_chordpro)

        alternate = Song.objects.create(
            source_id='api-s2',
            title='Lord Jesus We Love You',
            key='A',
            lyrics_plain='Lord Jesus we love you and worship you',
            lyrics_chordpro='[A]Lord Jesus we [E]love you',
        )
        SongVersion.objects.create(song=alternate, tune_name='Alt', capo_default=1, lyrics_chordpro=alternate.lyrics_chordpro)

    def test_match_endpoint_returns_selected_and_candidates(self):
        response = self.client.post(
            reverse('songs-match'),
            {'input_text': 'Lord Jesus you are Lovel'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)

        row = response.data['results'][0]
        self.assertEqual(row['selected']['title'], "Lord Jesus You're Lovely")
        self.assertGreaterEqual(len(row['candidates']), 1)
        self.assertEqual(row['candidates'][0]['title'], "Lord Jesus You're Lovely")
