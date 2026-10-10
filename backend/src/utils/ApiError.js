/**
 * Every error thrown deliberately by the app should be an ApiError.
 * The global error handler turns these into a consistent JSON envelope.
 */
export default class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = true; // distinguishes "handled" errors from real crashes
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(resource = 'Resource') {
    return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static conflict(message = 'Resource already exists', details) {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  static unprocessable(message = 'Validation failed', details) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }

  static tooMany(message = 'Too many requests') {
    return new ApiError(429, 'RATE_LIMITED', message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
