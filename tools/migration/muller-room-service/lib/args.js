export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      pushArg(args, "_", argument);
      continue;
    }
    const rawKey = argument.slice(2);
    const equalsIndex = rawKey.indexOf("=");
    if (equalsIndex !== -1) {
      pushArg(args, rawKey.slice(0, equalsIndex), rawKey.slice(equalsIndex + 1));
      continue;
    }
    const key = rawKey;
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    index += 1;
    pushArg(args, key, next);
  }
  return args;
}

export function arrayArg(value) {
  if (value == null || value === false) return [];
  return Array.isArray(value) ? value : [value];
}

export function stringArg(value, fallback = "") {
  if (Array.isArray(value)) return String(value.at(-1) || fallback);
  if (value == null || value === true || value === false) return fallback;
  return String(value);
}

function pushArg(args, key, value) {
  if (args[key] == null) args[key] = value;
  else if (Array.isArray(args[key])) args[key].push(value);
  else args[key] = [args[key], value];
}
