import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  withCredentials: true,
});

export async function matchSongs(inputText, queries = []) {
  const response = await api.post('/songs/match', {
    input_text: inputText,
    queries,
  });
  return response.data;
}

export async function fetchVersions(songId) {
  const response = await api.get(`/songs/${songId}/versions`);
  return response.data;
}

import { renderSongPacketPdf } from '../pdf/engine';

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


export async function optimizePacketOrder(
  selections,
  maintainOriginalOrder = false,
  showSectionHeadersInBody = false,
  showSectionHeadersInIndex = true
) {
  const response = await api.post('/packet/optimize-order', {
    selections,
    maintain_original_order: maintainOriginalOrder,
    show_section_headers_in_body: showSectionHeadersInBody,
    show_section_headers_in_index: showSectionHeadersInIndex,
  });
  return response.data;
}

export async function syncSongbase() {
  const response = await api.post('/songs/sync');
  return response.data;
}

export async function listSongPackets() {
  const response = await api.get('/song-packets');
  return response.data;
}

export async function createSongPacket(title, initialState = {}) {
  const response = await api.post('/song-packets', {
    title,
    initial_state: initialState,
  });
  return response.data;
}

export async function openLatestSongPacket(packetId) {
  const response = await api.post(`/song-packets/${packetId}/open-latest`);
  return response.data;
}

export async function updateSongPacketState(packetId, state, event = {}) {
  const response = await api.patch(`/song-packets/${packetId}/state`, {
    state,
    event_type: event.eventType || '',
    summary: event.summary || '',
    change: event.change || {},
  });
  return response.data;
}

export async function saveSongPacketVersion(packetId, description = '') {
  const response = await api.post(`/song-packets/${packetId}/save-version`, {
    description,
  });
  return response.data;
}

export async function listSongPacketVersions(packetId) {
  const response = await api.get(`/song-packets/${packetId}/versions`);
  return response.data;
}

export async function listSongPacketHistory(packetId) {
  const response = await api.get(`/song-packets/${packetId}/history`);
  return response.data;
}

export async function activateSongPacketVersion(packetId, versionId) {
  const response = await api.post(`/song-packets/${packetId}/activate-version`, {
    version_id: versionId,
  });
  return response.data;
}

export async function generateSongPacketVersionPdf(packetId, versionId) {
  const response = await api.post(
    `/song-packets/${packetId}/versions/${versionId}/generate`,
    {},
    { responseType: 'blob' }
  );
  const pages = Number(response.headers['x-packet-pages']);
  const songSpills = Number(response.headers['x-packet-song-spills']);
  return {
    blob: response.data,
    stats: Number.isFinite(pages) && Number.isFinite(songSpills)
      ? { pages, songSpills }
      : null,
  };
}
