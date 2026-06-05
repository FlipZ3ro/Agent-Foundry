import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "../services/http/src/artifacts.js";
import { isSafePath } from "../services/worker/src/index.js";

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "agent-foundry-artifacts-"));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("ArtifactStore", () => {
  it("writes a file under run/task scope with sha256 + size", () => {
    const store = new ArtifactStore(dir);
    const artifacts = store.writeMany("run-001", [
      { taskId: "task-01", path: "src/foo.ts", content: "export const x = 1;\n" }
    ]);
    assert.equal(artifacts.length, 1);
    const a = artifacts[0]!;
    assert.equal(a.taskId, "task-01");
    assert.equal(a.path, "src/foo.ts");
    assert.equal(a.sizeBytes, 20);
    assert.match(a.sha256, /^[a-f0-9]{64}$/);
    assert.equal(a.contentType, "text/typescript");

    const onDisk = readFileSync(join(dir, "run-001", "task-01", "src", "foo.ts"), "utf8");
    assert.equal(onDisk, "export const x = 1;\n");
  });

  it("reads content back via readContent", () => {
    const store = new ArtifactStore(dir);
    store.writeMany("run-002", [
      { taskId: "task-02", path: "README.md", content: "hello" }
    ]);
    assert.equal(store.readContent("run-002", "task-02", "README.md"), "hello");
    assert.equal(store.readContent("run-002", "task-02", "missing.md"), undefined);
    assert.equal(store.readContent("nope", "task-02", "README.md"), undefined);
  });

  it("lists artifacts across tasks", () => {
    const store = new ArtifactStore(dir);
    store.writeMany("run-003", [
      { taskId: "task-01", path: "a.ts", content: "1" },
      { taskId: "task-02", path: "nested/b.ts", content: "22" }
    ]);
    const items = store.list("run-003");
    assert.equal(items.length, 2);
    const paths = items.map((i) => `${i.taskId}/${i.path}`).sort();
    assert.deepEqual(paths, ["task-01/a.ts", "task-02/nested/b.ts"]);
  });

  it("rejects path traversal in writeMany", () => {
    const store = new ArtifactStore(dir);
    const artifacts = store.writeMany("run-004", [
      { taskId: "task-01", path: "../escape.ts", content: "nope" },
      { taskId: "task-01", path: "/etc/passwd", content: "nope" },
      { taskId: "task-01", path: "ok.ts", content: "yes" }
    ]);
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0]!.path, "ok.ts");
  });

  it("rejects unsafe runId", () => {
    const store = new ArtifactStore(dir);
    assert.throws(() => store.writeMany("../bad", [
      { taskId: "task-01", path: "x.ts", content: "y" }
    ]));
  });
});

describe("isSafePath", () => {
  it("accepts plain relative paths", () => {
    assert.equal(isSafePath("src/index.ts"), true);
    assert.equal(isSafePath("README.md"), true);
    assert.equal(isSafePath("nested/dir/file.json"), true);
  });

  it("rejects traversal and absolute paths", () => {
    assert.equal(isSafePath("../escape.ts"), false);
    assert.equal(isSafePath("foo/../escape.ts"), false);
    assert.equal(isSafePath("/etc/passwd"), false);
    assert.equal(isSafePath("\\etc\\passwd"), false);
    assert.equal(isSafePath("C:/Windows/System32"), false);
  });

  it("rejects empty and over-long paths", () => {
    assert.equal(isSafePath(""), false);
    assert.equal(isSafePath("a".repeat(257)), false);
  });
});
