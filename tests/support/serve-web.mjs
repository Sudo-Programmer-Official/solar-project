import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4174);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/web/dist");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const requestedPath = path.normalize(path.join(root, pathname));
  const isInsideRoot = requestedPath.startsWith(root);

  let filePath = isInsideRoot ? requestedPath : root;
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    if (pathname.startsWith("/assets/") || pathname.includes(".")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    filePath = path.join(root, "index.html");
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "content-type": mimeTypes.get(ext) ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Serving ${root} on http://${host}:${port}\n`);
});

