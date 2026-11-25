import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(formatZodError(result.error));
    }
    req.body = result.data;
    return next();
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(formatZodError(result.error));
    }
    req.validatedQuery = result.data;
    return next();
  };
}

function formatZodError(zodErr) {
  const fieldErrors = {};
  for (const issue of zodErr.issues) {
    const key = issue.path.join('.') || 'root';
    fieldErrors[key] = issue.message;
  }
  return new AppError(400, 'VALIDATION_ERROR', 'Input validation failed.', fieldErrors);
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    code: 'ROUTE_NOT_FOUND',
    message: `No route matched ${req.method} ${req.originalUrl}`,
    fieldErrors: null,
  });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const formatted = formatZodError(err);
    return res.status(400).json({
      code: formatted.code,
      message: formatted.message,
      fieldErrors: formatted.fieldErrors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      fieldErrors: err.fieldErrors || null,
    });
  }

  if (err?.name === 'CastError') {
    return res.status(400).json({
      code: 'INVALID_IDENTIFIER',
      message: `Invalid identifier format for ${err.path || 'parameter'}.`,
      fieldErrors: { [err.path || 'id']: 'Invalid identifier format' },
    });
  }

  if (err?.code === 11000) {
    const keys = Object.keys(err.keyPattern || err.keyValue || {});
    const field = keys[0] || 'record';
    return res.status(409).json({
      code: 'DUPLICATE_RECORD',
      message: `A record with the same ${field} already exists.`,
      fieldErrors: { [field]: 'Already exists' },
    });
  }

  console.error('Unhandled server error:', err?.message || err);
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected server error occurred.',
    fieldErrors: null,
  });
}
