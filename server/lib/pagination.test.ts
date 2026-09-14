import { describe, it, expect } from 'vitest';
import {
  parsePaginationParams,
  encodeCursor,
  decodeCursor,
  paginateWithCursor,
} from './pagination';

describe('Pagination Library (server/lib/pagination.ts)', () => {
  describe('parsePaginationParams', () => {
    it('uses default limit of 50 when no limit provided', () => {
      const params = parsePaginationParams({});
      expect(params.limit).toBe(50);
      expect(params.cursor).toBeUndefined();
    });

    it('caps limit at maxLimit (default 100)', () => {
      const params = parsePaginationParams({ limit: '250' });
      expect(params.limit).toBe(100);
    });

    it('parses valid limit within range', () => {
      const params = parsePaginationParams({ limit: '25' });
      expect(params.limit).toBe(25);
    });

    it('ignores invalid, negative, or non-numeric limit', () => {
      expect(parsePaginationParams({ limit: '-10' }).limit).toBe(50);
      expect(parsePaginationParams({ limit: 'abc' }).limit).toBe(50);
      expect(parsePaginationParams({ limit: '0' }).limit).toBe(50);
    });

    it('extracts and trims cursor string', () => {
      const params = parsePaginationParams({ cursor: '  abc123xyz  ' });
      expect(params.cursor).toBe('abc123xyz');
    });

    it('ignores empty cursor string', () => {
      const params = parsePaginationParams({ cursor: '   ' });
      expect(params.cursor).toBeUndefined();
    });
  });

  describe('encodeCursor & decodeCursor', () => {
    it('round-trips payload successfully', () => {
      const payload = { id: 'user-123', createdAt: '2026-09-14T12:00:00.000Z' };
      const encoded = encodeCursor(payload);
      expect(typeof encoded).toBe('string');
      expect(encoded).not.toContain('+'); // URL-safe base64
      expect(encoded).not.toContain('/');

      const decoded = decodeCursor<typeof payload>(encoded);
      expect(decoded).toEqual(payload);
    });

    it('returns null for undefined or empty cursor', () => {
      expect(decodeCursor(undefined)).toBeNull();
      expect(decodeCursor('')).toBeNull();
    });

    it('gracefully falls back to { id: cursor } for non-JSON cursor strings', () => {
      const decoded = decodeCursor('plain-user-id');
      expect(decoded).toEqual({ id: 'plain-user-id' });
    });
  });

  describe('paginateWithCursor', () => {
    const items = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Bravo' },
      { id: '3', name: 'Charlie' },
      { id: '4', name: 'Delta' },
      { id: '5', name: 'Echo' },
    ];

    it('slices items and provides nextCursor when items.length > limit', () => {
      const limit = 3;
      const result = paginateWithCursor(items, limit, (item) => ({ id: item.id }));

      expect(result.data.length).toBe(3);
      expect(result.data.map((i) => i.id)).toEqual(['1', '2', '3']);
      expect(result.hasMore).toBe(true);
      expect(result.limit).toBe(3);
      expect(result.nextCursor).not.toBeNull();

      const decoded = decodeCursor<{ id: string }>(result.nextCursor!);
      expect(decoded?.id).toBe('3');
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextCursor).toBe(result.nextCursor);
    });

    it('returns all items and null nextCursor when items.length <= limit', () => {
      const limit = 10;
      const result = paginateWithCursor(items, limit, (item) => ({ id: item.id }));

      expect(result.data.length).toBe(5);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });
  });
});
