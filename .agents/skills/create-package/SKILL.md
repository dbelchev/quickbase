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

1. Take the package name as a single folder segment, the service class name in PascalCase ending in `Service`, and the repository class name in PascalCase ending in `Repository`. Completion: the folder is `packages/<name>` and the package name is `@quickbase/<name>`.
2. Copy every file in `templates/` into that folder. Replace `__PACKAGE__` with `<name>`, `__SERVICE__` with the service class name, and `__REPOSITORY__` with the repository class name, including those filenames. Completion: the tree matches `templates/`, with those tokens filled in.
3. From the repo root, run `pnpm install`. Completion: the lockfile lists `@quickbase/<name>`.
4. Run `pnpm --filter @quickbase/<name> test` and `pnpm --filter @quickbase/<name> check-types`. Completion: both exit 0.

The skill's work ends at the new package. Wiring it into `apps/tickets` is a separate change. When `apps/tickets` depends on the package, add `@quickbase/<name>` to `transpilePackages` in `apps/tickets/next.config.ts` so Next compiles its TypeScript source.

## Zod

Zod is a runtime dependency of every domain package (`"zod": "catalog:"`). Every Zod schema and every type alias lives in `src/model/`. The TypeScript type for a schema is `z.infer<typeof schema>`, declared in that same file. `src/index.ts` exports those types. `service/` and `repository/` import schemas and types from `model/`.

## Services

A service is a class. Its file is `src/service/<Name>Service.ts`, and the class name matches the filename. `src/service/index.ts` exports only that class.

`createServices()` takes no parameters. It constructs each service and returns an object whose properties are those instances.

A package that needs another one depends on it with `"@quickbase/<other>": "workspace:*"` and calls that package's `createServices()` from inside its own `createServices()`.

## Repositories

A repository is a class. Its file is `src/repository/<Name>Repository.ts`, and the class name matches the filename. `src/repository/index.ts` exports only that class.

`createServices()` constructs each repository with `new` and passes that instance to the service constructor. A package that stores nothing has no repository, and `createServices()` constructs its services directly.

`src/index.ts` exports `createServices`, the service classes, the repository classes, and the model types.

## Tests

Tests live in the package's `__tests__/` directory as `*.test.ts`. They import the package through `../src`. The shared Vitest config includes `src/**/*.test.ts`, so the package `vitest.config.ts` sets `test.include` to `__tests__/**/*.test.ts`. `tsconfig.json` includes `src` and `__tests__`.

## Node types

`process` is typed by `@types/node` (`"@types/node": "catalog:"` in `devDependencies`). `tsconfig.json` sets `compilerOptions.types` to `["node"]`.
