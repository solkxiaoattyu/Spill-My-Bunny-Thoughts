import { getCorpus } from "../services/chatchat/corpus";
import type { CorpusCopy } from "../services/chatchat/types";

const TRIGGER = "期末周好崩溃";

/** 首批展示顺序（按 text 精确匹配语料，避免 id 漂移） */
const FIRST_BATCH_TEXTS = [
  "愤如怒,恶如心,头如晕,惊如恐,爆如炸,发如疯,狂如躁,悲如伤,养如胃,心如碎,死如亡,天如塌,上如吊,无如力,完如蛋,恨如冰,悲如惨,抓如马,命如苦,流如泪,迷如茫。",
  "学校群师欺我脑无力",
  "本人对于期末考试已有十分的把握 但是阴险的试卷满分竟然是一百",
] as const;

export function isFinalWeekCollapseQuery(query: string): boolean {
  return query.trim() === TRIGGER;
}

export function resolveFinalWeekCollapseCopies(
  corpus: CorpusCopy[] = getCorpus(),
): CorpusCopy[] {
  const byText = new Map(corpus.map((copy) => [copy.text, copy]));
  return FIRST_BATCH_TEXTS.map((text) => byText.get(text)).filter(
    (copy): copy is CorpusCopy => !!copy,
  );
}
