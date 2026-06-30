import { useState } from "react";
import { motion, type Variants } from "motion/react";
import QuizModal from "./QuizModal";
import QuizResultsModal from "./QuizResultsModal";
import RandomPickModal from "./RandomPickModal";
import { asset } from "../utils/asset";

type ActionKey = "random" | "quiz";

interface HomeAction {
  label: string;
  sub: string;
  icon: string;
  action: ActionKey;
  tint: "mint" | "pink";
  hint: string;
}

const actions: HomeAction[] = [
  {
    label: "随机抽取",
    sub: "RANDOM",
    icon: asset("/icon/select.png?v=3"),
    action: "random",
    tint: "mint",
    hint: "随手抽一条灵感",
  },
  {
    label: "标签速配",
    sub: "MATCH",
    icon: asset("/icon/catch.png?v=3"),
    action: "quiz",
    tint: "pink",
    hint: "答几题帮你定位",
  },
];

const tapSpring = { type: "spring" as const, stiffness: 500, damping: 30 };

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const chipVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 24, mass: 0.7 },
  },
};

export default function HomeMainCard() {
  const [randomOpen, setRandomOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  const handleAction = (action: ActionKey) => {
    if (action === "quiz") setQuizOpen(true);
    else setRandomOpen(true);
  };

  const actionsGrid = (
    <div className="home-actions-grid-root">
      <div className="home-actions-head">
        <span className="home-actions-title">快捷入口</span>
        <span className="home-actions-sub">选一条喜欢的路径</span>
      </div>
      <motion.div className="grid grid-cols-2 gap-3" variants={containerVariants}>
        {actions.map(({ label, sub, icon, action, tint, hint }) => (
          <motion.button
            key={label}
            type="button"
            onClick={() => handleAction(action)}
            className={`home-action-chip home-action-chip--${tint}`}
            variants={chipVariants}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={tapSpring}
            aria-label={`${label}，${hint}`}
          >
            <motion.img
              src={icon}
              alt=""
              className="home-action-icon"
              aria-hidden
              whileTap={{ rotate: -12, scale: 0.9 }}
              transition={tapSpring}
            />
            <span className="home-action-text">
              <span className="home-action-label">{label}</span>
              <span className="home-action-sub">{sub}</span>
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );

  return (
    <>
      {actionsGrid}

      <RandomPickModal open={randomOpen} onClose={() => setRandomOpen(false)} />

      <QuizModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        onComplete={() => {
          setQuizOpen(false);
          setResultsOpen(true);
        }}
      />

      <QuizResultsModal open={resultsOpen} onClose={() => setResultsOpen(false)} />
    </>
  );
}
