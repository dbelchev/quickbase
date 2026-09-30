import { describe, expect, it } from "vitest";
import { all, compiler, createServices, get, run } from "../src";

describe("query compiler", () => {
  it("runs a compiled query with positional bindings on the in-memory connection", () => {
    const { database } = createServices();
    database.exec("create table items (name text)");

    const insert = compiler("items").insert({ name: "bolt" });
    const compiled = insert.toSQL();
    expect(compiled.sql).toBe("insert into `items` (`name`) values (?)");
    expect(compiled.bindings).toEqual(["bolt"]);

    expect(run(database, insert)).toBe(1);
    expect(all(database, compiler("items").select("name"))).toEqual([
      { name: "bolt" },
    ]);
    expect(
      get(database, compiler("items").where("name", "bolt").select("name")),
    ).toEqual({ name: "bolt" });
    expect(
      get(database, compiler("items").where("name", "missing").select("name")),
    ).toBeUndefined();
    expect(
      run(database, compiler("items").where("name", "missing").delete()),
    ).toBe(0);
  });

  it("allows a bigint or null binding and rejects any other kind", () => {
    const { database } = createServices();
    expect(() => get(database, compiler.raw("select ?", [false]))).toThrow(
      TypeError,
    );
    expect(
      get(database, {
        toSQL: () => ({ sql: "select ? as value", bindings: [BigInt(1)] }),
      }),
    ).toEqual({ value: 1 });
    expect(get(database, compiler.raw("select ? as value", [null]))).toEqual({
      value: null,
    });
  });
});
