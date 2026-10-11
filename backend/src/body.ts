import { z } from 'zod';
import { ApiError } from './errors.js';

// Validate a JSON body. A missing or non-object body is a malformed request (400),
// not a field error, so zod never reports it under an empty field name.
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'bad_request', 'Request body must be a JSON object');
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
