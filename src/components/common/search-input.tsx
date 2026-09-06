"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  label = "Search",
  className,
}: SearchInputProps) {
  const [focused, setFocused] = useState(false);
  const expands = !className?.includes("!w-");
  return (
    <div
      className={cn(
        "relative flex items-center transition-all duration-500",
        expands ? (focused ? "w-64" : "w-48") : "w-full",
        className
      )}
    >
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <Search
          className={cn("w-4 h-4 transition-colors", focused ? "text-ember-600 dark:text-ember-400" : "text-muted-foreground")}
        />
      </div>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full h-11 pl-10 pr-4 bg-card backdrop-blur-xl border border-border rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-sm placeholder:text-muted-foreground font-mono"
      />
    </div>
  );
}
