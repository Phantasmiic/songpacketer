import { syncSongbase as dbSyncSongbase, matchSongs as dbMatchSongs, fetchVersions as dbFetchVersions } from '../db/songs';
import { getDb } from '../db/store';
import {
  listSongPackets as dbListSongPackets,
  createSongPacket as dbCreateSongPacket,
  getSongPacket as dbGetSongPacket,
  updateSongPacketState as dbUpdateSongPacketState,
  saveSongPacketVersion as dbSaveSongPacketVersion,
  openLatestSongPacket as dbOpenLatestSongPacket,
  activateSongPacketVersion as dbActivateSongPacketVersion,
  exportSongPacket as dbExportSongPacket,
  importSongPacket as dbImportSongPacket,
  updateSongPacketTitle as dbUpdateSongPacketTitle,
  deleteSongPacket as dbDeleteSongPacket
} from '../db/packets';
import { renderSongPacketPdf } from '../pdf/engine';

export async function matchSongs(inputText, queries = []) {
  // DB matchSongs takes the input text and fuzzysorts against the local catalog.
  return await dbMatchSongs(inputText, queries);
}

export async function fetchVersions(songId) {
  return await dbFetchVersions(songId);
}

export async function generatePacketPdf(
  selections,
  orderingMode = 'within_sections',
  showSectionHeadersInIndex = true,
  requireOnePagePerSong = false,
  showPageNumbers = true,
  startingPageNumber = 1,
  pageNumberPrefix = 'S',
  pdfFontSize = 11
) {
  return await renderSongPacketPdf(
    selections,
    orderingMode,
    showSectionHeadersInIndex,
    requireOnePagePerSong,
    showPageNumbers,
    startingPageNumber,
    pageNumberPrefix,
    pdfFontSize
  );
}

export async function optimizePacketOrder(selections, maintainOriginalOrder = false) {
  // The JS engine optimizes internally now if maintainOriginalOrder is false.
  // This frontend shim returns the input selections as the ordered result to avoid breaking older React state expectations.
  return { order: selections.map((_, index) => index) };
}

export async function syncSongbase() {
  return await dbSyncSongbase();
}

export async function listSongPackets() {
  return await dbListSongPackets();
}

export async function createSongPacket(title, initialState = {}) {
  return await dbCreateSongPacket(title, initialState);
}

export async function openLatestSongPacket(packetId) {
  return await dbOpenLatestSongPacket(packetId);
}

export async function updateSongPacketState(packetId, state, event = {}) {
  return await dbUpdateSongPacketState(
    packetId,
    state.state || state, // Handle different legacy payload shapes
    event.event_type || '',
    event.summary || '',
    event.change || {}
  );
}

export async function saveSongPacketVersion(packetId, description = '') {
  return await dbSaveSongPacketVersion(packetId, description);
}

// History and version lists are embedded inside getSongPacket for the local db
export async function listSongPacketVersions(packetId) {
  const data = await dbGetSongPacket(packetId);
  return { versions: data.versions || [] };
}

export async function activateSongPacketVersion(packetId, versionId) {
  return await dbActivateSongPacketVersion(packetId, versionId);
}

export async function listSongPacketHistory(packetId) {
  const data = await dbGetSongPacket(packetId);
  return { history: data.edit_history || [] };
}

function toSelectionsStatic(rows) {
  return rows.map((row) => {
    if (row.type === 'section') {
      return {
        type: 'section',
        title: row.title,
        force_new_page: false,
      };
    }
    let chordpro_text = '';
    if (Array.isArray(row.versions) && row.versions.length > 0) {
      const selected = row.selectedVersionId
        ? row.versions.find(v => v.id === row.selectedVersionId)
        : row.versions[0];
      if (selected) {
        chordpro_text = selected.chordpro_text || selected.lyrics_chordpro || '';
      }
    }
    return {
      type: 'song',
      input_text: row.input,
      song_id: row.selectedSongId,
      version_id: row.selectedVersionId || null,
      capo: row.capo === '' || row.capo == null ? 0 : row.capo,
      chordpro_override: row.chordproOverride || '',
      title_override: row.titleOverride || '',
      chordpro_text: chordpro_text,
    };
  });
}

export async function generateSongPacketVersionPdf(packetId, versionId) {
  const dbData = await dbGetSongPacket(packetId);
  const db = await getDb();
  const packet = await db.get('packets', parseInt(packetId, 10));
  if (!packet) throw new Error('Packet not found');

  const versionIdx = parseInt(versionId, 10) - 1;
  const version = packet.versions[versionIdx];
  if (!version || !version.snapshot) throw new Error("Version not found or has no snapshot");

  const matches = version.snapshot.matches || [];
  const manualOrderCards = version.snapshot.manual_order_cards || [];

  const selections = toSelectionsStatic(manualOrderCards.length > 0 ? manualOrderCards : matches);

  return await renderSongPacketPdf(
    selections,
    version.snapshot.maintain_original_order || false,
    version.snapshot.show_section_headers_in_body ?? false,
    version.snapshot.show_section_headers_in_index ?? true
  );
}

