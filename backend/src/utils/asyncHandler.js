/**
 * Wrap an async route handler so rejected promises reach the global
 * error handler instead of hanging the request (Express 4 needs this).
 *
 *   router.get('/x', asyncHandler(async (req, res) => { ... }));
 */
export default function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
