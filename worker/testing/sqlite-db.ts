import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { Db, DbStatement } from "../db.ts";

class Statement implements DbStatement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
    private readonly values: SQLInputValue[] = [],
  ) {}

  bind(...values: unknown[]): DbStatement {
    return new Statement(this.database, this.sql, values as SQLInputValue[]);
  }

  async first<T>(): Promise<T | null> {
    return (this.database.prepare(this.sql).get(...this.values) as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.database.prepare(this.sql).all(...this.values) as T[] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const { changes } = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(changes) } };
  }
}

/** D1 と同じ SQLite を node:sqlite で動かし、Worker のテストに使う */
export function createSqliteDb(): Db {
  const database = new DatabaseSync(":memory:");
  const dir = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(dir).sort()) {
    database.exec(readFileSync(new URL(file, dir), "utf8"));
  }
  return {
    prepare: (sql) => new Statement(database, sql),
    batch: async <T>(statements: DbStatement[]) =>
      Promise.all(statements.map((statement) => statement.all<T>())),
  };
}
