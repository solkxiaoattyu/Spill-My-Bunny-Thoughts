import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.resolve(rootDir, "../02_语料与数据/corpus");
const corpusJsonPath = path.join(corpusDir, "tagged_corpus.json");
const corpusCsvPath = path.join(corpusDir, "tagged_corpus.csv");
const corpusVectorsPath = path.join(corpusDir, "corpus_vectors.json");
const removedIdsPath = path.join(corpusDir, "test_removed_ids.json");
const buildIndexScript = path.join(rootDir, "scripts/build-corpus-index.py");

const corpusAssets: Record<string, string> = {
  "/corpus/tagged_corpus.json": corpusJsonPath,
  "/corpus/corpus_vectors.json": corpusVectorsPath,
  "/corpus/test_removed_ids.json": removedIdsPath,
};

function readRemovedIds(): number[] {
  if (!fs.existsSync(removedIdsPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(removedIdsPath, "utf-8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isFinite(Number(id))).map(Number) : [];
  } catch {
    return [];
  }
}

function appendRemovedId(id: number) {
  const ids = new Set(readRemovedIds());
  ids.add(id);
  fs.writeFileSync(
    removedIdsPath,
    `${JSON.stringify([...ids].sort((a, b) => a - b), null, 2)}\n`,
    "utf-8",
  );
}

function rebuildCorpusVectors() {
  if (!fs.existsSync(buildIndexScript)) return;
  spawnSync("python", [buildIndexScript], { cwd: rootDir, stdio: "inherit" });
}

function filterCorpusByRemoved<T extends { id: number }>(items: T[]): T[] {
  const removed = new Set(readRemovedIds());
  if (!removed.size) return items;
  return items.filter((item) => !removed.has(item.id));
}

function persistCorpusRemoval(id: number): { ok: boolean; error?: string; remaining?: number } {
  if (!fs.existsSync(corpusJsonPath)) {
    return { ok: false, error: "corpus not found" };
  }

  const raw = JSON.parse(fs.readFileSync(corpusJsonPath, "utf-8")) as Array<{
    id: number;
    text: string;
    tags?: unknown;
  }>;
  const nextCorpus = raw.filter((item) => item.id !== id);
  if (nextCorpus.length === raw.length) {
    return { ok: false, error: "id not in corpus" };
  }

  fs.writeFileSync(corpusJsonPath, `${JSON.stringify(nextCorpus, null, 2)}\n`, "utf-8");
  appendRemovedId(id);

  if (fs.existsSync(corpusCsvPath)) {
    const csvLines = ["id,text,tags"];
    for (const item of nextCorpus) {
      const text = String(item.text).replace(/"/g, '""');
      const tags = JSON.stringify(item.tags ?? {});
      csvLines.push(`${item.id},"${text}","${tags.replace(/"/g, '""')}"`);
    }
    fs.writeFileSync(corpusCsvPath, `\ufeff${csvLines.join("\n")}`, "utf-8");
  }

  rebuildCorpusVectors();
  return { ok: true, remaining: nextCorpus.length };
}

function corpusStaticPlugin(): Plugin {
  return {
    name: "corpus-static",
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url?.split("?")[0];
        if (!url || !(url in corpusAssets)) {
          next();
          return;
        }
        const filePath = corpusAssets[url];
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end("Corpus asset not found");
          return;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (url === "/corpus/tagged_corpus.json") {
          const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Array<{ id: number }>;
          res.end(JSON.stringify(filterCorpusByRemoved(raw)));
          return;
        }
        fs.createReadStream(filePath).pipe(res);
      });
    },
    generateBundle() {
      if (!fs.existsSync(removedIdsPath)) {
        fs.writeFileSync(removedIdsPath, "[]\n", "utf-8");
      }

      this.emitFile({
        type: "asset",
        fileName: "corpus/test_removed_ids.json",
        source: fs.readFileSync(removedIdsPath),
      });

      for (const [urlPath, filePath] of Object.entries(corpusAssets)) {
        if (urlPath === "/corpus/test_removed_ids.json") continue;
        if (!fs.existsSync(filePath)) {
          this.warn(`${path.basename(filePath)} not found — build will miss corpus asset`);
          continue;
        }

        let source: string | Buffer = fs.readFileSync(filePath);
        if (urlPath === "/corpus/tagged_corpus.json") {
          const raw = JSON.parse(source.toString("utf-8")) as Array<{ id: number }>;
          source = `${JSON.stringify(filterCorpusByRemoved(raw))}\n`;
        }

        this.emitFile({
          type: "asset",
          fileName: urlPath.replace(/^\//, ""),
          source,
        });
      }
    },
  };
}

function testCorpusRemovePlugin(): Plugin {
  return {
    name: "test-corpus-remove",
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url?.split("?")[0];
        if (req.method !== "POST" || url !== "/api/test/corpus/remove") {
          next();
          return;
        }

        let body = "";
        req.on("data", (chunk: Buffer | string) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body) as { id?: number };
            const id = Number(parsed.id);
            if (!Number.isFinite(id)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: "invalid id" }));
              return;
            }

            const result = persistCorpusRemoval(id);
            if (!result.ok) {
              res.statusCode = result.error === "id not in corpus" ? 404 : 500;
              res.end(JSON.stringify({ ok: false, error: result.error }));
              return;
            }

            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                ok: true,
                removedId: id,
                remaining: result.remaining,
                persisted: true,
              }),
            );
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(error) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), corpusStaticPlugin(), testCorpusRemovePlugin()],
  // GitHub Pages 部署在子路径时，构建前设置 VITE_BASE=/仓库名/；本地 dev 默认 "/"
  base: process.env.VITE_BASE || "/",
  server: {
    fs: {
      allow: [rootDir, path.resolve(rootDir, "../02_语料与数据")],
    },
  },
});
