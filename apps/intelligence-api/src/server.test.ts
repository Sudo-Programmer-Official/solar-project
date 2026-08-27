import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractUpload } from "./server";

test("extractUpload preserves binary xlsx bytes from multipart form data", async () => {
  const data = await readFile("data/WEST SCHEDULE OFFICIAL.xlsx");
  const form = new FormData();
  form.append("file", new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "WEST SCHEDULE OFFICIAL.xlsx");
  const request = new Request("http://localhost/upload", { method: "POST", body: form });
  const parsed = extractUpload(Buffer.from(await request.arrayBuffer()), request.headers.get("content-type") ?? undefined, undefined);

  assert.ok(parsed);
  assert.equal(parsed.filename, "WEST SCHEDULE OFFICIAL.xlsx");
  assert.deepEqual(parsed.data, data);
});
