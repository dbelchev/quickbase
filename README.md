# Quickbase

## Environment

`createServices` reads `GEMINI_TEST_API_KEY` from the environment. Create a local env file and set the key:

```sh
cp .env.example .env.local
```

`.env.local` stays untracked. `@quickbase/inference-provider` does not load that file. The process that calls `createServices` has to already have `GEMINI_TEST_API_KEY` set.

Next.js loads env files from `apps/tickets`, so a root `.env.local` is not visible to `next dev`.
