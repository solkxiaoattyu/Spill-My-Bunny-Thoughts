import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Copy, Settings } from "lucide-react";
import { getViewerDisplayName } from "../data/brand";
import PageShell from "../components/PageShell";
import AppAvatar from "../components/AppAvatar";
import ProfileSettingsSheet from "../components/ProfileSettingsSheet";
import { useCorpus } from "../context/CorpusContext";
import {
  copyTextToClipboard,
  loadBrowseHistory,
  loadCopiedEntries,
  loadFavoriteEntries,
} from "../data/matchQuery";
import { resolveTagLabel } from "../services/chatchat/corpusLookup";
import { loadRandomPickHistory } from "../data/randomPickHistory";
import { loadMatchHistory } from "../data/matchHistory";

function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 7) return "登录后可见";
  if (phone.length >= 11) return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  return `${phone.slice(0, 2)}****${phone.slice(-2)}`;
}

function viewerDisplayName() {
  return getViewerDisplayName();
}

function truncateText(text: string, max = 56) {
  const flat = text.replace(/\n/g, " ");
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

const CARD_ART = {
  match: "/profile-cards/match.png",
  draw: "/profile-cards/draw.png",
  favorites: "/profile-cards/favorites.png",
  browse: "/profile-cards/browse.png",
  copied: "/profile-cards/copied.png",
} as const;

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status: corpusStatus } = useCorpus();
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem("isLoggedIn") === "true",
  );
  const phone = localStorage.getItem("userPhone");
  const displayName = viewerDisplayName();

  const [history, setHistory] = useState(() => loadBrowseHistory());
  const [matchHistory, setMatchHistory] = useState(() => loadMatchHistory());
  const [drawHistory, setDrawHistory] = useState(() => loadRandomPickHistory());
  const [favorites, setFavorites] = useState(() => loadFavoriteEntries());
  const [copied, setCopied] = useState(() => loadCopiedEntries());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recentCopied, setRecentCopied] = useState(false);

  const refreshAll = useCallback(() => {
    setHistory(loadBrowseHistory());
    setMatchHistory(loadMatchHistory());
    setDrawHistory(loadRandomPickHistory());
    setFavorites(loadFavoriteEntries());
    setCopied(loadCopiedEntries());
    setIsLoggedIn(localStorage.getItem("isLoggedIn") === "true");
  }, []);

  useEffect(() => {
    if (location.state?.openSettings) {
      setSettingsOpen(true);
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const handleFocus = () => refreshAll();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshAll]);

  const latestHistory = history[0];
  const latestCopy = copied[0];
  const latestMatch = matchHistory[0];
  const latestHistoryTag =
    latestHistory &&
    (latestHistory.tagLabel ||
      (corpusStatus === "ready" ? resolveTagLabel(latestHistory.text) : ""));

  const goToHistory = () => navigate("/history");
  const goToMatchHistory = () => navigate("/match-history");
  const goToDrawHistory = () => navigate("/draw-history");
  const goToFavorites = () => navigate("/favorites");
  const goToCopied = () => navigate("/copied");

  const handleCopyLatestHistory = async () => {
    if (!latestHistory) return;
    try {
      await copyTextToClipboard(latestHistory.text);
      setRecentCopied(true);
      setCopied(loadCopiedEntries());
      window.setTimeout(() => setRecentCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userPhone");
    setSettingsOpen(false);
    refreshAll();
  };

  return (
    <PageShell bare>
      <div className="profile-page profile-page--bento">
        <header className="profile-header">
          <div className="profile-topbar">
            <p className="profile-brand">
              <span className="profile-brand-accent">Your</span>Word
            </p>
            <div className="profile-topbar-actions">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="profile-topbar-btn"
                aria-label="设置"
              >
                <Settings size={18} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isLoggedIn) navigate("/login");
                }}
                className="profile-title-avatar"
                aria-label={isLoggedIn ? displayName : "登录"}
              >
                <AppAvatar size="sm" radius="full" />
              </button>
            </div>
          </div>

          <div className="profile-title-copy">
            <h1 className="profile-page-title">我的文案库</h1>
            <p className="profile-page-subtitle">
              {displayName}
              <span className="profile-page-dot" aria-hidden>
                ·
              </span>
              {isLoggedIn ? maskPhone(phone) : "点击头像登录"}
            </p>
          </div>
        </header>

        <section className="profile-illust-list" aria-label="我的记录">
          <div className="profile-illust-duo-row">
            <button
              type="button"
              onClick={goToMatchHistory}
              className="profile-illust-card profile-illust-card--square profile-illust-card--blue"
            >
              <div className="profile-illust-body profile-illust-body--square">
                <h2 className="profile-illust-title">匹配历史</h2>
                <span className="profile-illust-pill">{matchHistory.length} 次匹配</span>
                <p className="profile-illust-sub">
                  {latestMatch?.label
                    ? truncateText(latestMatch.label, 10)
                    : "标签速配"}
                </p>
              </div>
              <img src={CARD_ART.match} alt="" className="profile-illust-art profile-illust-art--square" />
            </button>

            <button
              type="button"
              onClick={goToDrawHistory}
              className="profile-illust-card profile-illust-card--square profile-illust-card--draw"
            >
              <div className="profile-illust-body profile-illust-body--square">
                <h2 className="profile-illust-title">抽取历史</h2>
                <span className="profile-illust-pill">{drawHistory.length} 次抽取</span>
                <p className="profile-illust-sub">盲盒文案</p>
              </div>
              <img src={CARD_ART.draw} alt="" className="profile-illust-art profile-illust-art--square" />
            </button>
          </div>

          <button
            type="button"
            onClick={goToFavorites}
            className="profile-illust-card profile-illust-card--pink"
          >
            <div className="profile-illust-body">
              <div className="profile-illust-head-row">
                <h2 className="profile-illust-title">我的收藏</h2>
                <span className="profile-illust-pill">{favorites.length} 条收藏</span>
              </div>
              <p className="profile-illust-sub">
                {favorites.length > 0 ? "随时回看喜欢的文案" : "还没有收藏"}
              </p>
            </div>
            <img src={CARD_ART.favorites} alt="" className="profile-illust-art" />
          </button>

          <div
            role="button"
            tabIndex={0}
            onClick={goToHistory}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                goToHistory();
              }
            }}
            className="profile-illust-card profile-illust-card--feature cursor-pointer"
          >
            <div className="profile-illust-body">
              <div className="profile-illust-head-row">
                <h2 className="profile-illust-title">浏览历史</h2>
                <span className="profile-illust-pill">{history.length} 条浏览</span>
              </div>
              {latestHistory ? (
                <>
                  <div className="profile-illust-meta-row">
                    {latestHistoryTag ? (
                      <span className="profile-illust-tag">{latestHistoryTag}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleCopyLatestHistory();
                      }}
                      disabled={!latestHistory}
                      className={`profile-illust-action ${recentCopied ? "is-copied" : ""}`.trim()}
                    >
                      {recentCopied ? (
                        <>
                          <Check size={11} strokeWidth={2.4} aria-hidden />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy size={11} strokeWidth={2.2} aria-hidden />
                          复制
                        </>
                      )}
                    </button>
                  </div>
                  <p className="profile-illust-sub">{truncateText(latestHistory.text, 20)}</p>
                </>
              ) : (
                <p className="profile-illust-sub">还没有浏览记录</p>
              )}
            </div>
            <img src={CARD_ART.browse} alt="" className="profile-illust-art" />
          </div>

          <button
            type="button"
            onClick={goToCopied}
            className="profile-illust-card profile-illust-card--cream"
          >
            <div className="profile-illust-body">
              <div className="profile-illust-head-row">
                <h2 className="profile-illust-title">复制记录</h2>
                <span className="profile-illust-pill">{copied.length} 条已复制</span>
              </div>
              <p className="profile-illust-sub">
                {latestCopy ? truncateText(latestCopy.text, 22) : "还没有复制记录"}
              </p>
            </div>
            <img src={CARD_ART.copied} alt="" className="profile-illust-art" />
          </button>
        </section>
      </div>

      <ProfileSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isLoggedIn={isLoggedIn}
        onDataCleared={refreshAll}
        onLogout={handleLogout}
      />
    </PageShell>
  );
}
