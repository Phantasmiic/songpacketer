from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('songs', '0002_song_parsed_ast'),
    ]

    operations = [
        migrations.CreateModel(
            name='SongPacket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_key', models.CharField(db_index=True, max_length=64)),
                ('title', models.CharField(max_length=255)),
                ('current_state', models.JSONField(blank=True, default=dict)),
                ('latest_version_number', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'indexes': [models.Index(fields=['session_key', 'updated_at'], name='songs_songp_session_3705d4_idx')],
            },
        ),
        migrations.CreateModel(
            name='SongPacketVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('version_number', models.PositiveIntegerField()),
                ('snapshot', models.JSONField(blank=True, default=dict)),
                ('description', models.TextField(blank=True)),
                ('page_count', models.PositiveIntegerField(blank=True, null=True)),
                ('song_spills', models.PositiveIntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('packet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='songs.songpacket')),
                ('previous_version', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='next_versions', to='songs.songpacketversion')),
            ],
            options={
                'unique_together': {('packet', 'version_number')},
                'indexes': [models.Index(fields=['packet', 'version_number'], name='songs_songp_packet__81f050_idx')],
            },
        ),
        migrations.AddField(
            model_name='songpacket',
            name='current_version',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='songs.songpacketversion'),
        ),
        migrations.CreateModel(
            name='SongPacketEditEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(default='update', max_length=64)),
                ('summary', models.CharField(blank=True, max_length=255)),
                ('change', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('packet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='edit_events', to='songs.songpacket')),
                ('packet_version', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='edit_events', to='songs.songpacketversion')),
            ],
            options={
                'indexes': [models.Index(fields=['packet', 'created_at'], name='songs_songp_packet__6360d8_idx')],
            },
        ),
    ]
