from django.urls import reverse
from rest_framework.test import APITestCase

from songs.models import Song, SongVersion


class SongPacketApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        song = Song.objects.create(
            source_id='packet-api-song-1',
            title='Packet Song',
            key='C',
            lyrics_plain='hello world',
            lyrics_chordpro='[C]hello [G]world',
        )
        SongVersion.objects.create(
            song=song,
            tune_name='Default',
            capo_default=0,
            lyrics_chordpro='[C]hello [G]world',
        )
        cls.song = song

    def test_create_and_list_song_packets(self):
        response = self.client.post(
            reverse('song-packets'),
            {
                'title': 'Session Packet',
                'initial_state': {
                    'input_text': 'Packet Song',
                    'selections': [],
                    'packet_stats': None,
                },
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['packet']['title'], 'Session Packet')
        self.assertEqual(response.data['packet']['latest_version_number'], 1)
        self.assertEqual(len(response.data['versions']), 1)
        self.assertIsNone(response.data['versions'][0]['page_count'])
        self.assertIsNone(response.data['versions'][0]['song_spills'])

        list_response = self.client.get(reverse('song-packets'))
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data['packets']), 1)

    def test_update_state_save_and_activate_version(self):
        create_response = self.client.post(
            reverse('song-packets'),
            {'title': 'Versioned Packet', 'initial_state': {'step': 0, 'selections': []}},
            format='json',
        )
        packet_id = create_response.data['packet']['id']
        version1_id = create_response.data['versions'][0]['id']

        state_response = self.client.patch(
            reverse('song-packet-state', args=[packet_id]),
            {
                'state': {'step': 1, 'selections': []},
                'event_type': 'edit_song',
                'summary': 'Edited songs',
                'change': {'row_index': 0},
            },
            format='json',
        )
        self.assertEqual(state_response.status_code, 200)

        save_response = self.client.post(
            reverse('song-packet-save-version', args=[packet_id]),
            {'description': 'Checkpoint'},
            format='json',
        )
        self.assertEqual(save_response.status_code, 200)
        self.assertEqual(save_response.data['version']['version_number'], 2)

        activate_response = self.client.post(
            reverse('song-packet-activate-version', args=[packet_id]),
            {'version_id': version1_id},
            format='json',
        )
        self.assertEqual(activate_response.status_code, 200)
        self.assertEqual(activate_response.data['packet']['current_version']['id'], version1_id)

        history_response = self.client.get(reverse('song-packet-history', args=[packet_id]))
        self.assertEqual(history_response.status_code, 200)
        self.assertGreaterEqual(len(history_response.data['history']), 3)

    def test_generate_pdf_from_version_snapshot(self):
        version = self.song.versions.first()
        create_response = self.client.post(
            reverse('song-packets'),
            {
                'title': 'PDF Packet',
                'initial_state': {
                    'maintain_original_order': True,
                    'selections': [
                        {
                            'input_text': 'Packet Song',
                            'song_id': self.song.id,
                            'version_id': version.id,
                            'capo': 0,
                            'chordpro_override': '',
                            'title_override': '',
                            'force_new_page': False,
                        }
                    ],
                },
            },
            format='json',
        )
        packet_id = create_response.data['packet']['id']
        version_id = create_response.data['versions'][0]['id']

        generate_response = self.client.post(
            reverse('song-packet-version-generate', args=[packet_id, version_id]),
            {},
            format='json',
        )
        self.assertEqual(generate_response.status_code, 200)
        self.assertEqual(generate_response['Content-Type'], 'application/pdf')
        self.assertIn('X-Packet-Pages', generate_response)
        self.assertIn('X-Packet-Song-Spills', generate_response)
