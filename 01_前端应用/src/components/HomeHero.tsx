import { asset } from "../utils/asset";

export const COVER_AVATAR_SIZE = 72;

export default function HomeHero() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <img
        src={asset("/hero-cover.jpg")}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_64%]"
      />
    </div>
  );
}
