import { useNavigate } from "react-router-dom";
import AppAvatar from "./AppAvatar";
import HomeHero, { COVER_AVATAR_SIZE } from "./HomeHero";

export const COVER_AVATAR_OVERLAP = COVER_AVATAR_SIZE / 2;
const COVER_AVATAR_RIGHT = 16;
const NICKNAME_AVATAR_GAP = 24;

interface HomeMomentsHeaderProps {
  displayName: string;
}

export default function HomeMomentsHeader({ displayName }: HomeMomentsHeaderProps) {
  const navigate = useNavigate();
  const nicknameRight = COVER_AVATAR_RIGHT + COVER_AVATAR_SIZE + NICKNAME_AVATAR_GAP;

  return (
    <div className="home-moments-header relative shrink-0">
      <div className="home-moments-cover">
        <HomeHero />

        <p
          className="absolute bottom-3 z-20 max-w-[42%] truncate text-[15px] font-semibold tracking-wide text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
          style={{ right: nicknameRight }}
        >
          {displayName}
        </p>
      </div>

      <div
        className="relative"
        style={{ height: COVER_AVATAR_OVERLAP + 8 }}
      >
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="absolute z-40 overflow-hidden rounded-[14px] border-[3px] border-white bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.97]"
          style={{ top: -COVER_AVATAR_OVERLAP, right: COVER_AVATAR_RIGHT }}
          aria-label="个人主页"
        >
          <AppAvatar size="cover" radius="xl" />
        </button>
      </div>
    </div>
  );
}
