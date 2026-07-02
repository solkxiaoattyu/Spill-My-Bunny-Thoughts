import { useState } from "react";
import { motion } from "motion/react";
import { Search, Sparkles, Loader2 } from "lucide-react";

interface HomeProfileBioProps {
  onMatch: (query: string) => void;
  matching?: boolean;
  error?: string | null;
  notice?: string | null;
}

const tapSpring = { type: "spring" as const, stiffness: 500, damping: 28 };

export default function HomeProfileBio({ onMatch, matching = false, error, notice }: HomeProfileBioProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = () => {
    const value = query.trim();
    if (!value || matching) return;
    onMatch(value);
  };

  return (
    <div className="home-compose-block home-search-engine">
      <div className="home-actions-head">
        <span className="home-actions-title">AI 匹配</span>
        <span className="home-actions-sub">描述需求，智能检索文案</span>
      </div>
      <div className="home-search-engine-bar">
        <span className="home-search-engine-icon" aria-hidden>
          <Search size={20} strokeWidth={2} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSubmit();
          }}
          placeholder="搜索文案，如：周末旅行治愈系"
          className="home-search-engine-input"
          aria-label="文案需求"
          disabled={matching}
        />
        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={!query.trim() || matching}
          className="home-search-engine-submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.94 }}
          transition={tapSpring}
          aria-busy={matching}
        >
          {matching ? (
            <Loader2 size={16} strokeWidth={2.4} className="home-submit-spinner" />
          ) : (
            <Sparkles size={15} strokeWidth={2.2} />
          )}
          {matching ? "搜索中" : "搜索"}
        </motion.button>
      </div>
      {notice && !error && (
        <motion.p
          className="mt-2 text-[12px] text-[#B8860B]"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {notice}
        </motion.p>
      )}
      {error && (
        <motion.p
          className="mt-2 text-[12px] text-[#E74C3C]"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
