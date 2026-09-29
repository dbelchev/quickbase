---
name: create-package
description: >-
  Scaffold a private @quickbase domain package with model, service, repository,
  createServices, Zod, and Vitest. Use when creating a domain package, or when
  adding a Zod schema or model type under packages/.
---

# Create a domain package

A domain package lives in `packages/<name>` and is named `@quickbase/<name>`. Templates in `templates/` are the file contents. This document is the convention those files do not state.

## Steps

1. Take the package name as a single folder segment. Completion: the folder is `packages/<name>` and the package name is `@quickbase/<name>`.
2. Copy every file in `templates/` into that folder. Replace `__PACKAGE__` with `<name>`. Completion: the tree matches `templates/`, with the package name filled in.
3. From the repo root, run `pnpm install`. Completion: the lockfile lists `@quickbase/<name>`.
4. Run `pnpm --filter @quickbase/<name> test` and `pnpm --filter @quickbase/<name> check-types`. Completion: both exit 0.

The skill's work ends at the new package. Wiring it into `client` is a separate change. When `client` depends on the package, add `@quickbase/<name>` to `transpilePackages` in `client/next.config.ts` so Next compiles its TypeScript source.

## Zod

Zod is a runtime dependency of every domain package (`"zod": "catalog:"`). Every Zod schema lives in `src/model/`. The TypeScript type for a schema is `z.infer<typeof schema>`, declared in that same file. `src/index.ts` exports those types. `service/` and `repository/` import schemas and types from `model/`.

## createServices

`createServices()` takes no parameters. It calls `createRepository()`, passes that repository to the service constructor, and returns the services.

A package that needs another one depends on it with `"@quickbase/<other>": "workspace:*"` and calls that package's `createServices()` from inside its own `createServices()`.

`src/index.ts` exports `createServices` and the model types. Tests inside the package import `service/` and `repository/` by relative path. The scaffold test calls `createServices()` and expects the services object.
