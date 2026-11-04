import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import handler from "../../api/index.js";

const root = path.resolve("dist");
const headers = JSON.parse(fs.readFileSync("vercel.json", "utf8")).headers[0]
  .headers;
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
export const server = http.createServer(async (req, res) => {
  for (const { key, value } of headers) res.setHeader(key, value);
  try {
    // The public Host arrives through Apache; do not trust client-supplied X-Forwarded-Host.
    req.headers["x-forwarded-host"] = req.headers.host;
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const request = req as any;
      const response = res as any;
      request.query = Object.create(null);
      for (const key of new Set(url.searchParams.keys())) {
        const values = url.searchParams.getAll(key);
        request.query[key] = values.length === 1 ? values[0] : values;
      }
      request.query.route = url.pathname.slice(5);
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024 * 1024) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString("utf8");
      if (body) {
        if (!String(req.headers["content-type"]).includes("application/json")) {
          res.writeHead(415).end();
          return;
        }
        try {
          request.body = JSON.parse(body);
        } catch {
          res.writeHead(400).end();
          return;
        }
      }
      response.status = (status: number) => {
        res.statusCode = status;
        return response;
      };
      response.json = (value: unknown) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(value));
        return response;
      };
      response.send = (value: string) => {
        res.end(value);
        return response;
      };
      await handler(request, response);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method || "")) {
      res.writeHead(405).end();
      return;
    }
    const requested = path.resolve(
      root,
      "." + decodeURIComponent(url.pathname),
    );
    if (!requested.startsWith(root + path.sep) && requested !== root) {
      res.writeHead(404).end();
      return;
    }
    // Never expose application configuration or source files through the SPA fallback.
    if (url.pathname.split("/").some((segment) => segment.startsWith("."))) {
      res.writeHead(404).end();
      return;
    }
    let file = requested;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (path.extname(url.pathname)) {
        res.writeHead(404).end();
        return;
      }
      file = path.join(root, "index.html");
    }
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader(
      "Cache-Control",
      file.includes(path.sep + "assets" + path.sep)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(file).pipe(res);
  } catch {
    if (!res.headersSent)
      res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Сервис временно недоступен" }));
  }
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(Number(process.env.PORT) || 3000, "0.0.0.0");
