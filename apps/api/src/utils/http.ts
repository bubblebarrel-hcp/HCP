import { Response } from 'express';

// Every response, success or failure, is one shape. The BFF proxy in each Next
// app depends on the `data` key to lift tokens into httpOnly cookies, so this
// envelope is load-bearing, not cosmetic.
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function page<T>(items: T[], total: number, pageNum: number, limit: number): Page<T> {
  return { items, total, page: pageNum, limit };
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new ApiError(400, message, code);
  }
  static unauthorized(message = 'Not authenticated', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, code);
  }
  static forbidden(message = 'Not allowed', code = 'FORBIDDEN') {
    return new ApiError(403, message, code);
  }
  static notFound(message = 'Not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, code);
  }
  static conflict(message: string, code = 'CONFLICT') {
    return new ApiError(409, message, code);
  }
}

// Pagination params, clamped. A caller asking for limit=100000 gets 100.
export function parsePaging(query: Record<string, unknown>, defaultLimit = 20) {
  const pageNum = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || defaultLimit));
  return { page: pageNum, limit, skip: (pageNum - 1) * limit };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// `id` columns are `uuid`, so comparing one to an arbitrary slug is not a miss
// — Postgres rejects the cast and fails the whole query. Only query by id when
// the input actually looks like a UUID.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
