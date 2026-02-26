// src/pages/Receipt.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

import { listBranches, listMedicines } from "../services/inventoryService";
import { getSale, listSaleItems } from "../services/posService";

const easeOut = [0.16, 1, 0.3, 1];

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function peso(n) {
  return `₱${asNumber(n, 0).toFixed(2)}`;
}

function fmtDate(ts) {
  if (!ts) return "—";
  try {
    const d = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(ts);
  }
}

export default function Receipt() {
  const navigate = useNavigate();
  const { saleId } = useParams();
  const reduce = useReducedMotion();

  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [meds, setMeds] = useState([]);
  const medsById = useMemo(() => {
    const map = {};
    for (const mm of meds) map[mm.id] = mm;
    return map;
  }, [meds]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [b, m] = await Promise.all([listBranches(), listMedicines()]);
        setBranches(b);
        setMeds(m);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (!saleId) return;
    (async () => {
      try {
        setBusy(true);
        const s = await getSale(saleId);
        if (!s) {
          setMsg("Sale not found.");
          return;
        }
        setSale(s);
        const lines = await listSaleItems(saleId);
        setItems(lines || []);
      } catch (e) {
        setMsg(e?.message || "Failed to load receipt");
      } finally {
        setBusy(false);
      }
    })();
  }, [saleId]);

  const branchName = useMemo(() => {
    const bid = String(sale?.branchId || "").trim();
    return branches.find((b) => b.id === bid)?.name || bid || "—";
  }, [branches, sale?.branchId]);

  const computedTotal = useMemo(() => {
    return (items || []).reduce((s, it) => s + asNumber(it.lineTotal, asNumber(it.unitPrice, 0) * asNumber(it.qty, 0)), 0);
  }, [items]);

  return (
    <div className="pPage receiptPage">
      <style>{css}</style>

      <motion.div
        className="pShell"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={reduce ? false : { opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.35, ease: easeOut }}
      >
        <div className="pHeader">
          <div className="pHeaderLeft">
            <button className="btn btnGhost" onClick={() => navigate(-1)} disabled={busy}>
              ← Back
            </button>
            <div className="pHeaderText">
              <div className="pTitle">Receipt</div>
              <div className="pSubtitle">Sale ID: <span className="mono">{saleId}</span></div>
            </div>
          </div>
          <div className="pHeaderRight">
            <button className="btn" onClick={() => window.print()} disabled={busy || !sale}>
              Print
            </button>
          </div>
        </div>

        {msg ? <div className="toast bad">{msg}</div> : null}

        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Sale Summary</div>
              <div className="cardHint">{busy ? "Loading…" : "Paid"}</div>
            </div>
          </div>

          {!sale ? (
            <div className="empty">{busy ? "Loading sale…" : "No sale loaded."}</div>
          ) : (
            <div className="body">
              <div className="rows">
                <Row k="Branch" v={branchName} />
                <Row k="Created" v={fmtDate(sale.createdAt)} />
                <Row k="Payment" v={String(sale.paymentMethod || "—").toUpperCase()} />
                {sale.reservationId ? <Row k="Reservation" v={<span className="mono">{sale.reservationId}</span>} /> : null}
                {sale.customerName ? <Row k="Customer" v={sale.customerName} /> : null}
                {sale.customerPhone ? <Row k="Phone" v={sale.customerPhone} /> : null}
              </div>

              <div className="divider" />

              <div className="sectionTitle">Items</div>

              {items.length === 0 ? (
                <div className="empty">No items</div>
              ) : (
                <div className="items">
                  {items.map((it) => {
                    const niceName =
                      (it.medicineName || "").trim() ||
                      medsById[it.medicineId]?.name ||
                      medsById[it.medicineId]?.genericName ||
                      it.medicineId;
                    const qty = asNumber(it.qty, 0);
                    const unit = asNumber(it.unitPrice, 0);
                    const line = asNumber(it.lineTotal, unit * qty);
                    return (
                      <div key={it.id} className="itemRow">
                        <div className="itemLeft">
                          <div className="name">{niceName}</div>
                          <div className="sub">
                            x{qty} • {peso(unit)}
                          </div>
                        </div>
                        <div className="itemRight">{peso(line)}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="divider" />

              <div className="totalBox">
                <div className="totalRow">
                  <span className="k">Total</span>
                  <span className="v">{peso(sale.total ?? computedTotal)}</span>
                </div>
                {sale.paymentMethod === "cash" ? (
                  <>
                    <div className="totalRow">
                      <span className="k">Cash Received</span>
                      <span className="v">{peso(sale.cashReceived)}</span>
                    </div>
                    <div className="totalRow">
                      <span className="k">Change</span>
                      <span className="v">{peso(sale.cashChange)}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="row">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

const css = `
.receiptPage{
  --ink:#0f172a;
  --muted2:#475569;
  --surface: rgba(255,255,255,.86);
  --stroke:#e2e8f0;
  --stroke2:#cbd5e1;
  --primary:#2563eb;
  --bad:#dc2626;
  --bad-bg: rgba(220,38,38,.12);
  --radius: 18px;
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}
[data-theme="dark"] .receiptPage{
  --ink:#e5e7eb;
  --muted2:#cbd5e1;
  --surface: rgba(15,23,42,.78);
  --stroke:#1f2937;
  --stroke2:#334155;
  --primary:#3b82f6;
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

.pPage{ min-height: 100vh; width: 100%; padding: 24px; padding-top: 28px; display:flex; justify-content:center; color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
.pShell{ width: min(920px, 100%); display:grid; gap: 16px; }
.pHeader{ display:flex; justify-content:space-between; align-items:flex-start; gap: 12px; flex-wrap:wrap; padding-bottom: 10px; border-bottom: 1px solid rgba(226,232,240,.85); }
[data-theme="dark"] .pHeader{ border-bottom-color: rgba(51,65,85,.75); }
.pHeaderLeft{ display:flex; gap: 12px; align-items:flex-start; }
.pTitle{ font-size: 26px; font-weight: 950; letter-spacing: -0.3px; }
.pSubtitle{ font-size: 13px; font-weight: 850; color: var(--muted2); margin-top: 4px; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

.btn{ height: 44px; padding: 0 14px; border-radius: 14px; font-weight: 950; cursor:pointer; border: 1px solid var(--stroke); background-color: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
.btnGhost{ background-color: var(--surface); }
.btn:disabled{ opacity:.7; cursor:not-allowed; }

.card{ border: 1px solid var(--stroke); border-radius: var(--radius); background-color: var(--surface); box-shadow: var(--shadow-sm); overflow:hidden; }
.cardHead{ padding: 14px 14px 10px; border-bottom: 1px solid rgba(226,232,240,.75); }
[data-theme="dark"] .cardHead{ border-bottom-color: rgba(51,65,85,.6); }
.cardTitle{ font-weight: 950; font-size: 14px; }
.cardHint{ font-weight: 800; font-size: 12px; color: var(--muted2); margin-top: 2px; }

.body{ padding: 14px; }
.rows{ display:grid; gap: 8px; }
.row{ display:flex; justify-content:space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--stroke); border-radius: 14px; background-color: rgba(148,163,184,.08); }
.row .k{ font-weight: 950; color: var(--muted2); }
.row .v{ font-weight: 950; }

.divider{ height: 1px; background-color: var(--stroke); margin: 14px 0; }
.sectionTitle{ font-weight: 950; margin-bottom: 10px; }

.items{ display:grid; gap: 10px; }
.itemRow{ display:flex; justify-content:space-between; gap: 12px; padding: 12px; border: 1px solid var(--stroke); border-radius: 16px; background-color: rgba(255,255,255,.65); }
[data-theme="dark"] .itemRow{ background-color: rgba(15,23,42,.55); }
.itemLeft .name{ font-weight: 950; }
.itemLeft .sub{ font-size: 12px; font-weight: 800; color: var(--muted2); margin-top: 2px; }
.itemRight{ font-weight: 950; }

.totalBox{ border: 1px solid var(--stroke); border-radius: 16px; background-color: rgba(148,163,184,.10); padding: 12px; display:grid; gap: 8px; }
.totalRow{ display:flex; justify-content:space-between; gap: 10px; }
.totalRow .k{ font-weight: 950; color: var(--muted2); }
.totalRow .v{ font-weight: 950; }

.toast{ padding: 12px 14px; border-radius: 16px; font-weight: 950; border: 1px solid var(--stroke); }
.toast.bad{ background-color: var(--bad-bg); border-color: rgba(220,38,38,.25); color: var(--bad); }
.empty{ padding: 18px 14px; font-weight: 900; color: var(--muted2); text-align:center; }

@media print{
  .pHeaderRight{ display:none; }
  .btn{ display:none; }
  body::before, body::after{ display:none !important; }
}
`;
