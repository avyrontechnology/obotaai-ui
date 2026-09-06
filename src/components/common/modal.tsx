"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

/**
 * Overlays must escape the app-shell content wrapper (`relative z-10` in
 * app-shell.tsx), which otherwise traps even `fixed z-50` panels below the
 * TopBar (`relative z-30`) — the drawer header/close button end up hidden
 * behind it. Portaling to body puts them in the root stacking context.
 * Rendered only after mount so SSR/hydration trees match (both null).
 */
function OverlayPortal({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      aria-hidden="true"
    />
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  label: string;
  title?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, label, title, header, children, className }: ModalProps) {
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <OverlayPortal>
      <AnimatePresence>
        {open && (
          <>
            <Backdrop onClose={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className={cn(
                "pointer-events-auto w-full max-w-2xl max-h-[90dvh] overflow-y-auto custom-scrollbar bg-card border border-border rounded-[2rem] shadow-2xl p-6",
                className
              )}
              role="dialog"
              aria-modal="true"
              aria-label={label}
            >
              {header ?? (
                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-semibold text-foreground">{title}</div>
                  <button
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              {children}
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  label: string;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

export function Drawer({ open, onClose, label, title, children, wide }: DrawerProps) {
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <OverlayPortal>
      <AnimatePresence>
        {open && (
          <>
            <Backdrop onClose={onClose} />
            <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 z-50 w-full bg-card border-l border-border shadow-2xl flex flex-col",
              wide ? "max-w-lg" : "max-w-md"
            )}
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="text-lg font-semibold text-foreground">{title}</div>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">{children}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
