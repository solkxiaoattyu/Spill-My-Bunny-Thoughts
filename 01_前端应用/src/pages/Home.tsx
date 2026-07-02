import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, type Variants } from "motion/react";
import { getViewerDisplayName } from "../data/brand";
import PageShell from "../components/PageShell";
import HomeMainCard from "../components/HomeMainCard";
import HomeMomentsHeader from "../components/HomeMomentsHeader";
import HomeProfileBio from "../components/HomeProfileBio";
import MatchedCopyModal from "../components/MatchedCopyModal";
import StackedDailyRecommend from "../components/StackedDailyRecommend";
import { useCorpus } from "../context/CorpusContext";
import {
  CUSTOM_MATCH_STORAGE_KEY,
  CUSTOM_QUERY_KEY,
  matchQuotesByQuery,
  refreshMatchByQuery,
  type MatchedCopy,
} from "../data/matchQuery";
import { recordMatchHistory } from "../data/matchHistory";
import {
  CORPUS_COPY_REMOVED_EVENT,
  type CorpusCopyRemovedDetail,
} from "../services/chatchat/corpusRemoval";

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status: corpusStatus } = useCorpus();
  const displayName = getViewerDisplayName();

  const [matchOpen, setMatchOpen] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchQuery, setMatchQuery] = useState("");
  const [matchResults, setMatchResults] = useState<MatchedCopy[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [refreshRemaining, setRefreshRemaining] = useState(5);
  const [matchMode, setMatchMode] = useState<"ai" | "embedding">("embedding");

  const openMatchResults = (query: string, results: MatchedCopy[]) => {
    setMatchQuery(query);
    setMatchResults(results);
    setMatchError(null);
    localStorage.setItem(CUSTOM_QUERY_KEY, query);
    localStorage.setItem(CUSTOM_MATCH_STORAGE_KEY, JSON.stringify(results));
    recordMatchHistory({
      type: "query",
      label: query,
      quotes: results.map((item) => ({
        text: item.text,
        matchPercent: item.matchPercent,
      })),
    });
    setMatchOpen(true);
  };

  const handleMatch = async (query: string) => {
    if (corpusStatus !== "ready") {
      setMatchError("语料尚未加载完成，请稍后再试");
      return;
    }
    setMatching(true);
    setMatchError(null);
    setMatchNotice(null);
    try {
      const { results, refreshRemaining: remaining, mode, notice } = await matchQuotesByQuery(query);
      if (!results.length) {
        setMatchError("未找到匹配文案，试试换个描述");
        return;
      }
      setRefreshRemaining(remaining);
      setMatchMode(mode);
      if (notice) setMatchNotice(notice);
      openMatchResults(query, results);
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "匹配失败，请稍后重试");
    } finally {
      setMatching(false);
    }
  };

  const handleRefreshMatch = async () => {
    if (!matchQuery || corpusStatus !== "ready") return;
    setMatching(true);
    try {
      const { results, refreshRemaining: remaining, mode, notice } = await refreshMatchByQuery(matchQuery);
      if (!results.length) return;
      setRefreshRemaining(remaining);
      setMatchMode(mode);
      if (notice) setMatchNotice(notice);
      setMatchResults(results);
      localStorage.setItem(CUSTOM_MATCH_STORAGE_KEY, JSON.stringify(results));
      recordMatchHistory({
        type: "query",
        label: matchQuery,
        quotes: results.map((item) => ({
          text: item.text,
          matchPercent: item.matchPercent,
        })),
      });
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "重新匹配失败");
    } finally {
      setMatching(false);
    }
  };

  useEffect(() => {
    if (!location.state?.focusRecommend) return;
    window.setTimeout(() => {
      document.getElementById("daily-recommend")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    navigate(".", { replace: true, state: {} });
  }, [location.state, navigate]);

  useEffect(() => {
    const onRemoved = (event: Event) => {
      const detail = (event as CustomEvent<CorpusCopyRemovedDetail>).detail;
      if (!detail?.text) return;
      setMatchResults((prev) => prev.filter((q) => q.text !== detail.text));
    };
    window.addEventListener(CORPUS_COPY_REMOVED_EVENT, onRemoved);
    return () => window.removeEventListener(CORPUS_COPY_REMOVED_EVENT, onRemoved);
  }, []);

  return (
    <PageShell bare>
      <motion.div
        className="flex min-h-0 flex-col soft-page"
        variants={homeStagger}
        initial="hidden"
        animate="visible"
      >
        <HomeMomentsHeader displayName={displayName} />

        <section className="home-main-section">
          <div className="home-main-inner">
            <motion.div
              className="home-block-bare shrink-0"
              variants={cardRise}
            >
              <HomeProfileBio
                onMatch={handleMatch}
                matching={matching}
                error={matchError}
                notice={matchNotice}
              />
            </motion.div>

            <motion.div
              className="home-block-bare home-block-bare--actions shrink-0"
              variants={cardRise}
            >
              <HomeMainCard />
            </motion.div>

            <motion.div
              id="daily-recommend"
              className="home-daily-section min-h-0 shrink pb-0"
              variants={cardRise}
            >
              <StackedDailyRecommend />
            </motion.div>
          </div>
        </section>
      </motion.div>

      <MatchedCopyModal
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        quotes={matchResults}
        subtitle={
          matchQuery
            ? `「${matchQuery.length > 16 ? `${matchQuery.slice(0, 16)}…` : matchQuery}」· ${matchMode === "ai" ? "AI 理解匹配" : "离线语义匹配"}`
            : "根据你的语境精心挑选 3 条"
        }
        loading={matching}
        onRefresh={handleRefreshMatch}
        refreshLabel={refreshRemaining > 0 ? "换一批" : "重新开始换批"}
        refreshHint={
          refreshRemaining > 0
            ? `还可换 ${refreshRemaining} 批（每批 3 条不重复，匹配度可低至 60%）`
            : "已换满 5 批，再次点击将重新开始"
        }
      />
    </PageShell>
  );
}

const homeStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.06 } },
};

const cardRise: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 26, mass: 0.8 },
  },
};
