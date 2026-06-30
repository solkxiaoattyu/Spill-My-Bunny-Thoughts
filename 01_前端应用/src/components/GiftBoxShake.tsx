import { useEffect, useState } from "react";
import { asset } from "../utils/asset";

const SHAKE_MS = 960;
const OPEN_HOLD_MS = 520;

interface GiftBoxShakeProps {
  label?: string;
  onComplete?: () => void;
}

export default function GiftBoxShake({
  label = "正在抽取…",
  onComplete,
}: GiftBoxShakeProps) {
  const [phase, setPhase] = useState<"shake" | "open">("shake");

  useEffect(() => {
    const openTimer = window.setTimeout(() => setPhase("open"), SHAKE_MS);
    const doneTimer = window.setTimeout(() => onComplete?.(), SHAKE_MS + OPEN_HOLD_MS);

    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div className="gift-shake-stage" role="status" aria-live="polite">
      <div className="gift-shake-art-wrap">
        <img
          src={asset("/gift-box-closed.png")}
          alt=""
          className={`gift-shake-image gift-shake-image--closed ${
            phase === "shake" ? "is-active is-shaking" : ""
          }`}
        />
        <img
          src={asset("/gift-box-open.png")}
          alt=""
          className={`gift-shake-image gift-shake-image--open ${
            phase === "open" ? "is-active is-opening" : ""
          }`}
        />
      </div>
      <p className="gift-shake-label">{label}</p>
    </div>
  );
}
