"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import Modal from "../ui/Modal";
import AppSelect from "../ui/AppSelect";
import AppSelectItem from "../ui/AppSelectItem";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useAssetActions } from "../../lib/assetActions";
import { useFormat } from "../../lib/format";
import { currencySymbol, useMoney } from "../../lib/money";
import { CURRENCIES } from "../../lib/assets";
import { toLocalInput } from "../../lib/dates";

const PAGE_SIZE = 5;

export default function PaymentsModal({ open, onOpenChange, asset }) {
  const { t, tc } = useLocale();
  const { meta } = useAuth();
  const { formatDateTime } = useFormat();
  const { formatMoney } = useMoney();
  const { addQuickPayment, deletePayment } = useAssetActions();

  const [page, setPage] = useState(1);
  const [quickPayment, setQuickPayment] = useState({ amount: "", currency: "USDT", paidAt: "" });

  useEffect(() => {
    if (!open || !asset) return;
    setPage(1);
    setQuickPayment({ amount: "", currency: meta.currency || "USDT", paidAt: toLocalInput(new Date()) });
  }, [open, asset, meta.currency]);

  const sortedPayments = useMemo(() => {
    if (!asset) return [];
    return [...(asset.payments || [])].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
  }, [asset]);

  const totalPages = Math.max(1, Math.ceil(sortedPayments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sortedPayments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (!asset) return null;

  async function handleAdd() {
    await addQuickPayment(asset, quickPayment);
    setQuickPayment((current) => ({ amount: "", currency: current.currency, paidAt: toLocalInput(new Date()) }));
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} closeLabel={t("common.cancel")} title={t("payments.title", { name: asset?.name || "" })}>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="quick-payment">
          <label>
            {t("common.price")}
            <input
              type="number"
              min="0"
              step="0.000001"
              placeholder="0.00"
              value={quickPayment.amount}
              onChange={(e) => setQuickPayment((c) => ({ ...c, amount: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
          </label>
          <label>
            {t("common.currency")}
            <AppSelect value={quickPayment.currency} onChange={(v) => setQuickPayment((c) => ({ ...c, currency: v }))} aria-label={t("common.currency")}>
              {CURRENCIES.map((currency) => (
                <AppSelectItem key={currency} value={currency}>
                  {currencySymbol(currency)}
                </AppSelectItem>
              ))}
            </AppSelect>
          </label>
          <label>
            {t("common.dateTime")}
            <input className="datetime-input" type="datetime-local" step="60" value={quickPayment.paidAt} onChange={(e) => setQuickPayment((c) => ({ ...c, paidAt: e.target.value }))} />
          </label>
          <button className="primary-button quick-add-button" type="button" aria-label={t("common.addPayment")} onClick={handleAdd}>
            <Plus size={18} />
          </button>
        </div>
        <div className="payments-list">
          {paginated.map((payment) => (
            <article key={payment.id} className="payment-item">
              <div>
                <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                <span>
                  {formatDateTime(payment.paidAt)}
                  {payment.note ? ` · ${payment.note}` : ""}
                </span>
              </div>
              <button className="icon-button" type="button" onClick={() => deletePayment(asset, payment.id)}>
                <Trash2 size={18} />
              </button>
            </article>
          ))}
          {!sortedPayments.length ? <div className="inline-empty">{t("payments.empty")}</div> : null}
        </div>
        {totalPages > 1 ? (
          <div className="table-footer compact-footer">
            <span>{t("stats.shownOf", { shown: paginated.length, total: tc("payment", sortedPayments.length) })}</span>
            <div className="pagination">
              <button className="secondary-button icon-only" type="button" onClick={() => setPage((p) => p - 1)} disabled={currentPage <= 1} aria-label={t("stats.prevPage")}>
                <ChevronLeft size={16} />
              </button>
              <strong>
                {currentPage} / {totalPages}
              </strong>
              <button className="secondary-button icon-only" type="button" onClick={() => setPage((p) => p + 1)} disabled={currentPage >= totalPages} aria-label={t("stats.nextPage")}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
