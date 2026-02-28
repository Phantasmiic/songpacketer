import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
});

export async function matchSongs(inputText) {
  const response = await api.post('/songs/match', { input_text: inputText });
  return response.data;
}

export async function fetchVersions(songId) {
  const response = await api.get(`/songs/${songId}/versions`);
  return response.data;
}

export async function generatePacketPdf(selections, maintainOriginalOrder = false) {
  const response = await api.post(
    '/packet/generate',
    { selections, maintain_original_order: maintainOriginalOrder },
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

export async function optimizePacketOrder(selections, maintainOriginalOrder = false) {
  const response = await api.post('/packet/optimize-order', {
    selections,
    maintain_original_order: maintainOriginalOrder,
  });
  return response.data;
}

export async function syncSongbase() {
  const response = await api.post('/songs/sync');
  return response.data;
}
