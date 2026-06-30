import { asset } from "../utils/asset";

interface MomentsNotificationPillProps {
  count: number;
  onClick?: () => void;
}

export default function MomentsNotificationPill({
  count,
  onClick,
}: MomentsNotificationPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="moments-notice-pill"
      aria-label={`${count} notifications`}
    >
      <img src={asset("/moments-preview/01.jpg")} alt="" className="moments-notice-pill-thumb" />
      <span>{count} notifications</span>
    </button>
  );
}
