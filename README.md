# Quickbase

## Environment

`createServices` reads `GEMINI_TEST_API_KEY` from the environment. `pnpm dev:tickets` checks `.env.local` before Turbo starts. When that file is missing, or `GEMINI_TEST_API_KEY` is absent or blank, the command asks for the key, writes it into `.env.local`, and only then starts Turbo. A later run with a non-empty value skips the prompt. A blank entry asks again. Closing the prompt exits without writing the file or starting Turbo.

In a non-interactive shell, `pnpm dev:tickets` exits before Turbo starts and tells you to set `GEMINI_TEST_API_KEY` in `.env.local`.

`pnpm dev` and `pnpm start` load `.env.local` when it exists, then start Turbo. Packages load the key from the environment Turbo passes through, and `.env.local` stays untracked. An already set `GEMINI_TEST_API_KEY` in the shell is left as-is when Turbo starts.
