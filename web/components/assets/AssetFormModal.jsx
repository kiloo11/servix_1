"use client";

import { useEffect, useState } from "react";
import { Popover } from "radix-ui";
import { Save, Trash2 } from "lucide-react";
import Modal from "../ui/Modal";
import AppSelect from "../ui/AppSelect";
import AppSelectItem from "../ui/AppSelectItem";
import AppTooltip from "../ui/AppTooltip";
import { useLocale } from "../../context/LocaleContext";
import { useData } from "../../context/DataContext";
import { useAssetActions } from "../../lib/assetActions";
import { useGrouping } from "../../lib/grouping";
import { currencySymbol, useMoney } from "../../lib/money";
import { ASSET_TYPES, CURRENCIES } from "../../lib/assets";
import { countries, countryFlagUrl } from "../../lib/countries";

// Ported from the "asset" <Modal> block in App.vue's template (asset create/
// edit form, incl. the country popover picker) + saveAsset/deleteAsset.
export default function AssetFormModal({ open, onOpenChange, asset }) {
  const { t } = useLocale();
  const { providers, categories } = useData();
  const { saveAsset, deleteAsset } = useAssetActions();
  const { formatMoney, convertToEur } = useMoney();
  const { countryDisplayName } = useGrouping();

  const [draft, setDraft] = useState(asset);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  useEffect(() => {
    setDraft(asset);
    setCountrySearch("");
    setCountryOpen(false);
  }, [asset, open]);

  if (!draft) return null;

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await saveAsset(draft);
    onOpenChange(false);
  }

  async function handleDelete() {
    const deleted = await deleteAsset(draft);
    if (deleted) onOpenChange(false);
  }

  const filteredCountries = countries.filter((country) => {
    const label = country.code ? countryDisplayName(country.code) : t("common.countryEmpty");
    return [country.code, label].join(" ").toLowerCase().includes(countrySearch.trim().toLowerCase());
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} closeLabel={t("common.cancel")} title={draft.id ? t("assets.edit") : t("assets.new")}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid compact-grid">
          <fieldset className="type-toggle-group">
            <legend>{t("common.type")}</legend>
            {ASSET_TYPES.map((type) => (
              <label key={type} className={`type-toggle${draft.type === type ? " active" : ""}`}>
                <input type="radio" name="assetType" checked={draft.type === type} onChange={() => set("type", type)} />
                <span>{t(`type.${type}`)}</span>
              </label>
            ))}
          </fieldset>
          <label>
            {t("common.name")}
            <input type="text" required value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label>
            {t("common.provider")}
            <AppSelect value={draft.providerId} onChange={(v) => set("providerId", v)} aria-label={t("common.provider")}>
              <AppSelectItem value="">{t("common.providersEmpty")}</AppSelectItem>
              {providers.map((provider) => (
                <AppSelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </AppSelectItem>
              ))}
            </AppSelect>
          </label>
          <label>
            {t("common.category")}
            <AppSelect value={draft.category} onChange={(v) => set("category", v)} aria-label={t("common.category")}>
              <AppSelectItem value="">{t("assets.categoryEmpty")}</AppSelectItem>
              {categories.map((category) => (
                <AppSelectItem key={category.id} value={category.id}>
                  {category.name}
                </AppSelectItem>
              ))}
            </AppSelect>
          </label>
          {draft.type === "vps" ? (
            <>
              <label>
                IP
                <input type="text" value={draft.ip} onChange={(e) => set("ip", e.target.value)} />
              </label>
              <label>
                {t("common.country")}
                <Popover.Root open={countryOpen} onOpenChange={setCountryOpen}>
                  <Popover.Trigger asChild>
                    <button className="search-select-button" type="button">
                      <span className="country-option">
                        {draft.countryCode ? <img className="flag-icon" src={countryFlagUrl(draft.countryCode)} alt="" /> : null}
                        {draft.countryCode ? countryDisplayName(draft.countryCode) : t("common.countryEmpty")}
                      </span>
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className="search-select-panel" sideOffset={6} align="start">
                      <input
                        type="search"
                        placeholder={t("common.searchCountry")}
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && setCountryOpen(false)}
                      />
                      <div className="search-select-options">
                        {filteredCountries.map((country) => (
                          <button
                            key={country.code || "empty"}
                            type="button"
                            className={`country-option${draft.countryCode === country.code ? " active" : ""}`}
                            onClick={() => {
                              set("countryCode", country.code);
                              setCountrySearch("");
                              setCountryOpen(false);
                            }}
                          >
                            {country.code ? <img className="flag-icon" src={countryFlagUrl(country.code)} alt="" /> : null}
                            {country.code ? countryDisplayName(country.code) : t("common.countryEmpty")}
                          </button>
                        ))}
                        {!filteredCountries.length ? <div className="inline-empty">{t("common.noCountries")}</div> : null}
                      </div>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </label>
            </>
          ) : (
            <label>
              {t("common.domain")}
              <input type="text" value={draft.domain} onChange={(e) => set("domain", e.target.value)} />
            </label>
          )}
          <label>
            {t("common.expiresAt")}
            <input className="datetime-input" type="datetime-local" step="60" value={draft.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
          </label>
          <label>
            {t("common.price")}
            <input type="number" min="0" step="0.000001" placeholder="0.00" value={draft.price} onChange={(e) => set("price", e.target.value === "" ? "" : Number(e.target.value))} />
          </label>
          <label>
            {t("common.currency")}
            <AppSelect value={draft.priceCurrency} onChange={(v) => set("priceCurrency", v)} aria-label={t("common.currency")}>
              {CURRENCIES.map((currency) => (
                <AppSelectItem key={currency} value={currency}>
                  {currencySymbol(currency)}
                </AppSelectItem>
              ))}
            </AppSelect>
          </label>
        </div>
        {draft.price && draft.priceCurrency !== "EUR" ? <p className="hint">≈ {formatMoney(convertToEur(draft.price, draft.priceCurrency), "EUR")}</p> : null}
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
