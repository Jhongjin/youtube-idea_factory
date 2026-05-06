import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function stripInlineComment(value) {
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
    }
    if (char === "#" && !quote && /\s/.test(value[index - 1] ?? "")) {
      return value.slice(0, index);
    }
  }
  return value;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const equalIndex = normalized.indexOf("=");
  if (equalIndex < 1) {
    return null;
  }

  const key = normalized.slice(0, equalIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  const value = unquote(stripInlineComment(normalized.slice(equalIndex + 1)));
  return { key, value };
}

export function loadLocalEnv({
  cwd = process.cwd(),
  files = [".env.local", ".env"],
  override = false,
} = {}) {
  const loaded = [];
  for (const file of files) {
    const filePath = path.resolve(cwd, file);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }
      if (!override && process.env[parsed.key] !== undefined) {
        continue;
      }
      process.env[parsed.key] = parsed.value;
    }
    loaded.push(file);
  }
  return loaded;
}
