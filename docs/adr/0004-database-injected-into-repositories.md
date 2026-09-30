# Database is injected into repositories

`@quickbase/database` opens an empty in-memory connection from `createServices()` with no arguments and returns it as `database`. The composition root (`tickets-server`, and tests) passes that connection into `@quickbase/tickets-agents` `createServices` as `db`, which hands it only to repositories. Services never call the database.

Repositories build queries with the shared Knex `compiler` from `@quickbase/database`. The compiler is configured for SQLite and has no connection of its own. A repository runs a compiled query with `all`, `get`, or `run` on the injected connection. Creating a table, the reseed delete, and seed inserts stay SQL strings.
