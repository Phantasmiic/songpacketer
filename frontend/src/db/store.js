import { openDB } from 'idb';

const DB_NAME = 'songpacketer_db';
const DB_VERSION = 1;

let dbPromise = null;

export async function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('songs')) {
          const songsStore = db.createObjectStore('songs', { keyPath: 'id' });
          // Create indices for search/listing if needed, though fuzzysort will scan the whole list.
          // For songbase, we have ~1500 songs, which is trivial to load into memory.
          songsStore.createIndex('title', 'title');
        }
        if (!db.objectStoreNames.contains('packets')) {
          const packetsStore = db.createObjectStore('packets', { keyPath: 'id', autoIncrement: true });
          packetsStore.createIndex('updated_at', 'updated_at');
        }
      },
    });
  }
  return dbPromise;
}
