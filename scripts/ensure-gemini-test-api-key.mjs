import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export const GEMINI_TEST_API_KEY = "GEMINI_TEST_API_KEY";

const HEADER =
  "# Local key for @quickbase/inference-provider. Copy this file to .env.local and set the value.";
const ENV_FILE = ".env.local";
const UNQUOTED = /^[A-Za-z0-9._:/+=~-]+$/;

function isSpace(char) {
  return char === " " || char === "\t" || char === "\n";
}

function trimSpaces(input) {
  let start = 0;
  let end = input.length;
  while (start < end && isSpace(input[start])) start += 1;
  while (end > start && isSpace(input[end - 1])) end -= 1;
  return input.slice(start, end);
}

function indexOfAny(input, chars) {
  for (let index = 0; index < input.length; index += 1) {
    if (chars.includes(input[index])) return index;
  }
  return -1;
}

// Mirrors Node's --env-file parser so "defined" matches what the dev process loads.
export function envFileValue(contents, key) {
  const store = new Map();
  let content = trimSpaces(contents.replaceAll("\r", ""));

  while (content.length > 0) {
    if (content[0] === "\n" || content[0] === "#") {
      const newline = content.indexOf("\n");
      content = newline === -1 ? "" : content.slice(newline + 1);
      continue;
    }

    const equalOrNewline = indexOfAny(content, ["=", "\n"]);
    if (equalOrNewline === -1 || content[equalOrNewline] === "\n") {
      if (equalOrNewline !== -1) {
        content = trimSpaces(content.slice(equalOrNewline + 1));
        continue;
      }
      break;
    }

    let name = trimSpaces(content.slice(0, equalOrNewline));
    content = content.slice(equalOrNewline + 1);

    if (content.length === 0 || content[0] === "\n") {
      if (name.length > 0) store.set(name, "");
      continue;
    }

    content = trimSpaces(content);
    if (name.length === 0) continue;

    if (name.startsWith("export ")) {
      name = trimSpaces(name.slice("export ".length));
    }

    if (content.length === 0) {
      store.set(name, "");
      break;
    }

    if (content[0] === '"') {
      const closingQuote = content.indexOf('"', 1);
      if (closingQuote !== -1) {
        store.set(name, content.slice(1, closingQuote).replaceAll("\\n", "\n"));
        const newline = content.indexOf("\n", closingQuote + 1);
        content = newline === -1 ? "" : content.slice(newline + 1);
        continue;
      }
    }

    if (content[0] === "'" || content[0] === '"' || content[0] === "`") {
      const quote = content[0];
      const closingQuote = content.indexOf(quote, 1);
      if (closingQuote === -1) {
        const newline = content.indexOf("\n");
        if (newline === -1) {
          store.set(name, content);
          break;
        }
        store.set(name, content.slice(0, newline));
        content = content.slice(newline + 1);
      } else {
        store.set(name, content.slice(1, closingQuote));
        const newline = content.indexOf("\n", closingQuote + 1);
        content = newline === -1 ? "" : content.slice(newline + 1);
        continue;
      }
    } else {
      const newline = content.indexOf("\n");
      let value = newline === -1 ? content : content.slice(0, newline);
      const hash = value.indexOf("#");
      if (hash !== -1) value = value.slice(0, hash);
      store.set(name, trimSpaces(value));
      content = newline === -1 ? "" : content.slice(newline + 1);
    }

    content = trimSpaces(content);
  }

  return store.has(key) ? store.get(key) : null;
}

export function readGeminiTestApiKey(contents) {
  const value = envFileValue(contents, GEMINI_TEST_API_KEY);
  return value === null ? "" : value.trim();
}

function encodeAssignment(value) {
  if (UNQUOTED.test(value)) {
    return `${GEMINI_TEST_API_KEY}=${value}`;
  }
  if (!value.includes("'")) {
    return `${GEMINI_TEST_API_KEY}='${value}'`;
  }
  if (!value.includes("`")) {
    return `${GEMINI_TEST_API_KEY}=\`${value}\``;
  }
  if (!value.includes('"') && !value.includes("\\n")) {
    return `${GEMINI_TEST_API_KEY}="${value}"`;
  }
  throw new Error(`${GEMINI_TEST_API_KEY} cannot be stored in ${ENV_FILE}`);
}

function lineAssignsKey(line) {
  let content = trimSpaces(line.replaceAll("\r", ""));
  if (content.length === 0 || content.startsWith("#")) return false;
  const equal = content.indexOf("=");
  if (equal === -1) return false;
  let name = trimSpaces(content.slice(0, equal));
  if (name.startsWith("export ")) {
    name = trimSpaces(name.slice("export ".length));
  }
  return name === GEMINI_TEST_API_KEY;
}

export function upsertGeminiTestApiKey(contents, value) {
  const assignment = encodeAssignment(value);
  if (trimSpaces(contents.replaceAll("\r", "")) === "") {
    return `${HEADER}\n${assignment}\n`;
  }

  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  const normalized = contents.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const ended = normalized.endsWith("\n");
  const lines = (ended ? normalized.slice(0, -1) : normalized).split("\n");
  let last = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lineAssignsKey(lines[index])) last = index;
  }
  if (last === -1) lines.push(assignment);
  else lines[last] = assignment;
  return `${lines.join(newline)}${newline}`;
}

export async function ensureGeminiTestApiKey({
  readText,
  writeText,
  stdin,
  stdout,
  stderr,
}) {
  const contents = readText() ?? "";
  if (readGeminiTestApiKey(contents)) return true;

  if (!stdin.isTTY) {
    stderr.write(
      `${GEMINI_TEST_API_KEY} is not set in ${ENV_FILE}. Set it before running pnpm dev:tickets.\n`,
    );
    return false;
  }

  stderr.write(`${GEMINI_TEST_API_KEY} is not set in ${ENV_FILE}.\n`);
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    for (;;) {
      const entered = await ask(rl, `Enter ${GEMINI_TEST_API_KEY}: `);
      const value = entered.trim();
      if (!value) {
        stderr.write(`${GEMINI_TEST_API_KEY} is required.\n`);
        continue;
      }
      try {
        writeText(upsertGeminiTestApiKey(contents, value));
        return true;
      } catch {
        stderr.write(
          `That value cannot be stored in ${ENV_FILE}. Enter ${GEMINI_TEST_API_KEY} again.\n`,
        );
      }
    }
  } catch {
    return false;
  } finally {
    rl.close();
  }
}

function ask(rl, prompt) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      rl.off("close", onClose);
      fn(value);
    };
    const onClose = () => finish(reject, new Error("prompt closed"));
    rl.once("close", onClose);
    rl.question(prompt, (answer) => finish(resolve, answer));
  });
}

function isDirectRun() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const ok = await ensureGeminiTestApiKey({
    readText() {
      try {
        return readFileSync(ENV_FILE, "utf8");
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
    },
    writeText(contents) {
      writeFileSync(ENV_FILE, contents);
    },
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  });
  process.exit(ok ? 0 : 1);
}
