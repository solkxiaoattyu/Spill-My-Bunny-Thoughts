import { NavLink } from "react-router-dom";
import { Home, UserRound } from "lucide-react";

const tabs = [
  { to: "/home", label: "首页", icon: Home },
  { to: "/profile", label: "个人主页", icon: UserRound },
];

export default function BottomNav() {
  return (
    <nav className="float-nav shrink-0">
      <div className="float-nav-inner">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="float-nav-item">
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.3 : 1.8}
                  className={isActive ? "text-[#111]" : "text-[#bbb]"}
                />
                <span className={isActive ? "float-nav-label is-active" : "float-nav-label"}>
                  {label}
                </span>
                {isActive && <span className="float-nav-dot" aria-hidden />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
