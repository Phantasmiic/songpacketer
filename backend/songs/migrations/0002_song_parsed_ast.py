from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('songs', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='song',
            name='raw_lyrics_source',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='song',
            name='parsed_lyrics_ast',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
