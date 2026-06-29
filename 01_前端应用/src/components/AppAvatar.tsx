const SIZE_CLASS = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-16 w-16",
  xl: "h-[72px] w-[72px]",
  cover: "h-[72px] w-[72px]",
} as const;

const RADIUS_CLASS = {
  sm: "rounded-[4px]",
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-xl",
  full: "rounded-full",
} as const;

interface AppAvatarProps {
  size?: keyof typeof SIZE_CLASS;
  radius?: keyof typeof RADIUS_CLASS;
  className?: string;
}

export default function AppAvatar({
  size = "sm",
  radius = size === "sm" ? "sm" : size === "cover" || size === "xl" ? "xl" : "lg",
  className = "",
}: AppAvatarProps) {
  return (
    <img
      src="/avatar.png"
      alt=""
      className={`shrink-0 bg-white object-contain object-center ${SIZE_CLASS[size]} ${RADIUS_CLASS[radius]} ${className}`}
    />
  );
}
