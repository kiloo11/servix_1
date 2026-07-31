"use client";

import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import Modal from "../ui/Modal";
import AppTooltip from "../ui/AppTooltip";
import { useLocale } from "../../context/LocaleContext";
import { useAssetActions } from "../../lib/assetActions";

// New — categories used to be a fixed 3-item const (infra/node/test); this is
// the add/edit form for the now-managed entity (the backend's /api/categories),
// modeled directly on ProviderFormModal.jsx.
export default function CategoryFormModal({ open, onOpenChange, category }) {
  const { t } = useLocale();
  const { saveCategory, deleteCategory } = useAssetActions();

  const [draft, setDraft] = useState(category);

  useEffect(() => {
    setDraft(category);
  }, [category, open]);

  if (!draft) return null;

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await saveCategory(draft);
    onOpenChange(false);
  }

  async function handleDelete() {
    const deleted = await deleteCategory(draft);
    if (deleted) onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} closeLabel={t("common.cancel")} title={draft.id ? t("categories.edit") : t("categories.new")}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid compact-grid">
          <label>
            {t("categories.name")}
            <input type="text" required value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label>
            {t("categories.color")}
            <div className="color-input-row">
              <input type="text" placeholder="#38bdf8" value={draft.color} onChange={(e) => set("color", e.target.value)} />
              <label className="color-swatch-button" style={{ background: draft.color }} aria-label={t("categories.color")}>
                <input type="color" value={draft.color} onChange={(e) => set("color", e.target.value)} />
              </label>
            </div>
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
