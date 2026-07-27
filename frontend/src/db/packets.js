import { diff_match_patch } from 'diff-match-patch';
import { getDb } from './store';

const dmp = new diff_match_patch();

export async function listSongPackets() {
  const db = await getDb();
  const allPackets = await db.getAllFromIndex('packets', 'updated_at');
  // Return in descending order (most recently updated first)
  const mapped = allPackets.reverse().map(p => ({
    id: p.id,
    title: p.title,
    session_key: 'local',
    current_state: p.current_state || {},
    updated_at: new Date(p.updated_at).toISOString(),
    created_at: new Date(p.created_at).toISOString(),
    latest_version_number: p.versions.length,
  }));

  // Deduplicate: if two packets share the same title (case-insensitive), keep only
  // the most recently updated one (which is already first after the reverse above).
  const seenTitles = new Set();
  const packets = mapped.filter(p => {
    const key = p.title.toLowerCase();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  return { packets };
}

export async function createSongPacket(title, initialState = {}) {
  const db = await getDb();
  const now = Date.now();
  const packet = {
    title,
    created_at: now,
    updated_at: now,
    current_state: initialState,
    versions: [],
    history: [{
      event_type: 'create_packet',
      summary: 'Created packet',
      change: { title },
      created_at: now
    }]
  };
  const id = await db.add('packets', packet);
  
  return {
    packet: {
      id,
      title,
      current_state: initialState,
    },
    state: initialState,
    versions: [],
    edit_history: packet.history,
  };
}

export async function getSongPacket(packetId) {
  const db = await getDb();
  const packet = await db.get('packets', parseInt(packetId, 10));
  if (!packet) throw new Error('Packet not found');
  return {
    packet: {
      id: packet.id,
      title: packet.title,
      current_state: packet.current_state,
    },
    state: packet.current_state,
    versions: packet.versions.map((v, i) => ({
      id: i + 1,
      version_number: i + 1,
      description: v.description,
      page_count: v.page_count,
      song_spills: v.song_spills,
      created_at: new Date(v.created_at).toISOString(),
    })).reverse(),
    edit_history: packet.history.map((h, i) => ({
      id: i + 1,
      event_type: h.event_type,
      summary: h.summary,
      change: h.change,
      created_at: new Date(h.created_at).toISOString(),
    })).reverse(),
  };
}

export async function updateSongPacketState(packetId, state, eventType = '', summary = '', change = {}) {
  const db = await getDb();
  const tx = db.transaction('packets', 'readwrite');
  const store = tx.objectStore('packets');
  const packet = await store.get(parseInt(packetId, 10));
  
  if (!packet) throw new Error('Packet not found');
  
  packet.current_state = state;
  packet.updated_at = Date.now();
  packet.history.push({
    event_type: eventType,
    summary: summary,
    change: change,
    created_at: packet.updated_at,
  });
  
  await store.put(packet);
  await tx.done;
  
  return { success: true };
}

export async function updateSongPacketTitle(packetId, title) {
  const db = await getDb();
  const tx = db.transaction('packets', 'readwrite');
  const store = tx.objectStore('packets');
  const packet = await store.get(parseInt(packetId, 10));
  
  if (!packet) throw new Error('Packet not found');
  
  packet.title = title;
  packet.updated_at = Date.now();
  packet.history.push({
    event_type: 'rename_packet',
    summary: `Renamed packet to "${title}"`,
    change: { title },
    created_at: packet.updated_at,
  });
  
  await store.put(packet);
  await tx.done;
  
  return getSongPacket(packetId);
}

export async function saveSongPacketVersion(packetId, description = '', snapshot = null) {
  const db = await getDb();
  const tx = db.transaction('packets', 'readwrite');
  const store = tx.objectStore('packets');
  const packet = await store.get(parseInt(packetId, 10));
  
  if (!packet) throw new Error('Packet not found');
  
  const now = Date.now();
  packet.versions.push({
    description,
    snapshot: snapshot || packet.current_state,
    created_at: now,
    page_count: null,
    song_spills: null,
  });
  
  packet.history.push({
    event_type: 'save_version',
    summary: 'Saved version',
    change: { description, version_number: packet.versions.length },
    created_at: now,
  });
  
  packet.updated_at = now;
  await store.put(packet);
  await tx.done;
  
  return getSongPacket(packetId);
}

export async function openLatestSongPacket(packetId) {
  const db = await getDb();
  const tx = db.transaction('packets', 'readwrite');
  const store = tx.objectStore('packets');
  const packet = await store.get(parseInt(packetId, 10));
  
  if (!packet) throw new Error('Packet not found');
  
  if (packet.versions.length > 0) {
    const latestVersion = packet.versions[packet.versions.length - 1];
    packet.current_state = latestVersion.snapshot || {};
    packet.updated_at = Date.now();
    packet.history.push({
      event_type: 'open_latest',
      summary: 'Opened latest version',
      change: { version_number: packet.versions.length },
      created_at: packet.updated_at,
    });
    await store.put(packet);
  }
  await tx.done;
  
  return getSongPacket(packetId);
}

export async function activateSongPacketVersion(packetId, versionId) {
  const db = await getDb();
  const tx = db.transaction('packets', 'readwrite');
  const store = tx.objectStore('packets');
  const packet = await store.get(parseInt(packetId, 10));
  
  if (!packet) throw new Error('Packet not found');
  
  const versionIdx = parseInt(versionId, 10) - 1;
  const version = packet.versions[versionIdx];
  if (!version) throw new Error('Version not found');
  
  packet.current_state = version.snapshot || {};
  packet.updated_at = Date.now();
  packet.history.push({
    event_type: 'activate_version',
    summary: `Switched to version ${versionId}`,
    change: { version_number: versionId },
    created_at: packet.updated_at,
  });
  
  await store.put(packet);
  await tx.done;
  
  return getSongPacket(packetId);
}

export async function exportSongPacket(packetId) {
  const db = await getDb();
  const packet = await db.get('packets', parseInt(packetId, 10));
  if (!packet) throw new Error('Packet not found');

  const cleanRow = (row) => {
    if (row.type === 'section') return row;
    const cleanRowObj = { ...row };
    delete cleanRowObj.versions;
    delete cleanRowObj.candidates;

    if (cleanRowObj.type === 'song') {
      const defaultChordpro = cleanRowObj.defaultChordpro || '';
      const currentChordpro = cleanRowObj.chordproOverride || '';
      
      if (defaultChordpro !== currentChordpro) {
        const patches = dmp.patch_make(defaultChordpro, currentChordpro);
        cleanRowObj.chordproPatchText = dmp.patch_toText(patches);
      }
      delete cleanRowObj.chordproOverride;
    }

    return cleanRowObj;
  };

  const cleanMatches = (packet.current_state?.matches || []).map(cleanRow);

  return {
    title: packet.title,
    created_at: packet.created_at,
    updated_at: packet.updated_at,
    current_state: {
      ...packet.current_state,
      matches: cleanMatches,
    }
  };
}

export async function importSongPacket(packetData) {
  const db = await getDb();
  const now = Date.now();
  const sanitizeChordpro = (text) => {
    if (!text) return text;
    const blocks = text.split(/(?=^###\s*)/m).filter(b => b.trim());
    let chordpro = blocks.length > 0 ? blocks[0] : text;
    if (chordpro.startsWith('###')) {
      const idx = chordpro.indexOf('\n');
      if (idx !== -1) chordpro = chordpro.substring(idx).trim();
    }
    return chordpro;
  };

  const safeCurrentState = packetData.current_state || {};
  if (Array.isArray(safeCurrentState.matches)) {
    safeCurrentState.matches = safeCurrentState.matches.map(m => {
      if (m.type === 'song') {
        let chordproOverride = m.chordproOverride;
        const defaultChordpro = sanitizeChordpro(m.defaultChordpro);
        
        if (m.chordproPatchText) {
          const patches = dmp.patch_fromText(m.chordproPatchText);
          const [patchedText] = dmp.patch_apply(patches, defaultChordpro || '');
          chordproOverride = patchedText;
        } else if (chordproOverride === undefined) {
          // If there is no patch and chordproOverride is missing, it means it was completely identical to defaultChordpro
          chordproOverride = defaultChordpro;
        }

        const cleanM = {
          ...m,
          chordproOverride: sanitizeChordpro(chordproOverride),
          defaultChordpro: defaultChordpro
        };
        delete cleanM.chordproPatchText;
        return cleanM;
      }
      return m;
    });
  }

  const packet = {
    title: packetData.title || 'Imported Packet',
    created_at: packetData.created_at || now,
    updated_at: now,
    current_state: safeCurrentState,
    versions: Array.isArray(packetData.versions) ? packetData.versions : [],
    history: Array.isArray(packetData.history) ? packetData.history : [{
      event_type: 'import_packet',
      summary: 'Imported packet from JSON file',
      change: {},
      created_at: now
    }]
  };
  
  const id = await db.add('packets', packet);
  return getSongPacket(id);
}

export async function deleteSongPacket(packetId) {
  const db = await getDb();
  await db.delete('packets', parseInt(packetId, 10));
}
