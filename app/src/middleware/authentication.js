import { unauthorized } from "../core/errors.js";

export async function requireAuthentication() {
  throw unauthorized("Autenticacao administrativa ainda nao implementada.");
}
