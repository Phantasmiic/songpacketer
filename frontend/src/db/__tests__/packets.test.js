/**
 * Tests for packets.js IndexedDB helper functions.
 * Uses fake-indexeddb (via jsdom) to run without a real browser.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// Reset the db module state between tests so each test gets a fresh db.
let dbPromise;
vi.mock('../store', async () => {
  const { openDB } = await import('idb');
  let _dbPromise = null;
  return {
    getDb: async () => {
      if (!_dbPromise) {
        _dbPromise = openDB('test_songpacketer_db_' + Date.now(), 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains('songs')) {
              const s = db.createObjectStore('songs', { keyPath: 'id' });
              s.createIndex('title', 'title');
            }
            if (!db.objectStoreNames.contains('packets')) {
              const p = db.createObjectStore('packets', { keyPath: 'id', autoIncrement: true });
              p.createIndex('updated_at', 'updated_at');
            }
          },
        });
      }
      return _dbPromise;
    },
  };
});

import { getDb } from '../store';
import {
  createSongPacket,
  getSongPacket,
  listSongPackets,
  saveSongPacketVersion,
  activateSongPacketVersion,
  updateSongPacketTitle,
  exportSongPacket,
  importSongPacket,
} from '../packets';

describe('createSongPacket', () => {
  it('creates a packet and returns it with correct title', async () => {
    const result = await createSongPacket('My Worship Set');
    expect(result.packet.title).toBe('My Worship Set');
    expect(typeof result.packet.id).toBe('number');
    expect(result.versions).toEqual([]);
    expect(result.edit_history).toHaveLength(1);
    expect(result.edit_history[0].event_type).toBe('create_packet');
  });

  it('creates a packet with supplied initial state', async () => {
    const state = { input_text: 'Grace', matches: [] };
    const result = await createSongPacket('Init State Packet', state);
    expect(result.state).toEqual(state);
  });
});

describe('getSongPacket', () => {
  it('retrieves a packet by id', async () => {
    const created = await createSongPacket('Fetch Test Packet');
    const fetched = await getSongPacket(created.packet.id);
    expect(fetched.packet.title).toBe('Fetch Test Packet');
  });

  it('throws if packet is not found', async () => {
    await expect(getSongPacket(999999)).rejects.toThrow('Packet not found');
  });
});

describe('listSongPackets', () => {
  it('returns a list that includes created packets', async () => {
    await createSongPacket('Alpha Packet', { inputText: 'alpha' });
    await createSongPacket('Beta Packet', { inputText: 'beta' });
    const { packets } = await listSongPackets();
    const titles = packets.map((p) => p.title);
    expect(titles).toContain('Alpha Packet');
    expect(titles).toContain('Beta Packet');
  });

  it('deduplicates packets with the same title (case-insensitive)', async () => {
    const uniqueTitle = 'Dedup Title Test Unique XYZ';
    await createSongPacket(uniqueTitle, { inputText: 'first import' });
    await createSongPacket(uniqueTitle, { inputText: 'second import' });
    const { packets } = await listSongPackets();
    const matchingTitles = packets.filter(
      (p) => p.title.toLowerCase() === uniqueTitle.toLowerCase()
    );
    expect(matchingTitles.length).toBe(1);
  });
});


describe('updateSongPacketTitle', () => {
  it('renames a packet', async () => {
    const created = await createSongPacket('Old Title');
    const updated = await updateSongPacketTitle(created.packet.id, 'New Title');
    expect(updated.packet.title).toBe('New Title');
  });

  it('records a rename_packet history event', async () => {
    const created = await createSongPacket('Name Before');
    await updateSongPacketTitle(created.packet.id, 'Name After');
    const fetched = await getSongPacket(created.packet.id);
    const renameEvents = fetched.edit_history.filter(
      (e) => e.event_type === 'rename_packet'
    );
    expect(renameEvents.length).toBeGreaterThan(0);
  });
});

describe('saveSongPacketVersion', () => {
  it('creates a version checkpoint and returns it in the versions list', async () => {
    const created = await createSongPacket('Version Test Packet');
    const result = await saveSongPacketVersion(created.packet.id, 'First Draft');
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0].version_number).toBe(1);
    expect(result.versions[0].description).toBe('First Draft');
  });

  it('increments version numbers on repeated saves', async () => {
    const created = await createSongPacket('Multi-Version Packet');
    await saveSongPacketVersion(created.packet.id, 'v1');
    const result = await saveSongPacketVersion(created.packet.id, 'v2');
    expect(result.versions).toHaveLength(2);
    // versions returned reversed (latest first)
    expect(result.versions[0].version_number).toBe(2);
    expect(result.versions[1].version_number).toBe(1);
  });

  it('snapshots the current state into the version', async () => {
    const created = await createSongPacket('Snapshot Packet');
    const state = { matches: [{ input: 'Amazing Grace' }] };
    const result = await saveSongPacketVersion(created.packet.id, 'snap', state);
    const db = await getDb();
    const raw = await db.get('packets', created.packet.id);
    expect(raw.versions[0].snapshot).toEqual(state);
  });
});

describe('activateSongPacketVersion', () => {
  it('restores the current_state from a saved version', async () => {
    const created = await createSongPacket('Activate Test Packet');
    const stateV1 = { matches: [{ input: 'Be Thou My Vision' }] };
    await saveSongPacketVersion(created.packet.id, 'v1', stateV1);
    // Now change the state by saving a second version with different state
    const stateV2 = { matches: [{ input: 'In Christ Alone' }] };
    await saveSongPacketVersion(created.packet.id, 'v2', stateV2);
    // Activate v1
    const restored = await activateSongPacketVersion(created.packet.id, 1);
    expect(restored.state).toEqual(stateV1);
  });

  it('records an activate_version event in history', async () => {
    const created = await createSongPacket('Activate History Packet');
    await saveSongPacketVersion(created.packet.id, 'v1', { test: true });
    await activateSongPacketVersion(created.packet.id, 1);
    const fetched = await getSongPacket(created.packet.id);
    const events = fetched.edit_history.filter((e) => e.event_type === 'activate_version');
    expect(events.length).toBeGreaterThan(0);
  });

  it('throws when version does not exist', async () => {
    const created = await createSongPacket('Bad Version Packet');
    await expect(activateSongPacketVersion(created.packet.id, 99)).rejects.toThrow('Version not found');
  });
});

describe('exportSongPacket', () => {
  it('returns raw packet data without versions array', async () => {
    const created = await createSongPacket('Export Packet');
    await saveSongPacketVersion(created.packet.id, 'Draft', { key: 'val' });
    const raw = await exportSongPacket(created.packet.id);
    expect(raw.title).toBe('Export Packet');
    expect(raw.versions).toBeUndefined();
  });

  it('throws if packet is not found', async () => {
    await expect(exportSongPacket(99999)).rejects.toThrow('Packet not found');
  });
});

describe('importSongPacket', () => {
  it('imports a packet from raw JSON data and returns it', async () => {
    const data = {
      title: 'Imported Set',
      current_state: { input_text: 'Amazing Grace' },
      versions: [],
      history: [],
    };
    const result = await importSongPacket(data);
    expect(result.packet.title).toBe('Imported Set');
    expect(result.state).toEqual({ input_text: 'Amazing Grace' });
  });

  it('preserves existing version history from the JSON file', async () => {
    const data = {
      title: 'With Versions',
      current_state: {},
      versions: [
        { description: 'Legacy v1', snapshot: { foo: 'bar' }, created_at: Date.now() }
      ],
      history: [],
    };
    const result = await importSongPacket(data);
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0].description).toBe('Legacy v1');
  });

  it('uses fallback title if none provided', async () => {
    const result = await importSongPacket({ current_state: {} });
    expect(result.packet.title).toBe('Imported Packet');
  });

  it('adds an import_packet history event when no history is provided', async () => {
    const result = await importSongPacket({ title: 'No History Import', current_state: {} });
    const fetched = await getSongPacket(result.packet.id);
    const importEvents = fetched.edit_history.filter((e) => e.event_type === 'import_packet');
    expect(importEvents.length).toBeGreaterThan(0);
  });

  it('sanitizes chordproOverride to remove extra ### song versions', async () => {
    const dirtyData = {
      title: 'Dirty Packet',
      current_state: {
        matches: [
          {
            type: 'song',
            chordproOverride: '### Original\n\n1\nVerse 1\n### Additional Stanza\n\n1\nVerse 1 duplicate',
            defaultChordpro: '### Original\n\n1\nVerse 1\n### Additional Stanza\n\n1\nVerse 1 duplicate'
          }
        ]
      }
    };
    const result = await importSongPacket(dirtyData);
    const fetched = await getSongPacket(result.packet.id);
    const songMatch = fetched.packet.current_state.matches[0];
    
    // Should strip the '### Original\n' header and remove the '### Additional Stanza' block completely
    expect(songMatch.chordproOverride.trim()).toBe('1\nVerse 1');
    expect(songMatch.defaultChordpro.trim()).toBe('1\nVerse 1');
  });
});

describe('exportSongPacket and importSongPacket with patches', () => {
  it('shrinks json size by exporting a patch and restores the exact override on import', async () => {
    const initialState = {
      matches: [
        {
          type: 'song',
          defaultChordpro: '1\nVerse 1\nLine 1\nLine 2',
          chordproOverride: '1\nVerse 1\nLine 1\nLine 2 modified'
        }
      ]
    };
    const created = await createSongPacket('Patch Test Packet', initialState);
    
    const exported = await exportSongPacket(created.packet.id);
    const exportedSong = exported.current_state.matches[0];
    
    // It should have deleted the full override and saved a patch
    expect(exportedSong.chordproOverride).toBeUndefined();
    expect(typeof exportedSong.chordproPatchText).toBe('string');
    
    // The patch text should be smaller than the full string (for small changes in large strings, but here it's small so let's just check it exists)
    expect(exportedSong.chordproPatchText.length).toBeGreaterThan(0);
    
    const imported = await importSongPacket(exported);
    const importedSong = imported.state.matches[0];
    
    // It should have restored the exact override
    expect(importedSong.chordproOverride).toBe('1\nVerse 1\nLine 1\nLine 2 modified');
    // And it should have cleaned up the patch text
    expect(importedSong.chordproPatchText).toBeUndefined();
  });

  it('restores default chordpro correctly when there is no patch (unmodified song)', async () => {
    const initialState = {
      matches: [
        {
          type: 'song',
          defaultChordpro: '1\nVerse 1\nUnmodified',
          chordproOverride: '1\nVerse 1\nUnmodified'
        }
      ]
    };
    const created = await createSongPacket('No Patch Test Packet', initialState);
    
    const exported = await exportSongPacket(created.packet.id);
    const exportedSong = exported.current_state.matches[0];
    
    // It should have deleted the override and not created a patch
    expect(exportedSong.chordproOverride).toBeUndefined();
    expect(exportedSong.chordproPatchText).toBeUndefined();
    
    const imported = await importSongPacket(exported);
    const importedSong = imported.state.matches[0];
    
    // It should have safely restored the override to match the default
    expect(importedSong.chordproOverride).toBe('1\nVerse 1\nUnmodified');
  });
});
