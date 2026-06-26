import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const PUBLIC_ROOT = path.resolve(process.cwd(), ".output/public");

const MIME_BY_EXT: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

function isPublicStaticPath(pathname: string): boolean {
  if (pathname === "/manifest.webmanifest") return true;
  return (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/lobby/") ||
    pathname.startsWith("/profile/") ||
    pathname.startsWith("/damas/")
  );
}

function resolvePublicFile(pathname: string): string | null {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_ROOT, relative);
  const rootWithSep = `${PUBLIC_ROOT}${path.sep}`;
  if (filePath !== PUBLIC_ROOT && !filePath.startsWith(rootWithSep)) {
    return null;
  }
  return filePath;
}

/** Serve ficheiros de .output/public — contorna falhas do readAsset do Nitro em produção. */
export async function tryServePublicStatic(request: Request): Promise<Response | null> {
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") return null;

  const url = new URL(request.url);
  if (!isPublicStaticPath(url.pathname)) return null;

  const filePath = resolvePublicFile(url.pathname);
  if (!filePath) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    await access(filePath);
    const info = await stat(filePath);
    if (!info.isFile()) return null;

    const ext = path.extname(filePath).toLowerCase();
    const headers = new Headers({
      "content-type": MIME_BY_EXT[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    });

    if (method === "HEAD") {
      headers.set("content-length", String(info.size));
      return new Response(null, { status: 200, headers });
    }

    const body = await readFile(filePath);
    return new Response(body, { status: 200, headers });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
