import {
  Activity,
  CreditCard,
  Database,
  Key,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  Phone,
  PhoneCall,
  Plug,
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
      { label: "OboFleet", href: "/agents", icon: Activity, match: startsWith("/agents") },
      { label: "Knowledge Base", href: "/library", icon: Database, match: startsWith("/library") },
      {
        label: "Flows",
        href: "/flows",
        icon: Workflow,
        match: (pathname: string) =>
          pathname === "/flows" ||
          pathname.startsWith("/flows/") ||
          pathname.startsWith("/graphs") ||
          pathname.startsWith("/workflows"),
      },
      { label: "Playground", href: "/playground", icon: MessagesSquare, match: startsWith("/playground") },
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
      { label: "Numbers", href: "/numbers", icon: Phone },
      { label: "Team", href: "/team", icon: User },
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "API Keys", href: "/api-keys", icon: Key },
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const FLAT_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href;
}
