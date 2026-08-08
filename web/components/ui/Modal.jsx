"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export default function Modal({ open, onOpenChange, cardClass = "", closeLabel = "Close", title, children }) {
  // Opacity-only fade for the overlay is already motion-safe; the card's
  // scale+y entrance is real movement, so that's what reduced-motion drops.
  const reduceMotion = useReducedMotion();
  const cardMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, scale: 0.97, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.97, y: 8 } };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div className="modal-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            className={`modal-card${cardClass ? ` ${cardClass}` : ""}`}
            {...cardMotion}
            transition={{ duration: 0.16 }}
          >
            <div className="dialog-head">
              <Dialog.Title asChild>
                <h2>{title}</h2>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="icon-button" type="button" aria-label={closeLabel}>
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>
            {children}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
