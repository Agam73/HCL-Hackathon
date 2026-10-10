import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

/** 404 for unmatched routes - must sit after all route registrations. */
export function notFoundHandler(req, res, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

/** Translate Postgres driver errors into meaningful HTTP errors. */
function fromPostgres(err) {
  switch (err.code) {
    case '23505': // unique_violation
      return ApiError.conflict('A record with these values already exists', {
        constraint: err.constraint,
        detail: err.detail,
      });
    case '23503': // foreign_key_violation
      return ApiError.badRequest('Referenced record does not exist', {
        constraint: err.constraint,
        detail: err.detail,
      });
    case '23514': // check_violation
      return ApiError.badRequest('A value violates a database constraint', {
        constraint: err.constraint,
      });
    case '23502': // not_null_violation
      return ApiError.badRequest(`Field "${err.column}" is required`);
    case '22P02': // invalid_text_representation (e.g. malformed uuid)
      return ApiError.badRequest('Malformed identifier or value');
    case '22003': // numeric_value_out_of_range
      return ApiError.badRequest('Numeric value out of range');
    case '42P01': // undefined_table
      return new ApiError(
        503,
        'SCHEMA_NOT_READY',
        'Database schema is missing. Run: npm run db:migrate'
      );
    case '3D000': // invalid_catalog_name
      return new ApiError(503, 'DB_UNAVAILABLE', 'Database does not exist. Run: docker compose up -d db');
    case 'ECONNREFUSED':
      return new ApiError(
        503,
        'DB_UNAVAILABLE',
        'Cannot reach PostgreSQL. Is it up? Run: docker compose up -d db'
      );
    default:
      return null;
  }
}

/**
 * Global exception handler. Nothing should escape past this - unhandled
 * errors become a 500 with a trace id, and the stack is logged server-side
 * but never returned in production.
 */
export default function errorHandler(err, req, res, next) {
  let apiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    apiError = ApiError.badRequest('Request body is not valid JSON');
  } else if (err?.type === 'entity.too.large') {
    apiError = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  } else if (err?.code) {
    apiError = fromPostgres(err) ?? ApiError.internal();
  } else {
    apiError = ApiError.internal();
  }

  const log = {
    traceId: req.traceId,
    method: req.method,
    url: req.originalUrl,
    status: apiError.status,
    code: apiError.code,
    message: err.message,
  };

  if (apiError.status >= 500) {
    console.error('[error]', JSON.stringify(log), '\n', err.stack ?? err);
  } else {
    console.warn('[warn]', JSON.stringify(log));
  }

  const body = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
    traceId: req.traceId,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  };

  // Only leak internals outside production, and only for genuine crashes.
  if (!env.isProd && apiError.status >= 500) {
    body.error.cause = err.message;
    body.error.stack = String(err.stack ?? '').split('\n').slice(0, 5);
  }

  res.status(apiError.status).json(body);
}
