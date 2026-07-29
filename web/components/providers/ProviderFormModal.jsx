"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import Modal from "../ui/Modal";
import AppTooltip from "../ui/AppTooltip";
import { useLocale } from "../../context/LocaleContext";
import { useAssetActions } from "../../lib/assetActions";

// Ported from the "provider" <Modal> block in App.vue's template +
// saveProvider/deleteProvider/autosizeTextarea.
export default function ProviderFormModal({ open, onOpenChange, provider }) {
  const { t } = useLocale();
  const { saveProvider, deleteProvider } = useAssetActions();
  const noteRef = useRef(null);

  const [draft, setDraft] = useState(provider);

  useEffect(() => {
    setDraft(provider);
  }, [provider, open]);

  useEffect(() => {
    if (open && noteRef.current) autosizeTextarea(noteRef.current);
  }, [open, draft?.note]);

  if (!draft) return null;

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function autosizeTextarea(field) {
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await saveProvider(draft);
    onOpenChange(false);
  }

  async function handleDelete() {
    const deleted = await deleteProvider(draft);
    if (deleted) onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} closeLabel={t("common.cancel")} title={draft.id ? t("providers.edit") : t("providers.new")}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid compact-grid">
          <label>
            {t("common.name")}
            <input type="text" required value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label>
            {t("providers.loginUrl")}
            <input type="url" placeholder="https://example.com/login" value={draft.loginUrl} onChange={(e) => set("loginUrl", e.target.value)} />
          </label>
          <label>
            {t("providers.faviconUrl")}
            <input type="url" placeholder="https://example.com" value={draft.faviconUrl} onChange={(e) => set("faviconUrl", e.target.value)} />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            {t("providers.note")}
            <textarea
              ref={noteRef}
              className="autosize-textarea"
              rows={1}
              placeholder={t("providers.notePlaceholder")}
              value={draft.note}
              onChange={(e) => {
                set("note", e.target.value);
                autosizeTextarea(e.target);
              }}
            />
          </label>
        </div>
        <div className={`dialog-actions${draft.id ? " has-danger" : ""}`}>
          {draft.id ? (
            <AppTooltip label={t("common.delete")}>
              <button className="danger-button icon-only" type="button" onClick={handleDelete} aria-label={t("common.delete")}>
                <Trash2 size={18} />
              </button>
            </AppTooltip>
          ) : null}
          <span />
          <button className="secondary-button" type="button" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </button>
          <button className="primary-button" type="submit">
            <Save size={18} />
            {t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
