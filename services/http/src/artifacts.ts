import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import type { Artifact } from "../../../packages/schemas/src/index.js";
import type { PendingArtifact } from "../../worker/src/index.js";
import { isSafePath } from "../../worker/src/index.js";

const CONTENT_TYPES: Record<string, string> = {
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".mjs": "text/javascript",
  ".cjs": "text/javascript",
  ".json": "application/json",
  ".md": "text/markdown",
  ".yml": "text/yaml",
  ".yaml": "text/yaml",
  ".py": "text/x-python",
  ".sql": "text/sql",
  ".html": "text/html",
  ".css": "text/css",
  ".sh": "text/x-sh",
  ".env": "text/plain"
};

function contentTypeFor(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? "text/plain";
}

export class ArtifactStore {
  private readonly root: string;

  constructor(root: string = resolve(process.cwd(), "artifacts")) {
    this.root = root;
    if (!existsSync(this.root)) mkdirSync(this.root, { recursive: true });
  }

  writeMany(runId: string, pending: PendingArtifact[]): Artifact[] {
    if (!isSafeRunId(runId)) {
      throw new Error(`unsafe runId: ${runId}`);
    }
    return pending
      .filter((p) => isSafePath(p.path) && p.taskId.length > 0)
      .map((p) => this.writeOne(runId, p));
  }

  private writeOne(runId: string, pending: PendingArtifact): Artifact {
    const target = this.resolveSafe(runId, pending.taskId, pending.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, pending.content, "utf8");
    const hash = createHash("sha256").update(pending.content, "utf8").digest("hex");
    const size = Buffer.byteLength(pending.content, "utf8");
    return {
      taskId: pending.taskId,
      path: pending.path,
      sizeBytes: size,
      sha256: hash,
      contentType: contentTypeFor(pending.path)
    };
  }

  readContent(runId: string, taskId: string, path: string): string | undefined {
    if (!isSafeRunId(runId) || !isSafePath(path)) return undefined;
    try {
      const target = this.resolveSafe(runId, taskId, path);
      if (!existsSync(target)) return undefined;
      return readFileSync(target, "utf8");
    } catch {
      return undefined;
    }
  }

  list(runId: string): Artifact[] {
    if (!isSafeRunId(runId)) return [];
    const runRoot = join(this.root, runId);
    if (!existsSync(runRoot)) return [];
    const items: Artifact[] = [];
    for (const taskId of readdirSync(runRoot)) {
      const taskRoot = join(runRoot, taskId);
      if (!statSync(taskRoot).isDirectory()) continue;
      walk(taskRoot).forEach((file) => {
        const path = relative(taskRoot, file).split(sep).join("/");
        const content = readFileSync(file, "utf8");
        items.push({
          taskId,
          path,
          sizeBytes: Buffer.byteLength(content, "utf8"),
          sha256: createHash("sha256").update(content, "utf8").digest("hex"),
          contentType: contentTypeFor(path)
        });
      });
    }
    return items;
  }

  /** Resolve `<root>/<runId>/<taskId>/<path>` ensuring no traversal escapes runId scope. */
  private resolveSafe(runId: string, taskId: string, path: string): string {
    if (!isSafeRunId(taskId)) throw new Error(`unsafe taskId: ${taskId}`);
    const runRoot = join(this.root, runId);
    const taskRoot = join(runRoot, taskId);
    const target = normalize(join(taskRoot, path));
    const relPath = relative(taskRoot, target);
    if (relPath.startsWith("..") || relPath === "") {
      throw new Error(`path escapes task root: ${path}`);
    }
    return target;
  }
}

function isSafeRunId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
