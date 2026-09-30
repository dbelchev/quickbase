# Database is injected into repositories

`@quickbase/database` opens an empty in-memory connection from `createServices()` with no arguments and returns it as `database`. The composition root (`tickets-server`, and tests) passes that connection into `@quickbase/tickets-agents` `createServices` as `db`, which hands it only to repositories. Services never call the database.
