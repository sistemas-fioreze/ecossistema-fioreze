export function requireDb(env) {
  if (!env?.DB) {
    throw new Error("Binding DB nao configurado.");
  }
  return env.DB;
}

export function prepare(env, sql, params = []) {
  return requireDb(env).prepare(sql).bind(...params);
}

export async function first(env, sql, params = []) {
  return prepare(env, sql, params).first();
}

export async function all(env, sql, params = []) {
  const result = await prepare(env, sql, params).all();
  return result.results || [];
}

export async function run(env, sql, params = []) {
  return prepare(env, sql, params).run();
}

export async function batch(env, statements) {
  return requireDb(env).batch(statements);
}

export function statement(env, sql, params = []) {
  return prepare(env, sql, params);
}
