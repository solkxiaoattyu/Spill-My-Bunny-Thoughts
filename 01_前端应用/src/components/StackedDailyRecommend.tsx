import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CopyTagBadge from "./CopyTagBadge";
import MomentsQuoteItem from "./MomentsQuoteItem";
import { APP_DISPLAY_NAME } from "../data/brand";
import { useCorpus } from "../context/CorpusContext";
import { recordBrowseHistory } from "../data/matchQuery";
import { getDailyRecommendItems } from "../services/chatchat/dailyRecommend";
import { CORPUS_COPY_REMOVED_EVENT } from "../services/chatchat/corpusRemoval";

const SWIPE_THRESHOLD = 72;
const FLY_OUT_MS = 220;
const SNAP_BACK_MS = 220;
const DEFAULT_STACK_CARD_H = 132;

type StackDirection = "next" | "prev";
type DailyItem = ReturnType<typeof getDailyRecommendItems>[number];

function initialOrder(length: number) {
  return Array.from({ length }, (_, index) => index);
}

function renderQuoteCard(item: DailyItem) {
  return (
    <div className="stack-quote-card-wrap">
      <CopyTagBadge tagLabel={item.displayName} className="stack-card-tag" />
      <MomentsQuoteItem
        id={item.id}
        displayName={APP_DISPLAY_NAME}
        text={item.text}
        timestamp={item.postedAt}
        stackFooter
        className="stack-quote-card"
      />
    </div>
  );
}

function applyLayerTransform(el: HTMLElement | null, x: number, animate = false) {
  if (!el) return;
  el.style.transition = animate ? "transform 0.22s ease-out" : "none";
  el.style.transform = x === 0 ? "" : `translate3d(${x}px, 0, 0)`;
  if (animate && x === 0) {
    window.setTimeout(() => {
      if (el) el.style.transition = "";
    }, SNAP_BACK_MS);
  }
}

