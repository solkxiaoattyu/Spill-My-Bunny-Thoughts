import CopyTagBadge from "./CopyTagBadge";
import MomentsQuoteItem from "./MomentsQuoteItem";
import { APP_DISPLAY_NAME } from "../data/brand";
import { useCopyMeta } from "../hooks/useCopyMeta";

interface MatchCopyCardProps {
  text: string;
  className?: string;
  matchPercent?: number;
  tagLabel?: string;
  index?: number;
}

function matchedPostedAt(index: number): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12 + index,
    30 + index * 8,
  );
}

/** 与随机抽取一致：标签 + 朋友圈纯文案（头像 / 昵称 / 正文 / 时间 / 操作） */
export default function MatchCopyCard({
  text,
  className = "",
  matchPercent,
  tagLabel: tagLabelProp,
  index = 0,
}: MatchCopyCardProps) {
  const { tagLabel } = useCopyMeta(text, tagLabelProp);

  return (
    <div className={className}>
      <CopyTagBadge tagLabel={tagLabel} matchPercent={matchPercent} className="mb-2 px-1" />
      <MomentsQuoteItem
        displayName={APP_DISPLAY_NAME}
        text={text}
        timestamp={matchedPostedAt(index)}
        card={false}
      />
    </div>
  );
}
