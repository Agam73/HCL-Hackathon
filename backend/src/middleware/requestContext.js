import { randomUUID } from 'node:crypto';

/**
 * Attaches a trace id to every request. It comes back on the response
 * header and inside error bodies, so a failed demo request can be matched
 * to a log line (and to rows in agent_actions.trace_id).
 */
export default function requestContext(req, res, next) {
  const incoming = req.header('x-request-id');
  req.traceId = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.setHeader('x-request-id', req.traceId);
  next();
}
