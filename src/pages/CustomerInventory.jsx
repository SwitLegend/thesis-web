// src/pages/CustomerInventory.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  listBranches,
  listMedicines,
  findBranchesWithStock,
} from "../services/inventoryService";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const tapSpring = { type: "spring", stiffness: 520, damping: 32 };
const easeOut = [0.16, 1, 0.3, 1];

export default function CustomerInventory() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const reduce = useReducedMotion();

  // ✅ Back button visible only for Admin/Pharmacist/Customer
  const role = String(profile?.role || "").toLowerCase();
  const canBack = role === "admin" || role === "pharmacist" || role === "customer";

  const [branches, setBranches] = useState([]);
  const [meds, setMeds] = useState([]);

  const [q, setQ] = useState("");
  const [selectedMed, setSelectedMed] = useState(null);

  const [stockRows, setStockRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // ✅ selected branch for embedded map
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  const branchesById = useMemo(() => {
    const map = {};
    for (const b of branches) map[b.id] = b;
    return map;
  }, [branches]);

  useEffect(() => {
    (async () => {
      try {
        setBusy(true);
        setMsg("");
        const [b, m] = await Promise.all([listBranches(), listMedicines()]);
        setBranches(b);
        setMeds(m);
      } catch (e) {
        setMsg(e?.message || "Failed to load data");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return meds;

    return meds.filter((m) => {
      const hay = `${m.name || ""} ${m.genericName || ""} ${m.form || ""} ${m.strength || ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [meds, q]);

  async function openMedicine(m) {
    setSelectedMed(m);
    setStockRows([]);
    setSelectedBranchId(null);
    setMsg("");

    try {
      setBusy(true);
      const rows = await findBranchesWithStock(m.id);
      setStockRows(rows);
      if (!rows.length) setMsg("No branches currently have stock for this item.");
    } catch (e) {
      setMsg(e?.message || "Failed to load branch stock");
    } finally {
      setBusy(false);
    }
  }

  const selectedName =
    selectedMed?.name || selectedMed?.genericName || (selectedMed ? "Medicine" : "");

  // Map helpers
  const selectedBranch = selectedBranchId ? branchesById[selectedBranchId] : null;
  const selectedBranchAddress = selectedBranch?.address || "";

  const mapSrc = selectedBranchAddress
    ? `https://www.google.com/maps?q=${encodeURIComponent(selectedBranchAddress)}&output=embed`
    : "";

  const isBadMsg = /fail|error|denied|invalid/i.test(String(msg || ""));

  return (
    <div className="ciPage customerInv">
      <style>{css}</style>

      <motion.div
        className="ciShell"
        initial={{ opacity: 0, y: reduce ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.22, ease: easeOut }}
      >
        {/* Header */}
        <div className="ciTopbar">
          <div className="ciLeftTop">
            {canBack ? (
              <motion.button
                className="ciBtnGhost"
                onClick={() => navigate(-1)}
                whileHover={busy || reduce ? undefined : { scale: 1.03 }}
                whileTap={busy || reduce ? undefined : { scale: 0.96 }}
                transition={reduce ? { duration: 0 } : tapSpring}
                type="button"
                disabled={busy}
              >
                ← Back
              </motion.button>
            ) : null}

            <div className="ciTopText">
              <div className="ciTitle">Stock Lookup</div>
              <div className="ciSub">
                Search a medicine to see which branches have stock (read-only)
              </div>
            </div>
          </div>

          <div className="ciPills">
            <div className="ciPill">
              Branches: <b>{branches.length}</b>
            </div>
            <div className="ciPill">
              Medicines: <b>{meds.length}</b>
            </div>
          </div>
        </div>

        <div className="ciGrid">
          {/* LEFT */}
          <div className="ciCard">
            <div className="ciCardHead">
              <div>
                <div className="ciCardTitle">Medicines</div>
                <div className="ciCardHint">
                  Type to search, then tap a medicine to view stock
                </div>
              </div>

              {busy ? <span className="ciChip">Loading…</span> : null}
            </div>

            <div className="ciSearchWrap">
              <input
                className="ciControl"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name / generic / form / strength…"
              />
              {q ? (
                <button
                  className="ciClearBtn"
                  onClick={() => setQ("")}
                  title="Clear"
                  type="button"
                >
                  ✕
                </button>
              ) : null}
            </div>

            <div className="ciList">
              {filtered.slice(0, 60).map((m) => (
                <motion.button
                  key={m.id}
                  className={selectedMed?.id === m.id ? "ciMedBtn active" : "ciMedBtn"}
                  onClick={() => openMedicine(m)}
                  whileHover={busy || reduce ? undefined : { scale: 1.01 }}
                  whileTap={busy || reduce ? undefined : { scale: 0.98 }}
                  transition={reduce ? { duration: 0 } : tapSpring}
                  type="button"
                  disabled={busy}
                >
                  <div className="ciMedRowTop">
                    <div className="ciMedName">{m.name || m.genericName || "Medicine"}</div>
                    <div className="ciPriceChip">₱{Number(m.price || 0).toFixed(2)}</div>
                  </div>

                  <div className="ciMedSub">
                    {(m.genericName || "—") +
                      " • " +
                      [m.form, m.strength].filter(Boolean).join(" / ")}
                  </div>
                </motion.button>
              ))}

              {!busy && !filtered.length ? <div className="ciEmpty">No medicines found.</div> : null}
            </div>
          </div>

          {/* RIGHT */}
          <div className="ciCard">
            <div className="ciCardHead">
              <div style={{ minWidth: 0 }}>
                <div className="ciCardTitle">Branch Stock</div>
                <div className="ciCardHint">
                  {selectedMed ? (
                    <>
                      Showing: <b className="ciEllipsis">{selectedName}</b>
                    </>
                  ) : (
                    "Select a medicine from the left"
                  )}
                </div>
              </div>

              <div className="ciPill">
                Results: <b>{stockRows.length}</b>
              </div>
            </div>

            <AnimatePresence>
              {msg ? (
                <motion.div
                  key={msg}
                  className={isBadMsg ? "ciToast bad" : "ciToast"}
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduce ? 0 : 8 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
                >
                  {msg}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!selectedMed ? (
              <div className="ciEmpty">Pick a medicine to see which branches have stock.</div>
            ) : (
              <div className="ciRows">
                {stockRows.map((r) => {
                  const b = branchesById[r.branchId];
                  const qty = Number(r.quantity || 0);

                  return (
                    <button
                      key={r.branchId}
                      type="button"
                      className={selectedBranchId === r.branchId ? "ciRowBtn active" : "ciRowBtn"}
                      onClick={() => setSelectedBranchId(r.branchId)}
                      title="Click to view map"
                    >
                      <div className="ciRowLeft">
                        <div className="ciBName">{b?.name || r.branchName || r.branchId}</div>
                        <div className="ciBSub">{b?.address || "—"}</div>
                      </div>

                      <div className="ciRowRight">
                        <div className={qty > 0 ? "ciQty ok" : "ciQty"}>{qty}</div>
                        <div className="ciQtyLabel">in stock</div>
                      </div>
                    </button>
                  );
                })}

                {!busy && selectedMed && !stockRows.length ? (
                  <div className="ciEmpty">No branches have stock for this medicine.</div>
                ) : null}

                {/* Map */}
                {selectedMed ? (
                  <div className="ciMapSection">
                    <div className="ciMapHead">
                      <div className="ciMapTitle">Branch Location</div>
                      <div className="ciMapHint">
                        {selectedBranch
                          ? selectedBranch.name || "Selected Branch"
                          : "Click a branch above to view it on the map"}
                      </div>
                    </div>

                    {!selectedBranch ? (
                      <div className="ciEmpty">Click a branch row to display its location on the map.</div>
                    ) : !selectedBranchAddress ? (
                      <div className="ciEmpty">This branch has no address saved, so the map can’t be shown.</div>
                    ) : (
                      <div className="ciMapFrameWrap">
                        <iframe
                          title={`Map - ${selectedBranch.name || "Branch"}`}
                          src={mapSrc}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          className="ciMapFrame"
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const css = `
/* =========================
   Scoped Tokens (Dark Mode Ready)
========================= */
.customerInv{
  --bg0:#ffffff;
  --bg1:#f8fafc;

  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --card: rgba(255,255,255,.88);
  --surface: rgba(255,255,255,.96);
  --surface2: rgba(248,250,252,.95);

  --stroke:#e2e8f0;
  --stroke2:#cbd5e1;
  --divider: rgba(226,232,240,.85);

  --primary:#2563eb;
  --primary-weak: rgba(37,99,235,.12);

  --blue-bg:#eff6ff;
  --blue-stroke:#dbeafe;
  --blue-ink:#1d4ed8;

  --ok-ink:#0f766e;

  --bad-bg:#fef2f2;
  --bad-stroke:#fecaca;
  --bad-ink:#991b1b;

  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

html.dark .customerInv,
[data-theme="dark"] .customerInv{
  --bg0:#050814;
  --bg1:#0b1022;

  --ink:#e5e7eb;
  --muted:#9ca3af;
  --muted2:#cbd5e1;

  --card: rgba(15,23,42,.78);
  --surface: rgba(15,23,42,.70);
  --surface2: rgba(15,23,42,.55);

  --stroke:#1f2937;
  --stroke2:#334155;
  --divider: rgba(148,163,184,.22);

  --primary:#3b82f6;
  --primary-weak: rgba(59,130,246,.20);

  --blue-bg: rgba(59,130,246,.16);
  --blue-stroke: rgba(59,130,246,.35);
  --blue-ink:#93c5fd;

  --ok-ink:#6ee7b7;

  --bad-bg: rgba(239,68,68,.12);
  --bad-stroke: rgba(239,68,68,.35);
  --bad-ink:#fca5a5;

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

.customerInv, .customerInv *{ box-sizing:border-box; }

.customerInv.ciPage{
  min-height:100vh;
  padding: clamp(14px, 3vw, 26px);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;

  background:
    radial-gradient(1200px 600px at 20% 10%, #eef2ff 0%, rgba(238,242,255,0) 55%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

html.dark .customerInv.ciPage,
[data-theme="dark"] .customerInv.ciPage{
  background:
    radial-gradient(900px 520px at 20% 10%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.customerInv .ciShell{
  max-width:1140px;
  margin:0 auto;
  display:grid;
  gap:16px;
}

/* Header */
.customerInv .ciTopbar{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
  flex-wrap:wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}

.customerInv .ciLeftTop{
  display:flex;
  align-items:flex-start;
  gap:12px;
  min-width:0;
  flex-wrap:wrap;
}

.customerInv .ciTopText{
  display:grid;
  gap:2px;
  min-width:0;
}

.customerInv .ciTitle{ font-size:24px; font-weight:950; letter-spacing:-0.25px; }
.customerInv .ciSub{ font-size:13px; color: var(--muted2); font-weight:750; line-height: 1.45; }

.customerInv .ciPills{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  justify-content:flex-end;
  align-items:center;
}

.customerInv .ciPill{
  font-size:12px;
  font-weight:950;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  white-space:nowrap;
  height:fit-content;
  box-shadow: var(--shadow-sm);
}

/* Back button (iOS Safari text fill fix) */
.customerInv .ciBtnGhost{
  border:1px solid var(--stroke);
  background: var(--surface);
  padding:10px 12px;
  border-radius:14px;
  cursor:pointer;
  font-weight:950;
  box-shadow: var(--shadow-sm);
  white-space:nowrap;

  color: var(--ink);
  -webkit-text-fill-color: var(--ink);
  text-decoration:none;
  appearance:none;
  -webkit-appearance:none;
  -webkit-tap-highlight-color: transparent;
}
.customerInv .ciBtnGhost:visited,
.customerInv .ciBtnGhost:active,
.customerInv .ciBtnGhost:focus{
  color: var(--ink);
  -webkit-text-fill-color: var(--ink);
  text-decoration:none;
  outline:none;
}
.customerInv .ciBtnGhost:hover{ background: var(--surface2); }
.customerInv .ciBtnGhost:disabled{ opacity:.7; cursor:not-allowed; }

/* Layout */
.customerInv .ciGrid{
  display:grid;
  grid-template-columns: 420px 1fr;
  gap:16px;
  align-items:start;
}
@media (max-width: 980px){
  .customerInv .ciGrid{ grid-template-columns:1fr; }
  .customerInv .ciTitle{ font-size:20px; }
  .customerInv .ciPills{ justify-content:flex-start; }
}

/* Card */
.customerInv .ciCard{
  min-width:0;
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(6px);
}

.customerInv .ciCardHead{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:baseline;
  margin-bottom:10px;
}

.customerInv .ciCardTitle{ font-size:14px; font-weight:950; }
.customerInv .ciCardHint{ font-size:12px; color: var(--muted); font-weight:750; }

.customerInv .ciEllipsis{
  display:inline-block;
  max-width: 52ch;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  vertical-align:bottom;
}
@media (max-width:520px){
  .customerInv .ciEllipsis{ max-width: 28ch; }
}

.customerInv .ciChip{
  font-size:12px;
  font-weight:950;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid var(--stroke);
  background: var(--surface2);
  color: var(--muted2);
  white-space:nowrap;
}

/* Search */
.customerInv .ciSearchWrap{ position:relative; }
.customerInv .ciControl{
  width:100%;
  height:42px;
  padding:0 40px 0 12px;
  border-radius:14px;
  border:1px solid var(--stroke);
  outline:none;
  background: var(--surface);
  color: var(--ink);
  font-size:14px;
  font-weight:750;
}
.customerInv .ciControl::placeholder{ color: var(--muted); font-weight: 800; }
.customerInv .ciControl:focus{
  border-color:#93c5fd;
  box-shadow:0 0 0 3px var(--primary-weak);
}

.customerInv .ciClearBtn{
  position:absolute;
  right:8px;
  top:50%;
  transform:translateY(-50%);
  width:30px;
  height:30px;
  border-radius:10px;
  border:1px solid var(--stroke);
  background: var(--surface);
  cursor:pointer;
  font-weight:950;
  color: var(--muted2);
  display:grid;
  place-items:center;
  padding:0;
  line-height:1;
}
.customerInv .ciClearBtn:hover{ background: var(--surface2); }

/* List */
.customerInv .ciList{
  margin-top:12px;
  display:grid;
  gap:10px;
  max-height:540px;
  overflow:auto;
  padding-right:4px;
  -webkit-overflow-scrolling: touch;
}
@media (max-width:980px){
  .customerInv .ciList{ max-height: 420px; }
}

.customerInv .ciMedBtn{
  text-align:left;
  border:1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  border-radius:14px;
  padding:12px;
  cursor:pointer;
  min-width:0;
}
.customerInv .ciMedBtn:hover{ background: var(--surface2); }
.customerInv .ciMedBtn.active{
  border-color:#93c5fd;
  box-shadow:0 0 0 3px var(--primary-weak);
}

.customerInv .ciMedRowTop{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  min-width:0;
}
.customerInv .ciMedName{
  font-weight:950;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.customerInv .ciMedSub{
  font-size:12px;
  color: var(--muted);
  font-weight:800;
  margin-top:4px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.customerInv .ciPriceChip{
  font-size:12px;
  font-weight:950;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid var(--blue-stroke);
  background: var(--blue-bg);
  color: var(--blue-ink);
  white-space:nowrap;
}

/* Rows */
.customerInv .ciRows{ margin-top:12px; display:grid; gap:10px; }

.customerInv .ciRowBtn{
  width:100%;
  text-align:left;
  border:1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  border-radius:14px;
  padding:12px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  cursor:pointer;
  min-width:0;
}
.customerInv .ciRowBtn:hover{ background: var(--surface2); }
.customerInv .ciRowBtn.active{
  border-color:#93c5fd;
  box-shadow:0 0 0 3px var(--primary-weak);
}

.customerInv .ciRowLeft{ display:grid; gap:4px; min-width:0; }
.customerInv .ciBName{
  font-weight:950;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.customerInv .ciBSub{
  font-size:12px;
  color: var(--muted);
  font-weight:800;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.customerInv .ciRowRight{
  display:grid;
  justify-items:end;
  gap:2px;
  flex: 0 0 auto;
}
.customerInv .ciQty{ font-size:22px; font-weight:950; }
.customerInv .ciQty.ok{ color: var(--ok-ink); }
.customerInv .ciQtyLabel{ font-size:12px; color: var(--muted); font-weight:950; }

/* Map */
.customerInv .ciMapSection{ margin-top:12px; display:grid; gap:10px; }
.customerInv .ciMapHead{ display:grid; gap:2px; }
.customerInv .ciMapTitle{ font-size:13px; font-weight:950; }
.customerInv .ciMapHint{ font-size:12px; color: var(--muted); font-weight:800; }

.customerInv .ciMapFrameWrap{
  border:1px solid var(--stroke);
  border-radius:14px;
  overflow:hidden;
  background: var(--surface);
}
.customerInv .ciMapFrame{
  width:100%;
  height:320px;
  border:0;
  display:block;
}

/* Feedback */
.customerInv .ciEmpty{
  margin-top:12px;
  padding:14px;
  border-radius:16px;
  border:1px dashed var(--stroke2);
  background: var(--surface2);
  color: var(--muted);
  font-weight:950;
  text-align:center;
}

.customerInv .ciToast{
  margin-top:10px;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  font-size:13px;
  font-weight:950;
}
.customerInv .ciToast.bad{
  border-color: var(--bad-stroke);
  background: var(--bad-bg);
  color: var(--bad-ink);
}

/* Extra-small phones */
@media (max-width: 420px){
  .customerInv .ciRowBtn{ flex-direction: column; align-items: stretch; }
  .customerInv .ciRowRight{ justify-items:start; }
  .customerInv .ciPills{ width:100%; }
}
`;
