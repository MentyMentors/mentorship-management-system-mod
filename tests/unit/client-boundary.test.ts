import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Server code may render components exported by "use client" modules, but it
 * cannot call their functions or read their constants: Next.js replaces those
 * exports with client references, which fails at render time in production
 * (the Nov 2026 "/manage/programs/[id]" error). Imports from client modules
 * into server files must therefore be components (PascalCase) or types.
 */
const SRC = join(__dirname, "../../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = walk(SRC).map((path) => ({ path, code: readFileSync(path, "utf8") }));
const isClient = (code: string) => /^\s*["']use client["']/.test(code);
const clientModules = new Set(
  files.filter((f) => isClient(f.code)).map((f) => "@/" + relative(SRC, f.path).replace(/\.tsx?$/, ""))
);

describe("server/client boundary", () => {
  const serverFiles = files.filter((f) => !isClient(f.code));
  it.each(serverFiles.map((f) => ({ file: relative(SRC, f.path), code: f.code })))(
    "$file imports only components or types from client modules",
    ({ code }) => {
      const offending: string[] = [];
      for (const m of code.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+["'](@\/[^"']+)["']/g)) {
        const [, typeOnly, names, from] = m;
        if (typeOnly || !clientModules.has(from)) continue;
        for (const raw of names.split(",")) {
          const name = raw.trim();
          if (!name || name.startsWith("type ")) continue;
          const local = name.split(/\s+as\s+/)[0];
          if (!/^[A-Z]/.test(local) || /^[A-Z0-9_]+$/.test(local)) offending.push(`${local} from ${from}`);
        }
      }
      expect(offending).toEqual([]);
    }
  );
});
