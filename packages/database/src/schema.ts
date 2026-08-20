import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function readSchemaSql(): string {
  const filePath = fileURLToPath(import.meta.url);
  return fs.readFileSync(path.join(path.dirname(filePath), "schema.sql"), "utf8");
}
