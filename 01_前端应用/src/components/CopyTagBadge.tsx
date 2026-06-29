interface CopyTagBadgeProps {
  tagLabel?: string;
  matchPercent?: number;
  className?: string;
}

export default function CopyTagBadge({
  tagLabel,
  matchPercent,
  className = "",
}: CopyTagBadgeProps) {
  if (!tagLabel && matchPercent == null) return null;

  return (
    <div className={`copy-meta-row ${className}`.trim()}>
      {tagLabel ? <span className="copy-tag-badge">{tagLabel}</span> : null}
      {matchPercent != null ? (
        <span className="copy-match-badge">匹配 {matchPercent}%</span>
      ) : null}
    </div>
  );
}
