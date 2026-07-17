import { syncSongbase as dbSyncSongbase, matchSongs as dbMatchSongs, fetchVersions as dbFetchVersions } from '../db/songs';
import { 
  listSongPackets as dbListSongPackets, 
  createSongPacket as dbCreateSongPacket, 
  getSongPacket as dbGetSongPacket,
  updateSongPacketState as dbUpdateSongPacketState,
  saveSongPacketVersion as dbSaveSongPacketVersion,
  openLatestSongPacket as dbOpenLatestSongPacket
} from '../db/packets';
import { renderSongPacketPdf } from '../pdf/engine';

export async function matchSongs(inputText, queries = []) {
  // DB matchSongs takes the input text and fuzzysorts against the local catalog.
  return await dbMatchSongs(inputText);
}

export async function fetchVersions(songId) {
  return await dbFetchVersions(songId);
}

export async function generatePacketPdf(
  selections,
  maintainOriginalOrder = false,
  showSectionHeadersInBody = false,
  showSectionHeadersInIndex = true
) {
  return await renderSongPacketPdf(
    selections,
    maintainOriginalOrder,
    showSectionHeadersInBody,
    showSectionHeadersInIndex
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
  // Not fully supported in local DB yet, but stubbed to prevent errors
  throw new Error("Activating legacy version is not fully supported locally.");
}

export async function listSongPacketHistory(packetId) {
  const data = await dbGetSongPacket(packetId);
  return { history: data.edit_history || [] };
}

export async function generateSongPacketVersionPdf(packetId, versionId) {
  // Grab the snapshot of this version and pass it to the PDF engine
  const data = await dbGetSongPacket(packetId);
  const version = data.versions.find(v => v.id === versionId);
  if (!version || !version.snapshot) throw new Error("Version not found");
  
  // Note: we'd need to recreate the `selections` payload from the snapshot, but since we are
  // migrating to 100% client side we will rely on the live packet state.
  throw new Error("Generating PDF from legacy version snapshot is not fully supported locally.");
}
