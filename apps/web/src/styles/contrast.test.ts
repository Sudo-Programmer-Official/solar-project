import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared web styles keep form values and active navigation readable", async () => {
  const css = await readFile(new URL("./tailwind.css", import.meta.url), "utf8");
  const desktopNavigation = await readFile(new URL("../components/DesktopNavigation.vue", import.meta.url), "utf8");
  const bottomNavigation = await readFile(new URL("../components/BottomNavigation.vue", import.meta.url), "utf8");

  assert.match(css, /input,[\s\S]*textarea,[\s\S]*select[\s\S]*color:\s*#0f172a/);
  assert.match(css, /input::placeholder,[\s\S]*textarea::placeholder[\s\S]*color:\s*#94a3b8/);
  assert.match(css, /input:-webkit-autofill[\s\S]*-webkit-text-fill-color:\s*#0f172a/);
  assert.match(desktopNavigation, /bg-cyan-50 text-slate-950/);
  assert.match(bottomNavigation, /bg-cyan-50 text-slate-950/);
});
