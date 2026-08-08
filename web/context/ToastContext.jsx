"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Toast } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { makeId } from "../lib/ids";

const ToastContext = createContext(null);

// Radix's Toast.Root owns the auto-dismiss timer, swipe-to-dismiss gesture,
// and the role="status"/aria-live announcement this never had before —
// forceMount keeps the child in the DOM while AnimatePresence plays the
// exit transition; Radix would otherwise unmount it the instant it closes.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const reduceMotion = useReducedMotion();

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message) => {
    setToasts((current) => [...current, { id: makeId(), message }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  // Drop the slide+scale entrance to an opacity-only fade under
  // prefers-reduced-motion — same split as Modal.jsx.
  const toastMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, scale: 0.96 } };

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right" duration={4000}>
        {children}
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <Toast.Root key={item.id} asChild forceMount onOpenChange={(open) => !open && removeToast(item.id)}>
              <motion.div className="toast glass-floating" {...toastMotion} transition={{ duration: 0.18 }}>
                <Toast.Close asChild>
                  <button type="button" className="toast-close">
                    <Toast.Description asChild>
                      <span>{item.message}</span>
                    </Toast.Description>
                  </button>
                </Toast.Close>
              </motion.div>
            </Toast.Root>
          ))}
        </AnimatePresence>
        <Toast.Viewport className="toast-stack" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
