import { access, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

import { FastifyInstance, FastifyReply } from "fastify";

const PUBLIC_ROOT = resolve(process.cwd(), "public");

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function resolveAssetPath(root: string, assetPath: string): string | null {
  const normalized = assetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolutePath = resolve(root, normalized);
  const relativePath = relative(root, absolutePath).replace(/\\/g, "/");

  if (relativePath.startsWith("..")) {
    return null;
  }

  return absolutePath;
}

async function sendPublicFile(
  reply: FastifyReply,
  root: string,
  assetPath: string
): Promise<void> {
  const absolutePath = resolveAssetPath(root, assetPath);

  if (!absolutePath) {
    reply.code(404).type("text/plain; charset=utf-8").send("Not Found");
    return;
  }

  try {
    await access(absolutePath);
  } catch {
    reply.code(404).type("text/plain; charset=utf-8").send("Not Found");
    return;
  }

  const contentType = CONTENT_TYPES[extname(absolutePath).toLowerCase()];

  if (contentType) {
    reply.type(contentType);
  }

  reply.send(await readFile(absolutePath));
}

export function registerUiRoutes(app: FastifyInstance, storageRootPath: string): void {
  const storageRoot = resolve(process.cwd(), storageRootPath);

  app.get("/", async (_request, reply) => {
    await sendPublicFile(reply, PUBLIC_ROOT, "index.html");
  });

  app.get("/styles.css", async (_request, reply) => {
    await sendPublicFile(reply, PUBLIC_ROOT, "styles.css");
  });

  app.get("/app/*", async (request, reply) => {
    const wildcard = (request.params as { "*": string })["*"] ?? "";
    await sendPublicFile(reply, PUBLIC_ROOT, `app/${wildcard}`);
  });

  app.get("/storage/objects/:objectId/:filename", async (request, reply) => {
    const params = request.params as { objectId?: string; filename?: string };
    const objectId = params.objectId ?? "";
    const filename = params.filename ?? "";

    await sendPublicFile(reply, storageRoot, `objects/${objectId}/originals/${filename}`);
  });

  app.get("/storage/*", async (request, reply) => {
    const wildcard = (request.params as { "*": string })["*"] ?? "";
    await sendPublicFile(reply, storageRoot, wildcard);
  });

  app.get("/favicon.ico", async (_request, reply) => {
    reply.code(204).send();
  });
}
