import type { ReactNode } from "react";
import BottomNav from "./BottomNav";

interface PageShellProps {
  children: ReactNode;
  showNav?: boolean;
  className?: string;
  bare?: boolean;
}

export default function PageShell({
  children,
  showNav = true,
  className = "",
  bare = false,
}: PageShellProps) {
  const mainClass = bare ? "page-shell-main--bare" : "page-shell-main--standard";

  return (
    <div className={`page-shell ${className}`.trim()}>
      <main className={`page-shell-main hide-scrollbar ${mainClass}`}>{children}</main>
      {showNav && (
        <div className="page-shell-nav">
          <BottomNav />
        </div>
      )}
    </div>
  );
}
