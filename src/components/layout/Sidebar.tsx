import {
  LayoutDashboard,
  FolderKanban,
  Users,
  UserCircle,
  HelpCircle,
  LogOut,
  PanelLeft,
  Search,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  active?: boolean;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/", active: true },
  { label: "My Project", icon: FolderKanban, href: "/projects" },
  { label: "My Team", icon: Users, href: "/team" },
  { label: "My Profile", icon: UserCircle, href: "/profile" },
];

const otherNav: NavItem[] = [
  { label: "Help", icon: HelpCircle, href: "/help" },
  { label: "Logout", icon: LogOut, href: "/logout" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <a
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center transition-colors duration-150",
        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-4 py-2",
        item.active
          ? "text-[#16A08F]"
          : "text-[#4A5255] hover:bg-gray-50"
      )}
      style={{
        fontSize: "11px",
        fontFamily: "Poppins, sans-serif",
        fontWeight: 500,
      }}
    >
      <item.icon
        size={16}
        strokeWidth={1.75}
        className={item.active ? "text-[#16A08F]" : "text-[#4A5255]"}
      />
      {!collapsed && item.label}
    </a>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className="shrink-0 border-r border-gray-100 bg-white flex flex-col py-3 gap-1 transition-all duration-200"
      style={{ width: collapsed ? "48px" : "176px" }}
    >
      <button
        aria-label="Toggle sidebar"
        onClick={onToggle}
        className={cn(
          "py-2 text-[#4A5255] hover:text-[#16A08F] w-full flex",
          collapsed ? "justify-center px-0" : "px-4"
        )}
      >
        <PanelLeft size={18} strokeWidth={1.5} />
      </button>

      {!collapsed ? (
        <div
          className="mx-3 mb-2 flex items-center gap-2 px-3 py-1.5 text-[#4A5255]"
          style={{
            backgroundColor: "#E2EAED",
            borderRadius: "6px",
            fontFamily: "Montserrat, sans-serif",
            fontSize: "11px",
          }}
        >
          <Search size={13} className="text-[#4A5255]" />
          Search
        </div>
      ) : (
        <div className="flex justify-center py-1 mb-1">
          <Search size={14} className="text-[#4A5255]" />
        </div>
      )}

      {!collapsed && (
        <p className="px-4 pt-1 pb-0.5" style={{ fontSize: "10px", color: "#A7A7A7", fontFamily: "Poppins, sans-serif", fontWeight: 500 }}>
          Main
        </p>
      )}
      {collapsed && <div className="border-t border-gray-100 my-1 mx-2" />}
      {mainNav.map((item) => (
        <NavLink key={item.href} item={item} collapsed={collapsed} />
      ))}

      {!collapsed && (
        <p className="px-4 pt-3 pb-0.5" style={{ fontSize: "10px", color: "#A7A7A7", fontFamily: "Poppins, sans-serif", fontWeight: 500 }}>
          Other
        </p>
      )}
      {collapsed && <div className="border-t border-gray-100 my-1 mx-2" />}
      {otherNav.map((item) => (
        <NavLink key={item.href} item={item} collapsed={collapsed} />
      ))}
    </aside>
  );
}