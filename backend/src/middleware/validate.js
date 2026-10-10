import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';

/**
 * Request validation. Pass any of body/query/params as zod schemas:
 *
 *   router.get('/products', validate({ query: listProductsQuery }), handler)
 *
 * Parsed (and coerced) values replace req.body / req.query / req.params,
 * and are also available as req.valid.{body,query,params}.
 * Failures become a 422 with a field-by-field `details` array.
 */
export default function validate(schemas = {}) {
  return function validateRequest(req, res, next) {
    const valid = {};
    try {
      for (const part of ['params', 'query', 'body']) {
        const schema = schemas[part];
        if (!schema) continue;
        const parsed = schema.parse(req[part] ?? {});
        valid[part] = parsed;
        // req.query is a getter in some Express versions - define instead of assign.
        Object.defineProperty(req, part, {
          value: parsed,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      req.valid = valid;
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          message: issue.message,
          code: issue.code,
        }));
        return next(ApiError.unprocessable('Request validation failed', details));
      }
      return next(err);
    }
  };
}
