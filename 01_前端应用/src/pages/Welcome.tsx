import { useEffect, useState } from "react";
import { asset } from "../utils/asset";

interface WelcomeProps {
  onComplete: () => void;
}

const AUTO_ENTER_MS = 2800;

export default function Welcome({ onComplete }: WelcomeProps) {
  const [leaving, setLeaving] = useState(false);

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onComplete, 420);
  };

  useEffect(() => {
    const timer = window.setTimeout(enter, AUTO_ENTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <button
      type="button"
      className={`welcome-splash ${leaving ? "welcome-splash--leave" : ""}`}
      onClick={enter}
      aria-label="进入 YourWord"
    >
      <img
        src={asset("/welcome-splash.png")}
        alt="YourWord — Words for your moments. Make your circle more you."
        className="welcome-splash-art"
        draggable={false}
      />
      <p className="welcome-splash-hint">轻触进入</p>
    </button>
  );
}
