/**
 * One response shape for the whole API so the frontend never has to guess.
 *
 * Success: { success: true, data: ..., meta?: ... }
 * Error:   { success: false, error: { code, message, details? }, traceId }
 */
export function ok(res, data, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.json(body);
}

export function created(res, data) {
  return res.status(201).json({ success: true, data });
}

export function noContent(res) {
  return res.status(204).send();
}

/** Paged list payload: { items, page, size, totalItems, totalPages, hasNext }. */
export function paged(res, items, { page, size, totalItems }) {
  const totalPages = size > 0 ? Math.ceil(totalItems / size) : 0;
  return res.json({
    success: true,
    data: items,
    meta: {
      page,
      size,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  });
}
