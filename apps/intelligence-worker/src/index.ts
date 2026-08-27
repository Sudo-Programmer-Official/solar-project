import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { buildDatabaseUrl, loadAppEnv } from "../../../packages/config/src/index";
import { createPostgresClient, runDatabaseMigrations, wrapPool } from "../../../packages/database/src/index";
import {
  inferRegionFromFilename,
  parseWorkbook,
  PostgresIntelligenceRepository,
} from "../../../packages/territory-scoring/src/index";
import { normalizeRegion } from "../../../packages/geo-core/src/index";

async function main(): Promise<void> {
  const env = loadAppEnv();
  const databaseUrl = buildDatabaseUrl(env);
  if (!databaseUrl) throw new Error("DATABASE_URL or DATABASE_HOST/DATABASE_NAME/DATABASE_USER is required.");
  const filePaths = await resolveFiles(process.argv.slice(2).filter((argument) => !argument.startsWith("--")));
  if (filePaths.length === 0) throw new Error("No .xlsx files supplied. Pass files or place workbooks in data/.");
  const regionArgument = process.argv.find((argument) => argument.startsWith("--region="))?.split("=", 2)[1];
  const pool = await createPostgresClient(databaseUrl);
  try {
    await runDatabaseMigrations(pool);
    const repository = new PostgresIntelligenceRepository(wrapPool(pool));
    for (const filePath of filePaths) {
      const filename = path.basename(filePath);
      const buffer = await readFile(filePath);
      const fileSha256 = createHash("sha256").update(buffer).digest("hex");
      const existing = await repository.getUploadByHash(fileSha256);
      if (existing && existing.status === "COMPLETED" && (existing.parsedRows === 0 || existing.insertedRows > 0)) {
        console.log(JSON.stringify({ filename, status: "already-imported", uploadId: existing.id }));
        continue;
      }
      const region = normalizeRegion(regionArgument ?? inferRegionFromFilename(filename));
      const parsed = parseWorkbook(buffer, filename, region);
      const uploadId = existing?.id ?? randomUUID();
      await repository.createUpload({
        id: uploadId,
        filename,
        region,
        fileSha256,
        status: "PROCESSING",
        parsedRows: parsed.appointments.length,
        insertedRows: 0,
        duplicateRows: 0,
        diagnostics: parsed.diagnostics,
      });
      await repository.insertAppointments(uploadId, parsed.appointments);
      const storedRows = await repository.countAppointmentsForUpload(uploadId);
      await repository.createUpload({
        id: uploadId,
        filename,
        region,
        fileSha256,
        status: "COMPLETED",
        parsedRows: parsed.appointments.length,
        insertedRows: storedRows,
        duplicateRows: parsed.appointments.length - storedRows,
        diagnostics: parsed.diagnostics,
      });
      console.log(JSON.stringify({ filename, status: "imported", uploadId, insertedRows: storedRows, duplicateRows: parsed.appointments.length - storedRows, diagnostics: parsed.diagnostics }));
    }
    await repository.rebuildAnalytics();
    console.log(JSON.stringify({ status: "analytics-rebuilt" }));
  } finally {
    await pool.end?.();
  }
}

async function resolveFiles(arguments_: string[]): Promise<string[]> {
  if (arguments_.length > 0) return arguments_.map(resolveInputPath);
  const dataDirectory = await findDataDirectory();
  const entries = await readdir(dataDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.xlsx$/i.test(entry.name))
    .map((entry) => path.join(dataDirectory, entry.name));
}

function resolveInputPath(value: string): string {
  if (path.isAbsolute(value)) return value;
  const workspacePath = path.resolve(process.cwd(), value);
  if (existsSync(workspacePath)) return workspacePath;
  const rootPath = path.resolve(process.cwd(), "../..", value);
  return existsSync(rootPath) ? rootPath : workspacePath;
}

async function findDataDirectory(): Promise<string> {
  const candidates = [path.resolve(process.cwd(), "data"), path.resolve(process.cwd(), "../..", "data")];
  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      return candidate;
    } catch {
      // Continue to the workspace-root data directory.
    }
  }
  return candidates[0]!;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
