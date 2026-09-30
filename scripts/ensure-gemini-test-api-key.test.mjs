import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ensureGeminiTestApiKey,
  envFileValue,
  readGeminiTestApiKey,
  upsertGeminiTestApiKey,
} from "./ensure-gemini-test-api-key.mjs";

const scriptPath = fileURLToPath(
  new URL("./ensure-gemini-test-api-key.mjs", import.meta.url),
);

function loadedByNode(contents) {
  const dir = mkdtempSync(join(tmpdir(), "gemini-key-"));
  const file = join(dir, ".env");
  writeFileSync(file, contents);
  const result = spawnSync(
    process.execPath,
    [
      `--env-file=${file}`,
      "-e",
      "process.stdout.write(process.env.GEMINI_TEST_API_KEY === undefined ? 'null' : JSON.stringify(process.env.GEMINI_TEST_API_KEY))",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0);
  return result.stdout === "null" ? null : JSON.parse(result.stdout);
}

describe("env file value", () => {
  it("matches node --env-file for the shapes .env.local can take", () => {
    const samples = [
      "GEMINI_TEST_API_KEY=\n",
      "GEMINI_TEST_API_KEY=   \n",
      'GEMINI_TEST_API_KEY=""\n',
      'GEMINI_TEST_API_KEY="  "\n',
      "GEMINI_TEST_API_KEY=abc\n",
      'GEMINI_TEST_API_KEY="ab c"\n',
      "GEMINI_TEST_API_KEY='ab c'\n",
      "export GEMINI_TEST_API_KEY=abc\n",
      "# GEMINI_TEST_API_KEY=abc\n",
      "GEMINI_TEST_API_KEY=abc#def\n",
      "GEMINI_TEST_API_KEY=\nGEMINI_TEST_API_KEY=second\n",
      "GEMINI_TEST_API_KEY=first\nGEMINI_TEST_API_KEY=\n",
      'GEMINI_TEST_API_KEY="a#b c"\n',
      "OTHER=1\n",
    ];

    for (const contents of samples) {
      assert.equal(envFileValue(contents, "GEMINI_TEST_API_KEY"), loadedByNode(contents));
    }
  });

  it("treats a blank or whitespace value as missing", () => {
    assert.equal(readGeminiTestApiKey(""), "");
    assert.equal(readGeminiTestApiKey("GEMINI_TEST_API_KEY=\n"), "");
    assert.equal(readGeminiTestApiKey("GEMINI_TEST_API_KEY=   \n"), "");
    assert.equal(readGeminiTestApiKey('GEMINI_TEST_API_KEY="  "\n'), "");
    assert.equal(readGeminiTestApiKey("# GEMINI_TEST_API_KEY=abc\n"), "");
    assert.equal(readGeminiTestApiKey("GEMINI_TEST_API_KEY=abc\n"), "abc");
  });
});

describe("upsert", () => {
  it("creates .env.local from the example header when the file is empty", () => {
    const next = upsertGeminiTestApiKey("", "abc");
    assert.equal(
      next,
      "# Local key for @quickbase/inference-provider. Copy this file to .env.local and set the value.\nGEMINI_TEST_API_KEY=abc\n",
    );
    assert.equal(loadedByNode(next), "abc");
  });

  it("replaces a blank assignment and leaves every other line", () => {
    const next = upsertGeminiTestApiKey(
      "# keep\nOTHER=1\nGEMINI_TEST_API_KEY=\n",
      "abc",
    );
    assert.equal(next, "# keep\nOTHER=1\nGEMINI_TEST_API_KEY=abc\n");
  });

  it("appends when the key line is absent", () => {
    const next = upsertGeminiTestApiKey("OTHER=1\n", "ab c#d");
    assert.equal(next, "OTHER=1\nGEMINI_TEST_API_KEY='ab c#d'\n");
    assert.equal(loadedByNode(next), "ab c#d");
  });

  it("replaces the last assignment because that is the one node loads", () => {
    const next = upsertGeminiTestApiKey(
      "GEMINI_TEST_API_KEY=first\nGEMINI_TEST_API_KEY=\n",
      "second",
    );
    assert.equal(
      next,
      "GEMINI_TEST_API_KEY=first\nGEMINI_TEST_API_KEY=second\n",
    );
    assert.equal(loadedByNode(next), "second");
  });
});

function memoryIo(contents, { tty }) {
  const input = new PassThrough();
  input.isTTY = tty;
  const stdout = new PassThrough();
  let stdoutText = "";
  stdout.on("data", (chunk) => {
    stdoutText += chunk.toString();
  });
  let stderrText = "";
  const stderr = new Writable({
    write(chunk, _encoding, callback) {
      stderrText += chunk.toString();
      callback();
    },
  });
  let written = null;
  let answers = 0;
  const pending = ensureGeminiTestApiKey({
    readText: () => contents,
    writeText(next) {
      written = next;
    },
    stdin: input,
    stdout,
    stderr,
  });
  return {
    pending,
    stderr: () => stderrText,
    written: () => written,
    async answer(line) {
      const prompts = () =>
        stdoutText.split("Enter GEMINI_TEST_API_KEY:").length - 1;
      while (prompts() < answers + 1) {
        await new Promise((resolve) => stdout.once("data", resolve));
      }
      answers += 1;
      input.write(`${line}\n`);
    },
    end() {
      input.end();
    },
  };
}

describe("ensure", () => {
  it("does not prompt or write when the file already has a key", async () => {
    const io = memoryIo("GEMINI_TEST_API_KEY=abc\n", { tty: true });
    assert.equal(await io.pending, true);
    assert.equal(io.written(), null);
    assert.equal(io.stderr(), "");
  });

  it("exits before writing when nobody can answer the prompt", async () => {
    const io = memoryIo(null, { tty: false });
    assert.equal(await io.pending, false);
    assert.equal(io.written(), null);
    assert.match(io.stderr(), /Set it before running pnpm dev:tickets/);
  });

  it("asks again after a blank line, then stores the key", async () => {
    const io = memoryIo("OTHER=1\nGEMINI_TEST_API_KEY=\n", { tty: true });
    await io.answer("  ");
    await io.answer("  secret  ");
    assert.equal(await io.pending, true);
    assert.match(io.stderr(), /GEMINI_TEST_API_KEY is required/);
    assert.equal(io.written(), "OTHER=1\nGEMINI_TEST_API_KEY=secret\n");
  });

  it("does not write when the prompt is closed", async () => {
    const io = memoryIo("", { tty: true });
    io.end();
    assert.equal(await io.pending, false);
    assert.equal(io.written(), null);
  });

  it("does not store a value the env file cannot round-trip, then accepts the next one", async () => {
    const io = memoryIo("", { tty: true });
    await io.answer("a'b\"c`d\\ne");
    await io.answer("kept");
    assert.equal(await io.pending, true);
    assert.match(io.stderr(), /cannot be stored/);
    assert.equal(readGeminiTestApiKey(io.written()), "kept");
  });
});

describe("cli", () => {
  it("leaves an existing key file untouched and exits 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "gemini-cli-"));
    const file = join(dir, ".env.local");
    writeFileSync(file, "GEMINI_TEST_API_KEY=abc\nOTHER=1\n");
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
    assert.equal(readFileSync(file, "utf8"), "GEMINI_TEST_API_KEY=abc\nOTHER=1\n");
  });

  it("exits non-zero and does not create .env.local when stdin is not a terminal", () => {
    const dir = mkdtempSync(join(tmpdir(), "gemini-cli-"));
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /GEMINI_TEST_API_KEY is not set in \.env\.local/);
    assert.throws(() => readFileSync(join(dir, ".env.local"), "utf8"), /ENOENT/);
  });
});
