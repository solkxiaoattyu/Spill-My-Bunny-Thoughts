import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseUserIntentLocal } from "../src/services/chatchat/ai.ts";
import {
  topMatchesTwoStage,
  buildSemanticTerms,
  extractMatchKeywords,
} from "../src/services/chatchat/match.ts";
import type { CorpusCopy } from "../src/services/chatchat/types.ts";

const query =
  process.argv.slice(2).join(" ") ||
  "我承认我好色，周大福的金色，卡地亚的银色，人民币的红色，都是我喜欢的颜色。";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpusPath = resolve(appRoot, "../02_语料与数据/corpus/tagged_corpus.json");
const raw = JSON.parse(readFileSync(corpusPath, "utf8")) as CorpusCopy[];

const FAILED_IDS = new Set([
  35, 696, 846, 1018, 1167, 1202, 1554, 1562, 1623, 2072, 2142, 2268, 2319, 2346,
  2362, 2394, 2430, 2875, 3025, 3152, 3153, 3179, 3187, 3209, 3227, 3229, 3234, 3242,
  3244, 3310, 3519, 3529, 3572, 4135, 4146, 4154, 4160, 4246, 4355, 4905,
]);

const corpus = raw.filter(
  (c) =>
    c.qc_passed !== false &&
    !FAILED_IDS.has(c.id) &&
    c.tags?.content_rating !== "rating_mild_slang",
);

const filters = parseUserIntentLocal(query);
const terms = buildSemanticTerms(query, filters);
const results = topMatchesTwoStage(corpus, filters, query, 5);

console.log("=== 输入 ===");
console.log(query);
console.log("\n=== 本地意图解析 ===");
console.log(JSON.stringify(filters, null, 2));
console.log("\n=== 检索词 ===");
console.log(extractMatchKeywords(query));
console.log("semantic terms:", terms);
console.log("\n=== Top 5 匹配 ===");
for (const r of results) {
  console.log(
    `\n[${r.matchPercent}%] id=${r.id} tag=${r.tagPercent}% sem=${r.semanticPercent}%`,
  );
  console.log(`mood: ${(r.tags?.mood || []).join(",")}`);
  console.log(r.text);
}