export async function exportSongPacket(packetId) {
  return await dbExportSongPacket(packetId);
}

export async function importSongPacket(packetData) {
  return await dbImportSongPacket(packetData);
}

export async function updateSongPacketTitle(packetId, title) {
  return await dbUpdateSongPacketTitle(packetId, title);
}

export async function deleteSongPacket(packetId) {
  return await dbDeleteSongPacket(packetId);
}

// ----------------------------------------------------
// Vercel KV Online Storage & 18-Month Expiration Helpers
// ----------------------------------------------------
import LZString from 'lz-string';

const EIGHTEEN_MONTHS_SECONDS = 47304000; // 18 months (547.5 days) in seconds

export function formatSlug(text) {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function getRedisKey(slug) {
  const formatted = formatSlug(slug);
  return `packet:${formatted.toLowerCase()}`;
}

export function slugify(text) {
  return formatSlug(text);
}

function getKvConfig() {
  const url = import.meta.env.VITE_KV_REST_API_URL;
  const token = import.meta.env.VITE_KV_REST_API_TOKEN;
  if (!url || !token) {
    return null;
  }
  return { url: url.replace(/\/$/, ''), token };
}

export function isKvConfigured() {
  return Boolean(getKvConfig());
}

export async function checkSlugAvailability(slug) {
  const config = getKvConfig();
  if (!config) return { available: true, error: null };

  const formattedSlug = formatSlug(slug);
  if (!formattedSlug || formattedSlug.length < 3) {
    return { available: false, error: 'URL must be at least 3 characters' };
  }

  const redisKey = getRedisKey(formattedSlug);

  try {
    const res = await fetch(`${config.url}/exists/${redisKey}`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });
    if (!res.ok) throw new Error('Failed to query database');
    const data = await res.json();
    const exists = data.result === 1;
    return { available: !exists, error: exists ? 'URL is already taken' : null };
  } catch (err) {
    return { available: true, error: err.message };
  }
}

export async function savePacketOnline(slug, packetData) {
  const config = getKvConfig();
  if (!config) throw new Error('Vercel KV configuration missing (VITE_KV_REST_API_URL / VITE_KV_REST_API_TOKEN)');

  const formattedSlug = formatSlug(slug);
  if (!formattedSlug || formattedSlug.length < 3) {
    throw new Error('URL must be at least 3 characters');
  }

  const redisKey = getRedisKey(formattedSlug);
  const jsonString = typeof packetData === 'string' ? packetData : JSON.stringify(packetData);
  // Lossless LZ-String compression
  const compressed = LZString.compressToEncodedURIComponent(jsonString);

  const res = await fetch(`${config.url}/set/${redisKey}/${compressed}/ex/${EIGHTEEN_MONTHS_SECONDS}`, {
    headers: { Authorization: `Bearer ${config.token}` }
  });

  if (!res.ok) {
    throw new Error('Failed to save packet online to database');
  }

  // Preserve user casing in shareUrl
  const shareUrl = `${window.location.origin}${window.location.pathname}#/p/${formattedSlug}`;
  return { slug: formattedSlug, shareUrl };
}

export async function fetchPacketOnline(slug) {
  const config = getKvConfig();
  if (!config) throw new Error('Vercel KV configuration missing');

  const formattedSlug = formatSlug(slug);
  if (!formattedSlug) throw new Error('Invalid URL slug');

  const redisKey = getRedisKey(formattedSlug);

  const res = await fetch(`${config.url}/get/${redisKey}`, {
    headers: { Authorization: `Bearer ${config.token}` }
  });

  if (!res.ok) throw new Error('Network error loading packet');
  const data = await res.json();

  if (!data.result) {
    throw new Error('Packet not found or expired after 18 months of inactivity');
  }

  // Decompress lossless LZ-String payload
  const decompressed = LZString.decompressFromEncodedURIComponent(data.result);
  if (!decompressed) throw new Error('Failed to decompress packet data');

  const packetObj = JSON.parse(decompressed);

  // Background Renewal: EXPIRE packet:<slug_lowercase> 47304000 (renew 18-month timer upon UI view)
  fetch(`${config.url}/expire/${redisKey}/${EIGHTEEN_MONTHS_SECONDS}`, {
    headers: { Authorization: `Bearer ${config.token}` }
  }).catch(() => { });

  return packetObj;
}

