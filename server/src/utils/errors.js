export class AppError extends Error {
  constructor(statusCode, code, message, fieldErrors = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function badRequest(message, fieldErrors = null, code = 'VALIDATION_ERROR') {
  return new AppError(400, code, message, fieldErrors);
}

export function unauthorized(message = 'Authentication required.', code = 'UNAUTHORIZED') {
  return new AppError(401, code, message);
}

export function forbidden(message = 'You are not authorized to perform this action.', code = 'FORBIDDEN') {
  return new AppError(403, code, message);
}

export function notFound(message = 'Requested resource was not found.', code = 'NOT_FOUND') {
  return new AppError(404, code, message);
}

export function conflict(message, code = 'CONFLICT') {
  return new AppError(409, code, message);
}
