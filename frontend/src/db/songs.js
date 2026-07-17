import fuzzysort from 'fuzzysort';
import { getDb } from './store';

const CHORD_RE = /\[[^\]]*\]/g;
const CAPO_RE = /^capo\s+(\d+)\b/i;
const TUNE_SPLIT_RE = /(?=^###\s*)/m;
const STANZA_RE = /^\d+$/;

function stripChords(text) {
  return text.replace(CHORD_RE, '');
}

function parseSongbaseLyrics(rawText) {
  const normalized = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(TUNE_SPLIT_RE).filter(b => b.trim());
  const useBlocks = blocks.length ? blocks : [''];

  const tunes = [];
  useBlocks.forEach((block, tuneIndex) => {
    const lines = block.split('\n');
    let tuneName = '';
    let capoDefault = 0;
    const comments = [];
    const bodyLines = [];

    lines.forEach((line, lineIndex) => {
      const stripped = line.trim();

      if (lineIndex === 0 && stripped.startsWith('###')) {
        tuneName = stripped.substring(3).trim();
        return;
      }

      if (stripped.toLowerCase() === 'new line' || stripped.toLowerCase() === 'new line.') {
        bodyLines.push('');
        return;
      }

      if (stripped.startsWith('#')) {
        const comment = stripped.substring(1).trim();
        const capoMatch = CAPO_RE.exec(comment);
        if (capoMatch) {
          capoDefault = parseInt(capoMatch[1], 10);
        } else {
          comments.push(comment);
        }
        return;
      }

      if (!stripped) {
        bodyLines.push('');
        return;
      }

      bodyLines.push(line);
    });

    const bodyChordpro = bodyLines.join('\n').replace(/^\n+|\n+$/g, '');
    const bodyPlain = stripChords(bodyChordpro);

    tunes.push({
      index: tuneIndex,
      tune_name: tuneName,
      capo_default: capoDefault,
      comments: comments,
      body_chordpro: bodyChordpro,
      body_plain: bodyPlain,
    });
  });

  return tunes;
}

function extractTune(rawHtml) {
  if (!rawHtml) return '';
  const div = document.createElement('div');
  div.innerHTML = rawHtml;
  const text = div.textContent || div.innerText || '';
  if (text.includes('Tune:')) {
    const split = text.split('Tune:')[1].split(' ');
    return split.slice(0, 5).join(' ').replace(/:/g, '').trim();
  }
  return '';
}

function toPlainText(rawHtml) {
  if (!rawHtml) return '';
  const div = document.createElement('div');
  div.innerHTML = rawHtml.replace(/<br\s*\/?>/gi, '\n');
  return div.textContent || div.innerText || '';
}

function safeTuneName(tuneName, tuneIndex, seen) {
  let base = (tuneName || '').trim();
  if (!base) {
    base = tuneIndex === 0 ? '' : `Tune ${tuneIndex + 1}`;
  }
  let name = base;
  let counter = 2;
  while (seen.has(name)) {
    name = `${base} (${counter})`;
    counter++;
  }
  seen.add(name);
  return name;
}

export async function syncSongbase() {
  // Use the Vite proxy configured in vite.config.js to bypass CORS
  const url = '/api/songbase/app_data?language=english&updated_at=0';
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch from Songbase: HTTP ${response.status} - ${text}`);
  }
  const payload = await response.json();
  const items = Array.isArray(payload.songs) ? payload.songs : (Array.isArray(payload) ? payload : []);

  const db = await getDb();
  const tx = db.transaction('songs', 'readwrite');
  const store = tx.objectStore('songs');

  let created = 0;
  let updated = 0;

  for (const item of items) {
    const lang = (item.lang || item.language || '').trim().toLowerCase();
    if (lang && lang !== 'english') continue;

    const songId = item.id || item.song_id;
    if (!songId) continue;

    const title = item.title || item.name || 'Untitled';
    const lyrics = item.lyrics || item.lyrics_chordpro || item.chordpro || '';
    const rawHtml = item.html || item.content_html || '';
    const key = item.key || '';

    const tunes = parseSongbaseLyrics(lyrics);
    const primary = tunes.length > 0 ? tunes[0] : {};
    const primaryChordpro = primary.body_chordpro || '';
    
    let combinedPlain = tunes.map(t => t.body_plain).filter(Boolean).join('\n\n');
    const lyricsPlain = rawHtml ? toPlainText(rawHtml) : combinedPlain;

    const versions = [];
    const seenNames = new Set();
    const fallbackCapo = parseInt(item.suggested_capo || item.capo || 0, 10);
    const fallbackTune = item.tune || extractTune(rawHtml);

    if (tunes.length === 0) {
      const tuneName = safeTuneName(fallbackTune, 0, seenNames);
      versions.push({
        id: `${songId}-0`,
        tune_name: tuneName,
        capo_default: fallbackCapo,
        lyrics_chordpro: lyrics,
      });
    } else {
      tunes.forEach((tune) => {
        const tuneName = safeTuneName(tune.tune_name, tune.index, seenNames);
        versions.push({
          id: `${songId}-${tune.index}`,
          tune_name: tuneName,
          capo_default: tune.capo_default !== undefined ? tune.capo_default : fallbackCapo,
          lyrics_chordpro: tune.body_chordpro || '',
        });
      });
    }

    const record = {
      id: songId,
      title,
      key,
      lyrics_plain: lyricsPlain,
      lyrics_chordpro: primaryChordpro,
      versions,
    };

    const existing = await store.get(songId);
    if (existing) {
      updated++;
    } else {
      created++;
    }
    await store.put(record);
  }

  await tx.done;
  return { created, updated };
}

export async function matchSongs(inputText) {
  const db = await getDb();
  const allSongs = await db.getAll('songs');

  if (!inputText || !inputText.trim()) {
    return { results: [] };
  }

  const lines = inputText.split('\n');
  const results = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Strip leading numbers/bullets
    const query = trimmed.replace(/^[\d\.\-\*\]\)]+\s*/, '').trim();
    if (!query) return;

    // Use fuzzysort to search title and lyrics_plain
    const fuzzyResults = fuzzysort.go(query, allSongs, {
      keys: ['title', 'lyrics_plain'],
      limit: 15,
      threshold: -10000,
    });

    const candidates = fuzzyResults.map(res => {
      const song = res.obj;
      return {
        song_id: song.id, // backend expects song_id
        title: song.title,
        key: song.key,
        preview: song.lyrics_plain.substring(0, 100).replace(/\n/g, ' ') + '...',
        score: res.score,
        versions: song.versions,
      };
    });

    results.push({
      input: trimmed,
      index: index,
      query: query,
      candidates: candidates,
    });
  });

  return { results };
}

export async function fetchVersions(songId) {
  const db = await getDb();
  const song = await db.get('songs', parseInt(songId, 10));
  if (!song) return [];
  return song.versions;
}
