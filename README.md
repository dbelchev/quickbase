# Quickbase

## Environment

`createServices` reads `GEMINI_TEST_API_KEY` from the environment. Create a local env file and set the key:

```sh
cp .env.example .env.local
```

`.env.local` stays untracked. Packages do not load that file. `pnpm dev`, `pnpm dev:tickets`, and `pnpm start` load it into the environment before Turbo starts the client and server. An already set `GEMINI_TEST_API_KEY` is left as-is. Turbo passes that variable through to the `dev` and `start` tasks.