function pinLayer(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  el.style.position = "fixed";
  el.style.top = `${rect.top}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.right = "auto";
  el.style.margin = "0";
  el.style.zIndex = "100";
  el.classList.add("stack-card-layer--pinned");
}

function unpinLayer(el: HTMLElement) {
  el.style.position = "";
  el.style.top = "";
  el.style.left = "";
  el.style.width = "";
  el.style.height = "";
  el.style.right = "";
  el.style.margin = "";
  el.style.zIndex = "";
  el.style.transform = "";
  el.style.transition = "";
  el.style.removeProperty("--fly-start");
  el.classList.remove(
    "stack-card-layer--pinned",
    "animate-stack-fly-out-left",
    "animate-stack-fly-out-right",
  );
}

export default function StackedDailyRecommend() {
  const { status } = useCorpus();
  const [corpusRevision, setCorpusRevision] = useState(0);
  const items = useMemo(
    () => (status === "ready" ? getDailyRecommendItems() : []),
    [status, corpusRevision],
  );

  useEffect(() => {
    const bump = () => setCorpusRevision((n) => n + 1);
    window.addEventListener(CORPUS_COPY_REMOVED_EVENT, bump);
    return () => window.removeEventListener(CORPUS_COPY_REMOVED_EVENT, bump);
  }, []);

  const [stackOrder, setStackOrder] = useState(() => initialOrder(Math.max(items.length, 3)));
  const [stackCardH, setStackCardH] = useState(DEFAULT_STACK_CARD_H);
  const [isAnimating, setIsAnimating] = useState(false);
  const [incomingPrevId, setIncomingPrevId] = useState<string | null>(null);

  const measureRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const frontLayerRef = useRef<HTMLDivElement>(null);
  const flyingLayerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragX = useRef(0);
  const lockedAxis = useRef<"x" | "y" | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (items.length) setStackOrder(initialOrder(items.length));
  }, [items]);

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node || !items.length) return;

    const measure = () => {
      const heights = Array.from(node.querySelectorAll<HTMLElement>(".stack-measure-card")).map(
        (el) => el.getBoundingClientRect().height,
      );
      const max = Math.max(DEFAULT_STACK_CARD_H, ...heights, 0);
      if (max > 0) setStackCardH(Math.ceil(max));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    Array.from(node.querySelectorAll<HTMLElement>(".stack-measure-card")).forEach((el) =>
      observer.observe(el),
    );

    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const item = items[stackOrder[0]];
    if (!item) return;

    const timer = window.setTimeout(() => {
      recordBrowseHistory(item.text, {
        copyId: item.id,
        tagLabel: item.displayName,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [items, stackOrder]);

  const rotateStack = useCallback(
    (direction: StackDirection, flyStartX: number) => {
      if (isAnimating || !items.length) return;

      const layer = frontLayerRef.current;
      if (!layer) return;

      const prevIncomingId =
        direction === "prev" ? items[stackOrder[stackOrder.length - 1]].id : null;

      dragging.current = false;
      lockedAxis.current = null;
      layer.classList.remove("is-dragging");

      flyingLayerRef.current = layer;
      pinLayer(layer);
      layer.style.setProperty("--fly-start", `${flyStartX}px`);
      layer.style.transform = `translate3d(${flyStartX}px, 0, 0)`;
      layer.classList.add(
        direction === "prev" ? "animate-stack-fly-out-right" : "animate-stack-fly-out-left",
      );

      setIsAnimating(true);
      setIncomingPrevId(prevIncomingId);

      window.setTimeout(() => {
        if (flyingLayerRef.current) {
          unpinLayer(flyingLayerRef.current);
          flyingLayerRef.current = null;
        }
        setStackOrder((order) =>
          direction === "next"
            ? [...order.slice(1), order[0]]
            : [order[order.length - 1], ...order.slice(0, -1)],
        );
        setIncomingPrevId(null);
        setIsAnimating(false);
        dragX.current = 0;
      }, FLY_OUT_MS);
    },
    [isAnimating, items, stackOrder],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isAnimating) return;
    if ((event.target as HTMLElement).closest("button")) return;

    startX.current = event.clientX;
    startY.current = event.clientY;
    lockedAxis.current = null;
    dragging.current = true;
    dragX.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);

    const onWindowMove = (moveEvent: PointerEvent) => {
      if (!dragging.current || isAnimating) return;

      const deltaX = moveEvent.clientX - startX.current;
      const deltaY = moveEvent.clientY - startY.current;

      if (!lockedAxis.current) {
        if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
        lockedAxis.current = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      }
      if (lockedAxis.current !== "x") return;

      dragX.current = deltaX;
      frontLayerRef.current?.classList.add("is-dragging");
      applyLayerTransform(frontLayerRef.current, deltaX);
    };

    const onWindowEnd = () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowEnd);
      window.removeEventListener("pointercancel", onWindowEnd);
      finishPointer();
    };

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowEnd);
    window.addEventListener("pointercancel", onWindowEnd);
  };

  const finishPointer = () => {
    if (!dragging.current) return;
    dragging.current = false;
    lockedAxis.current = null;
    frontLayerRef.current?.classList.remove("is-dragging");

    if (dragX.current <= -SWIPE_THRESHOLD) {
      rotateStack("next", dragX.current);
      return;
    }
    if (dragX.current >= SWIPE_THRESHOLD) {
      rotateStack("prev", dragX.current);
      return;
    }

    applyLayerTransform(frontLayerRef.current, 0, true);
    dragX.current = 0;
  };

  const peekCount = Math.max(0, stackOrder.length - 1);

  const shellStyle = {
    ["--stack-card-h" as string]: `${stackCardH}px`,
    ["--stack-peek-count" as string]: String(peekCount),
  } as React.CSSProperties;

  const header = (
    <div className="home-daily-header">
      <h2 className="home-daily-title">今日推荐</h2>
      {status === "ready" && items.length > 0 ? (
        <p className="home-daily-hint">左右滑动翻看3条文案</p>
      ) : null}
    </div>
  );

  if (status === "loading") {
    return (
      <div className="stack-section">
        {header}
        <p className="text-center text-[13px] text-ink-light py-8">正在加载语料库…</p>
      </div>
    );
  }

  if (status === "error" || !items.length) {
    return (
      <div className="stack-section">
        {header}
        <p className="text-center text-[13px] text-ink-light py-8">今日推荐暂不可用</p>
      </div>
    );
  }

  const renderCard = (
    item: DailyItem,
    {
      stackPos,
      isFront,
    }: {
      stackPos: number;
      isFront: boolean;
    },
  ) => {
    const isIncomingPrev = incomingPrevId === item.id;
    const hideDuringPrev =
      incomingPrevId !== null && stackPos > 0 && stackPos < stackOrder.length - 1;

    let layerClass = "stack-card-layer";
    if (isFront) {
      layerClass += " stack-card-layer--front";
      if (!isAnimating) {
        layerClass += " cursor-grab active:cursor-grabbing";
      }
    } else {
      layerClass += " stack-card-layer--back";
      if (isIncomingPrev) layerClass += " animate-stack-fly-in-left stack-card-layer--incoming";
      if (hideDuringPrev) layerClass += " stack-card-layer--hidden";
    }

    return (
      <div
        key={item.id}
        ref={isFront ? frontLayerRef : undefined}
        data-stack-id={item.id}
        data-stack-depth={stackPos}
        className={layerClass}
        style={{
          zIndex: isFront ? 6 : isIncomingPrev ? 5 : 4 - stackPos,
          pointerEvents: isFront && !isAnimating ? undefined : "none",
        }}
        onPointerDown={isFront && !isAnimating ? onPointerDown : undefined}
      >
        {renderQuoteCard(item)}
      </div>
    );
  };

  return (
    <div className="stack-section">
      {header}

      <div className="stack-deck">
        <div className="stack-deck-stage">
          <div className="stack-card-shell" ref={shellRef} style={shellStyle}>
            <div ref={measureRef} className="stack-measure" aria-hidden>
              {items.map((item) => (
                <div key={`measure-${item.id}`} className="stack-quote-card-wrap">
                  <MomentsQuoteItem
                    displayName={APP_DISPLAY_NAME}
                    text={item.text}
                    timestamp={item.postedAt}
                    stackFooter
                    className="stack-quote-card stack-measure-card"
                  />
                </div>
              ))}
            </div>

            {stackOrder.map((itemIndex, stackPos) => {
              const item = items[itemIndex];
              const showLayer =
                stackPos <= 2 || (incomingPrevId !== null && item.id === incomingPrevId);
              if (!showLayer) return null;
              return renderCard(item, {
                stackPos,
                isFront: stackPos === 0,
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
