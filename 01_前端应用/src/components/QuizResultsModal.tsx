import { useEffect, useState } from "react";
import {
  createEmptyQuizAnswers,
  getMatchedQuotes,
  refreshMatchedQuotes,
  restartMatchedQuotes,
  type MatchedQuote,
  QUIZ_ANSWERS_KEY,
  QUIZ_REFRESH_REMAINING_KEY,
  QUIZ_STORAGE_KEY,
} from "../data/quiz";
import { formatQuizMatchLabel, recordMatchHistory } from "../data/matchHistory";
import MatchedCopyModal from "../components/MatchedCopyModal";

interface QuizResultsModalProps {
  open: boolean;
  onClose: () => void;
}

function loadAnswers(): string[] {
  const stored = localStorage.getItem(QUIZ_ANSWERS_KEY);
  if (stored) {
    const parsed = JSON.parse(stored) as string[];
    const empty = createEmptyQuizAnswers();
    return empty.map((_, i) => parsed[i] ?? "");
  }
  return createEmptyQuizAnswers();
}

function loadRefreshRemaining(): number {
  const stored = localStorage.getItem(QUIZ_REFRESH_REMAINING_KEY);
  if (stored) return Number(stored);
  return 5;
}

export default function QuizResultsModal({ open, onClose }: QuizResultsModalProps) {
  const [answers] = useState(loadAnswers);
  const [quotes, setQuotes] = useState<MatchedQuote[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshRemaining, setRefreshRemaining] = useState(loadRefreshRemaining);
  const [refreshEmpty, setRefreshEmpty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRefreshEmpty(false);
    const stored = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (stored) {
      setQuotes(JSON.parse(stored));
      setRefreshRemaining(loadRefreshRemaining());
      return;
    }
    void getMatchedQuotes(answers).then(({ results, refreshRemaining: remaining }) => {
      setQuotes(results);
      setRefreshRemaining(remaining);
      localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(results));
      localStorage.setItem(QUIZ_REFRESH_REMAINING_KEY, String(remaining));
    });
  }, [open, answers]);

  const handleRefresh = () => {
    if (refreshRemaining <= 0) {
      setRefreshing(true);
      localStorage.removeItem(QUIZ_STORAGE_KEY);
      void restartMatchedQuotes(answers)
        .then(({ results, refreshRemaining: remaining }) => {
          if (!results.length) {
            setRefreshEmpty(true);
            setRefreshRemaining(0);
            localStorage.setItem(QUIZ_REFRESH_REMAINING_KEY, "0");
            return;
          }
          setQuotes(results);
          setRefreshRemaining(remaining);
          setRefreshEmpty(false);
          localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(results));
          localStorage.setItem(QUIZ_REFRESH_REMAINING_KEY, String(remaining));
          recordMatchHistory({
            type: "quiz",
            label: formatQuizMatchLabel(answers),
            quotes: results.map((item) => ({
              text: item.text,
              matchPercent: item.matchPercent,
            })),
          });
        })
        .finally(() => setRefreshing(false));
      return;
    }
    setRefreshing(true);
    setRefreshEmpty(false);
    void refreshMatchedQuotes(answers)
      .then(({ results, refreshRemaining: remaining }) => {
        if (!results.length) {
          setRefreshEmpty(true);
          // 不覆盖当前展示，让用户保留上一批
          setRefreshRemaining(0);
          localStorage.setItem(QUIZ_REFRESH_REMAINING_KEY, "0");
          return;
        }
        setQuotes(results);
        setRefreshRemaining(remaining);
        localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(results));
        localStorage.setItem(QUIZ_REFRESH_REMAINING_KEY, String(remaining));
        recordMatchHistory({
          type: "quiz",
          label: formatQuizMatchLabel(answers),
          quotes: results.map((item) => ({
            text: item.text,
            matchPercent: item.matchPercent,
          })),
        });
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  return (
    <MatchedCopyModal
      open={open}
      onClose={onClose}
      quotes={quotes}
      subtitle="根据你的问卷偏好精心挑选 3 条"
      loading={refreshing}
      onRefresh={handleRefresh}
      refreshLabel={refreshRemaining > 0 ? "换一批" : "重新开始换批"}
      refreshHint={
        refreshEmpty
          ? "该组合下的文案已全部展示，点击「重新开始换批」从同组合池重新挑选"
          : refreshRemaining > 0
            ? `还可换 ${refreshRemaining} 批（每批 3 条，均来自同一组合锁定池）`
            : "已换满 5 批，再次点击将在同组合池内重新开始"
      }
    />
  );
}
