// src/pages/ReserveMeds.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listBranches, listMedicines } from "../services/inventoryService";
import { createReservation } from "../services/reservationService";
import QRCode from "qrcode";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const easeOut = [0.16, 1, 0.3, 1];

const makeMotion = (reduce) => ({
  page: {
    hidden: { opacity: 0, y: reduce ? 0 : 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduce ? 0 : 0.45,
        ease: easeOut,
        when: "beforeChildren",
        staggerChildren: reduce ? 0 : 0.08,
      },
    },
  },
  card: {
    hidden: {
      opacity: 0,
      y: reduce ? 0 : 14,
      scale: reduce ? 1 : 0.99,
      filter: reduce ? "none" : "blur(6px)",
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: reduce
        ? { duration: 0 }
        : { type: "spring", stiffness: 420, damping: 34, mass: 0.9 },
    },
  },
  item: {
    hidden: { opacity: 0, y: reduce ? 0 : 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce ? { duration: 0 } : { duration: 0.22, ease: easeOut },
    },
    exit: {
      opacity: 0,
      y: reduce ? 0 : 8,
      transition: reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut },
    },
  },
});

export default function ReserveMeds() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const m = useMemo(() => makeMotion(!!reduce), [reduce]);

  const [branches, setBranches] = useState([]);
  const [meds, setMeds] = useState([]);
  const [branchId, setBranchId] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]); // [{medicineId, medicineName, price, qty}]
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [result, setResult] = useState(null); // { reservationId, qrToken }
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    (async () => {
      const b = await listBranches();
      const mm = await listMedicines();
      setBranches(b);
      setMeds(mm);
      if (b.length) setBranchId(b[0].id);
    })();
  }, []);

  const filteredMeds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meds;
    return meds.filter((mm) => {
      const hay = `${mm.name || ""} ${mm.genericName || ""} ${mm.form || ""} ${mm.strength || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [meds, search]);

  function addToCart(mm) {
    setMsg("");
    setResult(null);
    setQrUrl("");

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.medicineId === mm.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: (Number(copy[idx].qty) || 0) + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          medicineId: mm.id,
          medicineName: mm.name || mm.genericName || "Medicine",
          price: Number(mm.price) || 0,
          qty: 1,
        },
      ];
    });
  }

  function updateQty(medicineId, qty) {
    setCart((prev) =>
      prev
        .map((x) => (x.medicineId === medicineId ? { ...x, qty } : x))
        .filter((x) => (Number(x.qty) || 0) > 0)
    );
  }

  async function handleReserve() {
    setMsg("");
    setResult(null);
    setQrUrl("");

    if (!branchId) return setMsg("Please select a branch.");
    if (!customerName.trim()) return setMsg("Please enter your name.");
    if (!cart.length) return setMsg("Cart is empty.");

    try {
      setBusy(true);

      const res = await createReservation({
        branchId,
        customerName,
        customerPhone,
        items: cart.map((c) => ({
          medicineId: c.medicineId,
          medicineName: c.medicineName,
          qty: Number(c.qty) || 0,
          price: Number(c.price) || 0,
        })),
      });

      setResult(res);

      const payload = JSON.stringify({
        type: "reservation",
        branchId,
        reservationId: res.reservationId,
        token: res.qrToken,
      });

      const url = await QRCode.toDataURL(payload, { margin: 1, scale: 8 });
      setQrUrl(url);

      setCart([]);
      setMsg("Reservation created ✅");
    } catch (e) {
      setMsg(e?.message || "Failed to reserve");
    } finally {
      setBusy(false);
    }
  }

  const selectedBranch = branches.find((b) => b.id === branchId);
  const totalQty = cart.reduce((sum, x) => sum + (Number(x.qty) || 0), 0);

  const estimatedTotal = useMemo(() => {
    return cart.reduce((sum, x) => {
      const price = Number(x.price) || 0;
      const qty = Number(x.qty) || 0;
      return sum + price * qty;
    }, 0);
  }, [cart]);

  const isBadMsg = /fail|error|invalid|denied/i.test(String(msg || ""));

  return (
    <div className="pPage reserveMeds">
      <style>{css}</style>

      <motion.div className="pShell" variants={m.page} initial="hidden" animate="show">
        {/* Header */}
        <div className="pHeader">
          <div className="pHeaderLeft">
            <motion.button
              onClick={() => navigate(-1)}
              className="btn btnGhost"
              disabled={busy}
              whileHover={busy || reduce ? undefined : { scale: 1.02 }}
              whileTap={busy || reduce ? undefined : { scale: 0.98 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 36 }}
            >
              ← Back
            </motion.button>

            <div className="pHeaderText">
              <div className="pTitleRow">
                <div className="pTitle">Reserve Medicines</div>
                <span className="pill">customer</span>
              </div>
              <div className="pSubtitle">
                Choose a branch, add medicines, then show the QR to the pharmacist.
              </div>
            </div>
          </div>

          {/* Header Right (Branch / Cart / Est. Total) */}
          <div className="pHeaderRight">
            <span className="pill">
              Branch: <b>{selectedBranch?.name || "—"}</b>
            </span>
            <span className="pill">
              Cart: <b>{totalQty}</b>
            </span>
            <span className="pill">
              Est. Total: <b>₱{estimatedTotal.toFixed(2)}</b>
            </span>
          </div>
        </div>

        {/* Grid */}
        <div className="grid2">
          {/* LEFT */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Details</div>
                <div className="cardHint">{selectedBranch ? selectedBranch.name : "Select a branch"}</div>
              </div>
            </div>

            <div className="stack">
              <div className="field">
                <label className="label">Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="control"
                  disabled={busy}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="row2">
                <div className="field">
                  <label className="label">Customer name</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="control"
                    placeholder="Your name"
                    disabled={busy}
                  />
                </div>

                <div className="field">
                  <label className="label">Phone (optional)</label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="control"
                    placeholder="09xx..."
                    inputMode="tel"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="divider" />

              <div className="field">
                <label className="label">Search medicine</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="control"
                  placeholder="Type name / generic / form..."
                  disabled={busy}
                />
              </div>

              <div className="list" role="list">
                <AnimatePresence initial={false}>
                  {filteredMeds.slice(0, 30).map((mm) => (
                    <motion.button
                      key={mm.id}
                      type="button"
                      className="listBtn"
                      onClick={() => addToCart(mm)}
                      disabled={busy}
                      variants={m.item}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      whileHover={busy || reduce ? undefined : { y: -1, scale: 1.01 }}
                      whileTap={busy || reduce ? undefined : { scale: 0.98 }}
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34 }}
                    >
                      <div className="listMain">
                        <div className="listName">{mm.name || mm.genericName || "Medicine"}</div>
                        <div className="listSub">
                          {mm.genericName || "—"}
                          <span className="dot">•</span>₱{Number(mm.price || 0).toFixed(2)}
                          <span className="dot">•</span>
                          <span className="muted">
                            {mm.form || "—"} / {mm.strength || "—"}
                          </span>
                        </div>
                      </div>
                      <div className="addPill">Add</div>
                    </motion.button>
                  ))}
                </AnimatePresence>

                {filteredMeds.length === 0 ? (
                  <div className="empty">No medicines found. Try another keyword.</div>
                ) : null}
              </div>
            </div>
          </motion.section>

          {/* RIGHT */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Cart</div>
                <div className="cardHint">{totalQty} item(s)</div>
              </div>

              <div className="totalChip" title="Estimated total based on price × qty">
                Est. ₱{estimatedTotal.toFixed(2)}
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="empty">Add medicines from the list.</div>
            ) : (
              <div className="stack">
                <div className="cartList">
                  <AnimatePresence initial={false}>
                    {cart.map((c) => {
                      const lineTotal = (Number(c.price) || 0) * (Number(c.qty) || 0);
                      return (
                        <motion.div
                          key={c.medicineId}
                          className="cartRow"
                          variants={m.item}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          layout
                        >
                          <div className="cartLeft">
                            <div className="cartName" title={c.medicineName}>
                              {c.medicineName}
                            </div>
                            <div className="cartMeta">
                              ₱{Number(c.price || 0).toFixed(2)}
                              <span className="dot">•</span>
                              Line: <b>₱{lineTotal.toFixed(2)}</b>
                            </div>
                          </div>

                          <div className="cartRight">
                            <input
                              type="number"
                              min="0"
                              value={c.qty}
                              onChange={(e) => updateQty(c.medicineId, e.target.value)}
                              className="qty"
                              disabled={busy}
                              inputMode="numeric"
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                <div className="totalRow">
                  <div className="totalLabel">Estimated Total</div>
                  <div className="totalValue">₱{estimatedTotal.toFixed(2)}</div>
                </div>

                <motion.button
                  onClick={handleReserve}
                  disabled={busy || !branchId || !cart.length}
                  className="btn btnPrimary"
                  whileHover={busy || reduce ? undefined : { scale: 1.01 }}
                  whileTap={busy || reduce ? undefined : { scale: 0.98 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34 }}
                  type="button"
                >
                  {busy ? "Reserving..." : "Reserve & Generate QR"}
                </motion.button>
              </div>
            )}

            <AnimatePresence>
              {msg ? (
                <motion.div
                  key={msg}
                  className={`toast ${isBadMsg ? "bad" : "ok"}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
                >
                  {msg}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {result ? (
                <motion.div
                  className="qrCard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.2, ease: easeOut }}
                >
                  <div className="qrTitle">Show this QR to pharmacist</div>
                  {qrUrl ? <img src={qrUrl} alt="QR" className="qrImg" /> : null}
                  <div className="qrToken">
                    Token: <span className="tokenStrong">{result.qrToken}</span>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="note">
              <b>Note:</b> Total is an estimate based on listed prices and selected quantities.
            </div>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

const css = `
/* =========================
   Scoped Tokens
========================= */
.reserveMeds{
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

  --ok-bg:#ecfdf5;
  --ok-stroke:#a7f3d0;
  --ok-ink:#065f46;

  --bad-bg:#fef2f2;
  --bad-stroke:#fecaca;
  --bad-ink:#991b1b;

  --pill-bg: var(--surface);
  --pill-ink: #334155;

  --add-bg:#eff6ff;
  --add-stroke:#bfdbfe;
  --add-ink:#1d4ed8;

  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

[data-theme="dark"] .reserveMeds,
html.dark .reserveMeds{
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

  --ok-bg: rgba(16,185,129,.12);
  --ok-stroke: rgba(16,185,129,.35);
  --ok-ink:#6ee7b7;

  --bad-bg: rgba(239,68,68,.12);
  --bad-stroke: rgba(239,68,68,.35);
  --bad-ink:#fca5a5;

  --pill-bg: var(--surface2);
  --pill-ink: var(--muted2);

  --add-bg: rgba(59,130,246,.16);
  --add-stroke: rgba(59,130,246,.35);
  --add-ink: #93c5fd;

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

.reserveMeds *{ box-sizing:border-box; }

/* =========================
   Page Layout
========================= */
.reserveMeds.pPage{
  min-height:100vh;
  width:100%;
  padding: clamp(16px, 3vw, 32px);
  padding-top: 40px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  color: var(--ink);

  background:
    radial-gradient(1100px 520px at 14% 8%, #eef2ff 0%, rgba(238,242,255,0) 60%),
    radial-gradient(900px 520px at 90% 20%, #eff6ff 0%, rgba(239,246,255,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));

  -webkit-text-size-adjust: 100%;
}

[data-theme="dark"] .reserveMeds.pPage,
html.dark .reserveMeds.pPage{
  background:
    radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.reserveMeds .pShell{
  max-width: 1100px;
  margin: 0 auto;
  display:grid;
  gap: 16px;
}

/* =========================
   Header
========================= */
.reserveMeds .pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}

/* prevent flex overflow (Safari) */
.reserveMeds .pHeaderLeft,
.reserveMeds .pHeaderRight,
.reserveMeds .pHeaderText{ min-width: 0; }

.reserveMeds .pHeaderLeft{
  display:flex;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
}

.reserveMeds .pHeaderText{
  min-width: 240px;
  display:grid;
  gap: 6px;
}

.reserveMeds .pTitleRow{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap:wrap;
}

.reserveMeds .pTitle{
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.reserveMeds .pSubtitle{
  font-size: 13px;
  color: var(--muted2);
  font-weight: 750;
  line-height: 1.45;
}

.reserveMeds .pHeaderRight{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap:wrap;
  justify-content:flex-end;
}

/* pill */
.reserveMeds .pill{
  font-size:12px;
  font-weight:950;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--pill-bg);
  color: var(--pill-ink);
  box-shadow: var(--shadow-sm);
  text-transform: capitalize;
  white-space: nowrap;

  display:inline-flex;
  align-items:center;
  gap: 6px;
  min-width: 0;
}

.reserveMeds .pill b{
  display:inline-block;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  max-width: 22ch;
}

/* mobile header layout fix (iPhone Safari) */
@media (max-width: 560px){
  .reserveMeds .pHeader{ align-items: stretch; }
  .reserveMeds .pHeaderRight{
    width: 100%;
    justify-content: flex-start;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .reserveMeds .pHeaderRight .pill:nth-child(1){ grid-column: 1 / -1; }
  .reserveMeds .pHeaderRight .pill{ width: 100%; justify-content: center; text-align: center; }
  .reserveMeds .pHeaderRight .pill:nth-child(1) b{ max-width: 28ch; }
}

/* =========================
   Layout / Cards
========================= */
.reserveMeds .grid2{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
  align-items: start;
}

.reserveMeds .card{
  min-width: 0;
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(8px);
}

.reserveMeds .cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  gap: 10px;
  margin-bottom: 12px;
}

.reserveMeds .cardTitle{ font-size: 16px; font-weight: 950; }
.reserveMeds .cardHint{ font-size: 12px; color: var(--muted); font-weight: 750; }

.reserveMeds .stack{ display:grid; gap: 12px; }

.reserveMeds .row2{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 520px){
  .reserveMeds .row2{ grid-template-columns: 1fr; }
}

.reserveMeds .divider{
  height: 1px;
  background: var(--divider);
}

/* =========================
   Inputs
========================= */
.reserveMeds .field{ display:grid; gap: 6px; }
.reserveMeds .label{ font-size: 12px; color: var(--muted2); font-weight: 900; }

.reserveMeds .control{
  height: 42px;
  width: 100%;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline: none;
  background: var(--surface);
  font-size: 14px;
  font-weight: 800;
  color: var(--ink);
}

.reserveMeds .control:focus{
  border-color:#93c5fd;
  box-shadow: 0 0 0 4px var(--primary-weak);
}

.reserveMeds .control::placeholder{
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

/* =========================
   Medicine List
========================= */
.reserveMeds .list{
  display:grid;
  gap: 10px;
  max-height: 380px;
  overflow:auto;
  padding-right: 4px;
}

.reserveMeds .listBtn{
  width: 100%;
  text-align:left;
  border: 1px solid var(--stroke);
  background: var(--surface);
  border-radius: 16px;
  padding: 12px;
  cursor: pointer;
  display:flex;
  justify-content:space-between;
  gap: 12px;
  align-items:center;
}

.reserveMeds .listBtn:disabled{ opacity:.7; cursor:not-allowed; }

.reserveMeds .listMain{ min-width: 0; display:grid; gap: 4px; }
.reserveMeds .listName{ font-weight: 950; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.reserveMeds .listSub{ font-size: 12px; color: var(--muted); font-weight: 750; line-height: 1.35; }
.reserveMeds .dot{ margin: 0 6px; color: var(--stroke2); }
.reserveMeds .muted{ color: var(--muted); }

.reserveMeds .addPill{
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 950;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--add-stroke);
  background: var(--add-bg);
  color: var(--add-ink);
  white-space: nowrap;
}

/* =========================
   Cart
========================= */
.reserveMeds .cartList{ display:grid; gap: 10px; }

.reserveMeds .cartRow{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap: 12px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  border-radius: 16px;
  padding: 12px;
}

.reserveMeds .cartLeft{ min-width: 0; display:grid; gap: 4px; }

.reserveMeds .cartName{
  font-weight: 950;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.reserveMeds .cartMeta{ font-size: 12px; color: var(--muted); font-weight: 850; }

.reserveMeds .cartRight{ display:flex; justify-content:flex-end; }

.reserveMeds .qty{
  height: 42px;
  width: 96px;
  padding: 0 10px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline:none;
  font-weight: 950;
  background: var(--surface);
  color: var(--ink);
}

.reserveMeds .qty:focus{
  border-color:#93c5fd;
  box-shadow: 0 0 0 4px var(--primary-weak);
}

/* total UI */
.reserveMeds .totalChip{
  font-size: 12px;
  font-weight: 950;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--add-stroke);
  background: var(--add-bg);
  color: var(--add-ink);
  white-space: nowrap;
}

.reserveMeds .totalRow{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap: 12px;
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  border-radius: 14px;
  padding: 10px 12px;
}

.reserveMeds .totalLabel{
  font-size: 12px;
  color: var(--muted);
  font-weight: 900;
}

.reserveMeds .totalValue{
  font-size: 16px;
  font-weight: 1000;
  color: var(--ink);
  white-space: nowrap;
}

@media (max-width: 420px){
  .reserveMeds .cartRow{ flex-direction: column; align-items: stretch; }
  .reserveMeds .cartRight{ justify-content:flex-start; }
  .reserveMeds .qty{ width: 100%; }
}

/* =========================
   Buttons
========================= */
.reserveMeds .btn{
  height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  font-weight: 950;
  cursor:pointer;
  border: 1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  white-space: nowrap;
}

.reserveMeds .btn:disabled{ opacity:.7; cursor:not-allowed; }

.reserveMeds .btnGhost{
  background: var(--surface);
  border-color: var(--stroke);
}

.reserveMeds .btnPrimary{
  border: 0;
  background: var(--primary);
  color:#fff;
  box-shadow: 0 10px 18px rgba(37,99,235,.16);
}

[data-theme="dark"] .reserveMeds .btnPrimary,
html.dark .reserveMeds .btnPrimary{
  box-shadow: 0 16px 30px rgba(59,130,246,.16);
}

/* =========================
   Toast / Empty
========================= */
.reserveMeds .toast{
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid;
  font-size: 13px;
  font-weight: 950;
  background: var(--surface);
}

.reserveMeds .toast.ok{ background: var(--ok-bg); border-color: var(--ok-stroke); color: var(--ok-ink); }
.reserveMeds .toast.bad{ background: var(--bad-bg); border-color: var(--bad-stroke); color: var(--bad-ink); }

.reserveMeds .empty{
  padding: 14px;
  border-radius: 16px;
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  color: var(--muted);
  font-weight: 950;
  text-align: center;
}

/* =========================
   QR Card / Note
========================= */
.reserveMeds .qrCard{
  margin-top: 14px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  border-radius: 18px;
  padding: 14px;
  display: grid;
  justify-items: center;
  gap: 10px;
}

.reserveMeds .qrTitle{ font-weight: 950; }
.reserveMeds .qrImg{ width: min(260px, 72vw); height: auto; }
.reserveMeds .qrToken{ font-size: 12px; color: var(--muted); font-weight: 850; }
.reserveMeds .tokenStrong{ font-weight: 950; color: var(--ink); }

.reserveMeds .note{
  margin-top: 12px;
  font-size: 12px;
  color: var(--muted);
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  padding: 12px;
  border-radius: 14px;
  line-height: 1.55;
  font-weight: 750;
}
`;
