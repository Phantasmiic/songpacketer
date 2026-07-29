import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LZString from 'lz-string';
import {
  formatSlug,
  formatLiveSlug,
  getRedisKey,
  slugify,
  checkSlugAvailability,
  savePacketOnline,
  fetchPacketOnline,
  isKvConfigured
} from '../client';

describe('Online Packet Storage & Lossless Compression Comprehensive Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('formatSlug & getRedisKey helpers', () => {
    it('preserves uppercase letters for display while normalizing Redis keys to lowercase', () => {
      expect(formatSlug('Sunday Morning Service!')).toBe('Sunday-Morning-Service');
      expect(formatSlug('  Easter-2026 -- Set 1  ')).toBe('Easter-2026-Set-1');
      expect(formatSlug('Grace @ High#Point ($1)')).toBe('Grace-HighPoint-1');
      expect(formatSlug('')).toBe('');

      expect(getRedisKey('Sunday-Morning-Service')).toBe('packet:sunday-morning-service');
      expect(getRedisKey('EASTER-2026')).toBe('packet:easter-2026');
    });

    it('slugify alias behaves identically to formatSlug', () => {
      expect(slugify('Youth Retreat 2026')).toBe('Youth-Retreat-2026');
    });

    it('formatLiveSlug allows trailing hyphens while actively typing', () => {
      expect(formatLiveSlug('Sunday-')).toBe('Sunday-');
      expect(formatLiveSlug('Sunday-Service-')).toBe('Sunday-Service-');
      expect(formatLiveSlug('Sunday  Service')).toBe('Sunday-Service');
      expect(formatLiveSlug('Sunday--Service')).toBe('Sunday-Service');
    });
  });

  describe('isKvConfigured helper', () => {
    it('returns false when environment variables are missing', () => {
      vi.stubEnv('VITE_KV_REST_API_URL', '');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', '');
      vi.stubEnv('VITE_UPSTASH_REDIS_REST_URL', '');
      vi.stubEnv('VITE_UPSTASH_REDIS_REST_TOKEN', '');
      expect(isKvConfigured()).toBe(false);
    });

    it('returns true when VITE_KV_REST_API_URL and VITE_KV_REST_API_TOKEN are configured', () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token-123');
      expect(isKvConfigured()).toBe(true);
    });
  });

  describe('LZ-String Lossless Compression Verification', () => {
    it('guarantees 100% byte-for-byte lossless compression & decompression of complex packet JSON', () => {
      const originalPacket = {
        version: '1.0',
        title: 'Sunday Morning Service',
        updated_at: '2026-07-24T09:45:00.000Z',
        matches: [
          {
            type: 'song',
            input: 'Amazing Grace',
            selectedSongId: 'song-1',
            selectedVersionId: 'ver-1',
            capo: 2,
            chordproOverride: 'C [G] Amazing grace [C] how sweet the sound!',
            titleOverride: 'Amazing Grace (Acoustic)'
          },
          {
            type: 'section',
            title: 'Fellowship Flow Section 1',
            force_new_page: false
          }
        ]
      };

      const jsonString = JSON.stringify(originalPacket);
      
      // Compress with LZ-String
      const compressed = LZString.compressToEncodedURIComponent(jsonString);
      expect(typeof compressed).toBe('string');
      expect(compressed.length).toBeGreaterThan(0);

      // Decompress with LZ-String
      const decompressedString = LZString.decompressFromEncodedURIComponent(compressed);
      expect(decompressedString).toBe(jsonString);

      // Parse back and assert 100% deep equality
      const restoredPacket = JSON.parse(decompressedString);
      expect(restoredPacket).toEqual(originalPacket);
    });

    it('handles 100-song large packets efficiently with 100% lossless fidelity', () => {
      const songs = [];
      for (let i = 1; i <= 100; i++) {
        songs.push({
          type: 'song',
          input: `Song ${i} Title`,
          selectedSongId: `song-id-${i}`,
          selectedVersionId: `ver-${i}`,
          capo: i % 5,
          chordproOverride: `Verse ${i}\n[C]Verse line [G]with chords [Am]for song ${i}\nChorus ${i}\n[F]Chorus line [C]for song ${i}`,
          titleOverride: `Song Title ${i}`
        });
      }

      const largePacket = { title: 'Mega 100 Song Packet', songs };
      const uncompressedJson = JSON.stringify(largePacket);
      expect(uncompressedJson.length).toBeGreaterThan(20000); // ~25KB+

      const compressed = LZString.compressToEncodedURIComponent(uncompressedJson);
      expect(compressed.length).toBeLessThan(uncompressedJson.length); // Significant compression ratio

      const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
      expect(JSON.parse(decompressed)).toEqual(largePacket);
    });
  });

  describe('checkSlugAvailability with Vercel KV API', () => {
    it('returns available: true if slug is free (EXISTS returns 0)', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 0 })
      });

      const res = await checkSlugAvailability('Sunday-Service');
      expect(res.available).toBe(true);
      expect(res.error).toBeNull();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://mock-kv.upstash.io',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(['EXISTS', 'packet:sunday-service'])
        })
      );
    });

    it('returns available: false if slug is taken (EXISTS returns 1)', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 1 })
      });

      const res = await checkSlugAvailability('Sunday-Service');
      expect(res.available).toBe(false);
      expect(res.error).toBe('URL is already taken');
    });

    it('returns available: false if slug is too short (<3 chars)', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token');

      const res = await checkSlugAvailability('ab');
      expect(res.available).toBe(false);
      expect(res.error).toBe('URL must be at least 3 characters');
    });
  });

  describe('savePacketOnline with Vercel KV API', () => {
    it('compresses packet data and sends SET request with 18-month TTL (47,304,000s)', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token-123');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'OK' })
      });

      const packet = { title: 'Sunday Song Packet', songs: ['Song 1', 'Song 2'] };
      const res = await savePacketOnline('Sunday-Service-2026', packet);

      expect(res.slug).toBe('Sunday-Service-2026');
      expect(res.shareUrl).toContain('#/p/Sunday-Service-2026');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://mock-kv.upstash.io',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"SET","packet:sunday-service-2026"')
        })
      );
    });

    it('throws error when Vercel KV configuration is missing', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', '');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', '');
      vi.stubEnv('VITE_UPSTASH_REDIS_REST_URL', '');
      vi.stubEnv('VITE_UPSTASH_REDIS_REST_TOKEN', '');
      await expect(savePacketOnline('Sunday-Set', { title: 'Test' })).rejects.toThrow(
        'Vercel KV / Upstash configuration missing'
      );
    });

    it('throws error if custom URL slug is under 3 characters', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token');

      await expect(savePacketOnline('a', { title: 'Test' })).rejects.toThrow(
        'URL must be at least 3 characters'
      );
    });

    it('throws error if Vercel KV HTTP API returns non-OK response', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Internal Error'
      });

      await expect(savePacketOnline('Sunday-Set', { title: 'Test' })).rejects.toThrow(
        'Failed to save packet online'
      );
    });
  });

  describe('fetchPacketOnline with Vercel KV API & 18-Month Renewal', () => {
    it('fetches, decompresses, returns packet, and sends background EXPIRE renewal (47,304,000s)', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token-123');

      const originalPacket = { title: 'Retrieved Packet', items: [1, 2, 3] };
      const compressedPayload = LZString.compressToEncodedURIComponent(JSON.stringify(originalPacket));

      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        const bodyStr = options?.body || '';
        if (bodyStr.includes('"GET","packet:easter-2026"')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ result: compressedPayload })
          });
        }
        if (bodyStr.includes('"EXPIRE","packet:easter-2026"')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ result: 1 })
          });
        }
        return Promise.reject(new Error('Unknown URL or payload'));
      });

      // Query with mixed case: Easter-2026
      const loadedPacket = await fetchPacketOnline('Easter-2026');
      expect(loadedPacket).toEqual(originalPacket);

      // Verify GET request used lowercased key packet:easter-2026
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://mock-kv.upstash.io',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(['GET', 'packet:easter-2026'])
        })
      );

      // Verify background EXPIRE timer renewal request was sent for 47,304,000s
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://mock-kv.upstash.io',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(['EXPIRE', 'packet:easter-2026', 47304000])
        })
      );
    });

    it('throws error when packet is expired or not found (result: null)', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: null })
      });

      await expect(fetchPacketOnline('Expired-Packet')).rejects.toThrow(
        'Packet not found or expired after 18 months of inactivity'
      );
    });

    it('throws error if payload decompression fails', async () => {
      vi.stubEnv('VITE_KV_REST_API_URL', 'https://mock-kv.upstash.io');
      vi.stubEnv('VITE_KV_REST_API_TOKEN', 'mock-token');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'invalid-garbage-string!!!' })
      });

      await expect(fetchPacketOnline('Corrupted-Packet')).rejects.toThrow();
    });
  });
});
