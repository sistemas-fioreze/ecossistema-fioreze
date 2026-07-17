export class AppError extends Error {
  constructor(status, code, message, details = undefined, options = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = options.headers;
  }
}

export function badRequest(message, details) {
  return new AppError(400, "bad_request", message, details);
}

export function unauthorized(message = "Autenticacao obrigatoria.") {
  return new AppError(401, "unauthorized", message);
}

export function forbidden(message = "Acesso nao autorizado.") {
  return new AppError(403, "forbidden", message);
}

export function notFoundError(message = "Recurso nao encontrado.") {
  return new AppError(404, "not_found", message);
}

export function notImplemented(message = "Recurso ainda nao implementado.", details) {
  return new AppError(501, "not_implemented", message, details);
}

export function conflict(message, details) {
  return new AppError(409, "conflict", message, details);
}

export function unprocessable(message, details) {
  return new AppError(422, "unprocessable_entity", message, details);
}
