from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Song',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_id', models.CharField(max_length=128, unique=True)),
                ('title', models.CharField(max_length=255)),
                ('key', models.CharField(blank=True, max_length=32)),
                ('language', models.CharField(default='english', max_length=32)),
                ('lyrics_plain', models.TextField(blank=True)),
                ('lyrics_chordpro', models.TextField(blank=True)),
                ('raw_html', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='SongVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tune_name', models.CharField(blank=True, max_length=255)),
                ('capo_default', models.PositiveSmallIntegerField(default=0)),
                ('lyrics_chordpro', models.TextField(blank=True)),
                ('raw_html', models.TextField(blank=True)),
                ('song', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='songs.song')),
            ],
            options={
                'unique_together': {('song', 'tune_name')},
            },
        ),
        migrations.AddIndex(
            model_name='song',
            index=models.Index(fields=['title'], name='songs_song_title_067546_idx'),
        ),
        migrations.AddIndex(
            model_name='song',
            index=models.Index(fields=['language'], name='songs_song_languag_4da08a_idx'),
        ),
    ]
