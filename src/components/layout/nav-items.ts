import {
  Activity,
  CreditCard,
  GitFork,
  Key,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Mic,
  Phone,
  PhoneCall,
  Settings,
  User,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const startsWith = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Build",
    items: [
      { label: "Agents", href: "/agents", icon: Activity, match: startsWith("/agents") },
      { label: "Library", href: "/library", icon: LayoutTemplate, match: startsWith("/library") },
      { label: "Graphs", href: "/graphs", icon: GitFork, match: startsWith("/graphs") },
      { label: "Workflows", href: "/workflows", icon: Workflow, match: startsWith("/workflows") },
      { label: "Studio", href: "/playground", icon: Mic, match: startsWith("/playground") },
    ],
  },
  {
    label: "Operate",
    items: [
      { label: "Call History", href: "/calls", icon: PhoneCall, match: startsWith("/calls") },
      { label: "Campaigns", href: "/batches", icon: Layers, match: startsWith("/batches") },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Numbers", href: "/settings?tab=numbers", icon: Phone },
      { label: "Team", href: "/settings?tab=team", icon: User },
      { label: "Billing", href: "/settings?tab=billing", icon: CreditCard },
      { label: "API Keys", href: "/settings?tab=keys", icon: Key },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const FLAT_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href;
}
