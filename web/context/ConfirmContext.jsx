"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import { useLocale } from "./LocaleContext";

const ConfirmContext = createContext(null);

// Ported from App.vue's confirmAction()/resolveConfirm() — a promise-based
// confirm dialog replacing window.confirm, backed by the shared Modal.
export function ConfirmProvider({ children }) {
  const { t } = useLocale();
  const [dialog, setDialog] = useState({ open: false, message: "" });
  const resolveRef = useRef(null);

  const confirmAction = useCallback((message) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ open: true, message });
    });
  }, []);

  const resolveConfirm = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialog({ open: false, message: "" });
  }, []);

  const value = useMemo(() => ({ confirmAction }), [confirmAction]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={dialog.open}
        onOpenChange={(open) => !open && resolveConfirm(false)}
        cardClass="confirm-card"
        closeLabel={t("common.cancel")}
        title={t("common.confirmTitle")}
      >
        <div className="confirm-body">
          <p className="confirm-message">{dialog.message}</p>
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={() => resolveConfirm(false)}>
              {t("common.cancel")}
            </button>
            <button className="danger-button" type="button" onClick={() => resolveConfirm(true)}>
              {t("common.confirmYes")}
            </button>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirmAction;
}
