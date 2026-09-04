"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { motion } from "framer-motion";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) {
    return (
      <div className="w-[104px] h-10 rounded-xl bg-muted/50 border border-border animate-pulse" />
    );
  }

  const options = [
    { id: "light", icon: Sun, label: "Light Mode" },
    { id: "system", icon: Monitor, label: "System Default" },
    { id: "dark", icon: Moon, label: "Dark Mode" },
  ];

  return (
    <div className="flex items-center p-1 gap-1 rounded-xl bg-muted/50 border border-border shadow-inner">
      {options.map((opt) => {
        const isActive = theme === opt.id;
        const Icon = opt.icon;
        
        return (
          <button
            key={opt.id}
            onClick={() => setTheme(opt.id)}
            aria-label={opt.label}
            className={cn(
              "relative p-2 rounded-lg flex items-center justify-center transition-colors z-10",
              isActive ? "text-ember-600 dark:text-ember-300" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="theme-active-indicator"
                className="absolute inset-0 bg-card rounded-lg shadow-sm border border-border -z-10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
