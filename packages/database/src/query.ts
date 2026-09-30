import knex, { type Knex } from "knex";
import type { Database } from "./createServices";

type SqlValue = string | number | bigint | null;

type CompiledQuery = {
  toSQL(): {
    sql: string;
    bindings?: readonly unknown[];
  };
};

export const compiler: Knex = knex({
  client: "sqlite3",
  useNullAsDefault: true,
});

function binding(value: unknown): SqlValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    value === null
  ) {
    return value;
  }
  throw new TypeError(
    "A query binding must be a string, number, bigint, or null.",
  );
}

function statement(query: CompiledQuery): { sql: string; bindings: SqlValue[] } {
  const compiled = query.toSQL();
  return {
    sql: compiled.sql,
    bindings: (compiled.bindings ?? []).map(binding),
  };
}

export function all(database: Database, query: CompiledQuery): unknown[] {
  const { sql, bindings } = statement(query);
  return database.prepare(sql).all(...bindings);
}

export function get(database: Database, query: CompiledQuery): unknown {
  const { sql, bindings } = statement(query);
  return database.prepare(sql).get(...bindings);
}

export function run(database: Database, query: CompiledQuery): number {
  const { sql, bindings } = statement(query);
  return Number(database.prepare(sql).run(...bindings).changes);
}
