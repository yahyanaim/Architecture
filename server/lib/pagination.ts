export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface PaginationMetadata {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export function parsePaginationParams(
  query: Record<string, unknown>,
  defaultLimit = 50,
  maxLimit = 100
): PaginationParams {
  let limit = defaultLimit;
  if (query.limit !== undefined) {
    const parsed = parseInt(String(query.limit), 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, maxLimit);
    }
  }

  const cursor =
    typeof query.cursor === 'string' && query.cursor.trim()
      ? query.cursor.trim()
      : undefined;

  return { cursor, limit };
}

export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor<T = Record<string, unknown>>(cursor?: string): T | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return ({ id: cursor } as unknown) as T;
  }
}

export function paginateWithCursor<T>(
  items: T[],
  limit: number,
  getCursorPayload: (item: T) => Record<string, unknown>
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem ? encodeCursor(getCursorPayload(lastItem)) : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
    nextCursor,
    hasMore,
    limit,
  };
}
