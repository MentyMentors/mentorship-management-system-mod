import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against the October 2026 incident: a migration that only the psql
 * client could run broke `prisma migrate deploy` (and every Vercel build).
 * Prisma sends migration files straight to PostgreSQL, so client-side
 * meta-syntax must never appear in them.
 */
const MIGRATIONS = join(__dirname, "../../prisma/migrations");

const migrationFiles = readdirSync(MIGRATIONS)
  .filter((name) => statSync(join(MIGRATIONS, name)).isDirectory())
  .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8") }));

function withoutComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("prisma migrations", () => {
  it.each(migrationFiles)("$name contains no psql-only syntax", ({ sql }) => {
    const code = withoutComments(sql);
    expect(code).not.toMatch(/(?<!:):'[A-Za-z_]/); // :'variable' (not a ::cast)
    expect(code).not.toMatch(/(?<!:):"[A-Za-z_]/); // :"variable" (not a ::cast)
    expect(code).not.toMatch(/^\s*\\[a-z]/m); // \set, \i, \echo ...
  });

  it("never deletes rows", () => {
    for (const { name, sql } of migrationFiles) {
      expect(withoutComments(sql), name).not.toMatch(/\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
    }
  });
});
