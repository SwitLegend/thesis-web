// src/pages/POS.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { useAuth } from "../hooks/useAuth";
import { listBranches, listMedicines, listInventoryForBranch } from "../services/inventoryService";
import { getReservationItems } from "../services/reservationService";
import { db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";

import { createSale } from "../services/posService";

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
        staggerChildren: reduce ? 0 : 0.06,
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
});

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function peso(n) {
  return `₱${asNumber(n, 0).toFixed(2)}`;
}

export default function POS() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const m = useMemo(() => makeMotion(!!reduce), [reduce]);

  const { user, profile } = useAuth();
  const staffName = profile?.fullName || user?.email || "Staff";

  const [sp] = useSearchParams();
  const didInit = useRef(false);

  // Data
  const [branches, setBranches] = useState([]);
  const [meds, setMeds] = useState([]);
  const medsById = useMemo(() => {
    const map = {};
    for (const mm of meds) map[mm.id] = mm;
    return map;
  }, [meds]);

  // Branch + inventory
  const [branchId, setBranchId] = useState("");
  const [invMap, setInvMap] = useState({}); // { medicineId: quantity }

  // Optional reservation mode
  const [reservationId, setReservationId] = useState("");
  const [reservation, setReservation] = useState(null);

  // Customer details (optional)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Cart
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]); // [{medicineId, medicineName, price, qty}]

  // Payment
  const [method, setMethod] = useState("cash"); // cash | card | gcash
  const [cashReceived, setCashReceived] = useState("");

  // UI
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [b, mm] = await Promise.all([listBranches(), listMedicines()]);
        setBranches(b);
        setMeds(mm);
        if (b.length) setBranchId(b[0].id);
      } catch (e) {
        setMsg(e?.message || "Failed to load branches/medicines");
      }
    })();
  }, []);

  // Init from query params only once
  useEffect(() => {
    if (didInit.current) return;
    if (!branches.length) return;

    const qBranchId = String(sp.get("branchId") || "").trim();
    const qReservationId = String(sp.get("reservationId") || "").trim();

    didInit.current = true;

    if (qBranchId) setBranchId(qBranchId);
    if (qReservationId) setReservationId(qReservationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

  // Load inventory for selected branch
  useEffect(() => {
    if (!branchId) return;
    (async () => {
      try {
        const invRows = await listInventoryForBranch(branchId);
        const map = {};
        for (const r of invRows) map[r.medicineId] = asNumber(r.quantity, 0);
        setInvMap(map);
      } catch (e) {
        setInvMap({});
        setMsg(e?.message || "Failed to load inventory");
      }
    })();
  }, [branchId]);

  // When reservationId is provided, load reservation + items and seed the cart
  useEffect(() => {
    if (!reservationId) {
      setReservation(null);
      return;
    }

    (async () => {
      try {
        setMsg("");
        const rSnap = await getDoc(doc(db, "reservations", reservationId));
        const r = rSnap.exists() ? { id: rSnap.id, ...rSnap.data() } : null;
        setReservation(r);

        // If reservation has a branch, lock the POS branch to it
        if (r?.branchId) setBranchId(String(r.branchId));
        if (r?.customerName) setCustomerName(String(r.customerName));
        if (r?.customerPhone) setCustomerPhone(String(r.customerPhone));

        const items = await getReservationItems(reservationId);
        const seeded = (items || []).map((it) => {
          const mm = medsById[it.medicineId];
          return {
            medicineId: it.medicineId,
            medicineName:
              (it.medicineName || "").trim() ||
              mm?.name ||
              mm?.genericName ||
              "Medicine",
            price: asNumber(it.price, asNumber(mm?.price, 0)),
            qty: asNumber(it.qty, 0),
          };
        });

        // Only replace cart if it has meaningful lines
        if (seeded.length) setCart(seeded.filter((x) => x.qty > 0));
      } catch (e) {
        console.error(e);
        setMsg(e?.message || "Failed to load reservation");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
    // We intentionally do NOT include medsById as a dependency, to avoid re-seeding cart repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  const selectedBranch = branches.find((b) => b.id === branchId);

  const filteredMeds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meds;
    return meds.filter((mm) => {
      const hay = `${mm.name || ""} ${mm.genericName || ""} ${mm.form || ""} ${mm.strength || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [meds, search]);

  const cartTotals = useMemo(() => {
    const totalQty = (cart || []).reduce((s, it) => s + asNumber(it.qty, 0), 0);
    const total = (cart || []).reduce(
      (s, it) => s + asNumber(it.qty, 0) * asNumber(it.price, 0),
      0
    );
    return { totalQty, total };
  }, [cart]);

  const cashChange = useMemo(() => {
    if (method !== "cash") return 0;
    const rec = asNumber(cashReceived, 0);
    return Math.max(0, rec - cartTotals.total);
  }, [cashReceived, cartTotals.total, method]);

  function addToCart(mm) {
    setMsg("");
    if (!branchId) return setMsg("Select a branch first.");

    const available = asNumber(invMap[mm.id], 0);

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.medicineId === mm.id);
      if (idx >= 0) {
        const copy = [...prev];
        const nextQty = asNumber(copy[idx].qty, 0) + 1;
        if (nextQty > available) {
          setMsg(`Insufficient stock. Available: ${available}`);
          return prev;
        }
        copy[idx] = { ...copy[idx], qty: nextQty };
        return copy;
      }

      if (available < 1) {
        setMsg("Out of stock for this branch.");
        return prev;
      }

      return [
        ...prev,
        {
          medicineId: mm.id,
          medicineName: mm.name || mm.genericName || "Medicine",
          price: asNumber(mm.price, 0),
          qty: 1,
        },
      ];
    });
  }

  function updateCartQty(medicineId, qty) {
    setCart((prev) => {
      const next = prev
        .map((x) => (x.medicineId === medicineId ? { ...x, qty } : x))
        .filter((x) => asNumber(x.qty, 0) > 0);
      return next;
    });
  }

  async function handleCheckout() {
    setMsg("");
    if (!branchId) return setMsg("Select a branch.");
    if (!cart.length) return setMsg("Cart is empty.");

    try {
      setBusy(true);

      const res = await createSale({
        branchId,
        items: cart.map((c) => ({
          medicineId: c.medicineId,
          medicineName: c.medicineName,
          qty: asNumber(c.qty, 0),
          price: asNumber(c.price, 0),
        })),
        paymentMethod: method,
        cashReceived: method === "cash" ? cashReceived : null,
        reservationId: reservationId || null,
        customerName,
        customerPhone,
        customerUid: reservation?.customerUid || null,
      });

      // Clean up UI
      setCart([]);
      setCashReceived("");
      setMsg("Sale completed ✅");

      navigate(`/receipt/${res.saleId}`);
    } catch (e) {
      console.error(e);
      setMsg(e?.message || "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  const isBadMsg = /fail|error|denied|insufficient|required/i.test(String(msg || ""));

  return (
    <div className="pPage posPage">
      <style>{css}</style>

      <motion.div className="pShell" variants={m.page} initial="hidden" animate="show">
        {/* Header */}
        <div className="pHeader">
          <div className="pHeaderLeft">
            <motion.button
              onClick={() => navigate(-1)}
              className="btn btnGhost backBtn"
              disabled={busy}
              whileHover={busy || reduce ? undefined : { scale: 1.02 }}
              whileTap={busy || reduce ? undefined : { scale: 0.98 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 36 }}
            >
              <span className="backIcon" aria-hidden="true">
                ←
              </span>
              <span className="backText">Back</span>
            </motion.button>

            <div className="pHeaderText">
              <div className="pTitleRow">
                <div className="pTitle">Point of Sale</div>
                <span className="pill">admin/pharmacist</span>
              </div>
              <div className="pSubtitle">
                Branch checkout with <b>Cash</b>, <b>Credit Card</b>, or <b>GCash</b>. Inventory auto-deducts.
              </div>
            </div>
          </div>

          <div className="pHeaderRight">
            <span className="pill pillWide infoPill">
              Staff: <b title={staffName}>{staffName}</b>
            </span>
            <span className="pill pillWide infoPill">
              Branch: <b title={selectedBranch?.name || "—"}>{selectedBranch?.name || "—"}</b>
            </span>
            <span className="pill statPill">
              Items: <b>{cartTotals.totalQty}</b>
            </span>
            <span className="pill statPill">
              Total: <b>{peso(cartTotals.total)}</b>
            </span>
          </div>
        </div>

        {/* Reservation banner */}
        {reservationId ? (
          <motion.div className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Reservation Linked</div>
                <div className="cardHint">
                  Reservation ID: <b className="mono">{reservationId}</b>
                </div>
              </div>
              <div className="rightPills">
                <span className="pill subtle">
                  Status: <b>{reservation?.status || "—"}</b>
                </span>
              </div>
            </div>
            <div className="grid3">
              <div className="field">
                <label className="label">Customer Name</label>
                <input
                  className="control"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="label">Customer Phone</label>
                <input
                  className="control"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="label">Branch (locked)</label>
                <input className="control" value={selectedBranch?.name || branchId} disabled />
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* Main grid */}
        <div className="grid2">
          {/* LEFT: Medicine picker */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Medicines</div>
                <div className="cardHint">Search and add to cart</div>
              </div>
              <div className="rightRow">
                <div className="field compact">
                  <label className="label">Branch</label>
                  <select
                    className="control"
                    value={branchId}
                    onChange={(e) => {
                      setBranchId(e.target.value);
                      setMsg("");
                    }}
                    disabled={busy || !!reservationId}
                    title={reservationId ? "Branch is locked by reservation" : "Select branch"}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="stack">
              <div className="field">
                <label className="label">Search</label>
                <input
                  className="control"
                  placeholder="Search medicine name, generic, form, strength..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="list">
                {filteredMeds.slice(0, 60).map((mm) => {
                  const available = asNumber(invMap[mm.id], 0);
                  return (
                    <div key={mm.id} className="listRow">
                      <div className="listLeft">
                        <div className="name">{mm.name || mm.genericName || "Medicine"}</div>
                        <div className="sub">
                          {[mm.genericName, [mm.form, mm.strength].filter(Boolean).join(" / ")]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </div>

                      <div className="listRight">
                        <div className="miniPill">{peso(mm.price)}</div>
                        <div className={available <= 0 ? "miniPill bad" : "miniPill"}>
                          Stock: <b>{available}</b>
                        </div>
                        <button
                          className="btnSmall"
                          onClick={() => addToCart(mm)}
                          disabled={busy || !branchId || available <= 0}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredMeds.length === 0 ? <div className="empty">No medicines found.</div> : null}
              </div>
            </div>
          </motion.section>

          {/* RIGHT: Cart + payment */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Cart & Payment</div>
                <div className="cardHint">Edit quantities then checkout</div>
              </div>
              <div className="rightPills">
                <span className="pill subtle">
                  Items: <b>{cartTotals.totalQty}</b>
                </span>
                <span className="pill subtle">
                  Total: <b>{peso(cartTotals.total)}</b>
                </span>
              </div>
            </div>

            {/* Cart */}
            {cart.length === 0 ? (
              <div className="empty">
                Cart is empty.
                <br />
                Add medicines from the left.
              </div>
            ) : (
              <div className="cartBox">
                {cart.map((it) => {
                  const available = asNumber(invMap[it.medicineId], 0);
                  const lineTotal = asNumber(it.qty, 0) * asNumber(it.price, 0);

                  return (
                    <div key={it.medicineId} className="cartRow">
                      <div className="cartLeft">
                        <div className="name">
                          {it.medicineName ||
                            medsById[it.medicineId]?.name ||
                            medsById[it.medicineId]?.genericName ||
                            it.medicineId}
                        </div>
                        <div className="sub">
                          Unit: <b>{peso(it.price)}</b>
                          <span className="dot">•</span>
                          Stock: <b>{available}</b>
                        </div>
                      </div>
                      <div className="cartRight">
                        <input
                          className="qty"
                          type="number"
                          min={0}
                          max={available}
                          value={it.qty}
                          onChange={(e) => updateCartQty(it.medicineId, asNumber(e.target.value, 0))}
                          disabled={busy}
                        />
                        <div className="line">{peso(lineTotal)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="divider" />

            {/* Payment method */}
            <div className="sectionTitle">Payment</div>
            <div className="payRow">
              <label className={method === "cash" ? "payOpt on" : "payOpt"}>
                <input
                  type="radio"
                  name="pay"
                  value="cash"
                  checked={method === "cash"}
                  onChange={() => setMethod("cash")}
                  disabled={busy}
                />
                Cash
              </label>
              <label className={method === "card" ? "payOpt on" : "payOpt"}>
                <input
                  type="radio"
                  name="pay"
                  value="card"
                  checked={method === "card"}
                  onChange={() => setMethod("card")}
                  disabled={busy}
                />
                Credit Card
              </label>
              <label className={method === "gcash" ? "payOpt on gcash" : "payOpt gcash"}>
                <input
                  type="radio"
                  name="pay"
                  value="gcash"
                  checked={method === "gcash"}
                  onChange={() => setMethod("gcash")}
                  disabled={busy}
                />
                GCash
              </label>
            </div>

            {method === "cash" ? (
              <div className="grid2b">
                <div className="field">
                  <label className="label">Cash received</label>
                  <input
                    className="control"
                    type="number"
                    min={0}
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    disabled={busy}
                    placeholder="0.00"
                  />
                </div>
                <div className="field">
                  <label className="label">Change</label>
                  <input className="control" value={peso(cashChange)} disabled />
                </div>
              </div>
            ) : (
              <div className="note">
                This POS records the payment method as <b>{method.toUpperCase()}</b>. If you want online payment
                confirmation (webhooks), we can add Firebase Cloud Functions next.
              </div>
            )}

            <div className="btnRow">
              <button className="btn btnGhost" onClick={() => setCart([])} disabled={busy || !cart.length}>
                Clear Cart
              </button>
              <button className="btn btnPrimary" onClick={handleCheckout} disabled={busy || !cart.length}>
                {busy ? "Processing..." : "Complete Sale"}
              </button>
            </div>

            <AnimatePresence>
              {msg ? (
                <motion.div
                  key={msg}
                  className={isBadMsg ? "toast bad" : "toast ok"}
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduce ? 0 : 8 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
                >
                  {msg}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

const css = `
.posPage{
  --bg0:#ffffff;
  --bg1:#f8fafc;

  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --surface-1: rgba(255,255,255,.86);
  --surface-2: rgba(248,250,252,.92);

  --stroke:#e2e8f0;
  --stroke2:#cbd5e1;

  --primary:#2563eb;
  --primary-weak: rgba(37,99,235,.12);
  --bad:#dc2626;
  --bad-bg: rgba(220,38,38,.12);
  --ok:#16a34a;
  --ok-bg: rgba(22,163,74,.12);

  --radius: 18px;
  --radius-sm: 14px;
  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

[data-theme="dark"] .posPage{
  --bg0:#050814;
  --bg1:#0b1022;
  --ink:#e5e7eb;
  --muted:#9ca3af;
  --muted2:#cbd5e1;
  --surface-1: rgba(15,23,42,.78);
  --surface-2: rgba(15,23,42,.72);
  --stroke:#1f2937;
  --stroke2:#334155;
  --primary:#3b82f6;
  --primary-weak: rgba(59,130,246,.20);
  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

*{ box-sizing:border-box; }

.pPage{
  min-height: 100vh;
  width: 100%;
  padding: clamp(16px, 3vw, 28px);
  padding-top: 28px;
  display:flex;
  justify-content:center;
  align-items:flex-start;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  color: var(--ink);
}

.pShell{ width: min(1220px, 100%); display:grid; gap: 16px; }

/* Header */
.pHeader{
  display:flex; gap: 12px; justify-content:space-between; align-items:flex-start; flex-wrap:wrap;
  padding-bottom: 10px; border-bottom: 1px solid rgba(226,232,240,.85);
}
[data-theme="dark"] .pHeader{ border-bottom-color: rgba(51,65,85,.75); }

.pHeaderLeft{ display:flex; gap: 12px; align-items:flex-start; flex-wrap:wrap; }
.pHeaderText{ min-width: 260px; max-width: 720px; }
.pTitleRow{ display:flex; gap: 10px; align-items:center; flex-wrap:wrap; }
.pTitle{ font-size: 26px; font-weight: 950; letter-spacing: -0.3px; }
.pSubtitle{ font-size: 13px; color: var(--muted2); margin-top: 4px; font-weight: 750; line-height: 1.45; }

/* Desktop: pills stay on one line as space allows */
.pHeaderRight{
  display:flex; gap: 10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;
}

.pill{
  border: 1px solid var(--stroke);
  background-color: var(--surface-2);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 900;
  color: var(--ink);
  min-width: 0;
}
.pill.subtle{ background-color: rgba(148,163,184,.10); }
.pillWide{ max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

/* Cards */
.card{ border: 1px solid var(--stroke); border-radius: var(--radius); background-color: var(--surface-1); box-shadow: var(--shadow-sm); overflow:hidden; }
.cardHead{ padding: 14px 14px 10px; display:flex; gap: 12px; align-items:flex-start; justify-content:space-between; border-bottom: 1px solid rgba(226,232,240,.75); }
[data-theme="dark"] .cardHead{ border-bottom-color: rgba(51,65,85,.6); }
.cardTitle{ font-weight: 950; font-size: 14px; }
.cardHint{ font-weight: 800; font-size: 12px; color: var(--muted2); margin-top: 2px; }

.rightRow, .rightPills{ display:flex; gap: 10px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.grid2{ display:grid; grid-template-columns: 1.15fr 0.85fr; gap: 16px; }
@media (max-width: 980px){ .grid2{ grid-template-columns: 1fr; } }

.grid3{ padding: 14px; display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
@media (max-width: 980px){ .grid3{ grid-template-columns: 1fr; } }

.stack{ padding: 14px; display:grid; gap: 12px; }

.field{ display:grid; gap: 6px; }
.field.compact{ min-width: 220px; }
.label{ font-size: 12px; font-weight: 950; color: var(--muted2); }
.control{
  height: 42px;
  border-radius: 14px;
  border: 1px solid var(--stroke2);
  background-color: rgba(255,255,255,.92);
  padding: 0 12px;
  font-weight: 900;
  color: var(--ink);
}
[data-theme="dark"] .control{ background-color: rgba(15,23,42,.70); border-color: var(--stroke2); }

.list{ display:grid; gap: 10px; }

/* ✅ FIX: listRight stays aligned + consistent width, left text truncates/clamps */
.listRow{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--stroke);
  border-radius: 16px;
  background-color: rgba(255,255,255,.70);
}
[data-theme="dark"] .listRow{ background-color: rgba(15,23,42,.55); }

.listLeft{
  flex: 1 1 auto;
  min-width: 0;
}

/* Right side keeps a stable width */
.listRight{
  --rightW: 230px;
  flex: 0 0 var(--rightW);
  width: var(--rightW);
  min-width: var(--rightW);

  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap: 8px;
  flex-wrap:wrap;
}
.listRight > *{ flex: 0 0 auto; }

.name{
  font-weight: 950;
  letter-spacing: -0.15px;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub{
  font-size: 12px;
  color: var(--muted2);
  font-weight: 800;
  margin-top: 2px;

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.miniPill{ border: 1px solid var(--stroke); border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 950; background-color: rgba(148,163,184,.10); }
.miniPill.bad{ border-color: rgba(220,38,38,.25); background-color: rgba(220,38,38,.10); color: var(--bad); }

.btnSmall{ height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--stroke); background: var(--primary-weak); color: var(--ink); font-weight: 950; cursor:pointer; }
.btnSmall:disabled{ opacity:.6; cursor:not-allowed; }

/* Small mobile: stack price/stock/add neatly without shifting left text */
@media (max-width: 520px){
  .listRight{
    --rightW: 150px;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 8px;
  }
  .listRight .miniPill,
  .listRight .btnSmall{
    width: 100%;
    text-align: center;
    justify-content: center;
  }
}

.cartBox{ padding: 14px; display:grid; gap: 10px; }
.cartRow{ display:flex; justify-content:space-between; gap: 12px; padding: 12px; border: 1px solid var(--stroke); border-radius: 16px; background-color: rgba(255,255,255,.70); }
[data-theme="dark"] .cartRow{ background-color: rgba(15,23,42,.55); }
.cartLeft{ min-width: 0; }
.cartRight{ display:flex; gap: 10px; align-items:center; }
.qty{ width: 78px; height: 38px; border-radius: 12px; border: 1px solid var(--stroke2); padding: 0 10px; font-weight: 950; }
[data-theme="dark"] .qty{ background-color: rgba(15,23,42,.70); color: var(--ink); }
.line{ font-weight: 950; }
.dot{ margin: 0 6px; opacity: .65; }

.divider{ height: 1px; background-color: var(--stroke); margin: 0 14px; }
.sectionTitle{ padding: 14px 14px 0; font-weight: 950; }

/* Payment options: structured grid (touch-friendly) */
.payRow{
  padding: 10px 14px 0;
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.payOpt{
  display:flex;
  gap: 8px;
  align-items:center;
  justify-content:center;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background-color: rgba(148,163,184,.08);
  font-weight: 950;
  cursor:pointer;
  user-select:none;
  white-space: nowrap;
}
.payOpt input{ margin: 0; accent-color: var(--primary); }
.payOpt.on{ border-color: rgba(37,99,235,.35); background-color: rgba(37,99,235,.12); }
[data-theme="dark"] .payOpt.on{ border-color: rgba(59,130,246,.45); background-color: rgba(59,130,246,.18); }

.grid2b{ padding: 10px 14px 14px; display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 620px){ .grid2b{ grid-template-columns: 1fr; } }

.note{ padding: 10px 14px 14px; font-size: 12px; font-weight: 800; color: var(--muted2); line-height: 1.45; }

/* Buttons: structured grid (touch-friendly) */
.btnRow{
  padding: 0 14px 14px;
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.btn{
  height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  font-weight: 950;
  cursor:pointer;
  border: 1px solid var(--stroke);
  background-color: var(--surface-1);
  color: var(--ink);
  box-shadow: var(--shadow-sm);

  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap: 10px;
  white-space: nowrap;
}
.btnRow .btn{ width: 100%; }
.btn:disabled{ opacity:.7; cursor:not-allowed; }
.btnGhost{ background-color: var(--surface-1); }
.btnPrimary{ border: 0; background-color: var(--primary); color:#fff; box-shadow: 0 10px 18px rgba(37,99,235,.18); }
[data-theme="dark"] .btnPrimary{ box-shadow: 0 12px 22px rgba(59,130,246,.20); }

/* Back button: keep arrow + text on one line */
.backBtn{ white-space: nowrap; }
.backIcon{ font-size: 16px; line-height: 1; }
.backText{ line-height: 1; }

.toast{ margin: 10px 14px 14px; padding: 12px 14px; border-radius: 16px; font-weight: 950; border: 1px solid var(--stroke); }
.toast.ok{ background-color: var(--ok-bg); border-color: rgba(22,163,74,.25); color: var(--ok); }
.toast.bad{ background-color: var(--bad-bg); border-color: rgba(220,38,38,.25); color: var(--bad); }

.empty{ padding: 18px 14px; font-weight: 900; color: var(--muted2); text-align:center; }

/* Mobile tuning (iPhone 15 Pro Max and all small screens) */
@media (max-width: 640px){
  .pHeaderText{ min-width: 0; }

  /* Header pills become a clean grid */
  .pHeaderRight{
    width: 100%;
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    justify-content: stretch;
    align-items: stretch;
  }
  .pHeaderRight .pill{ width: 100%; }

  /* Staff + Branch take full width (readable), Items/Total share a row */
  .pHeaderRight .pillWide{
    grid-column: 1 / -1;
    max-width: none;
  }

  .pTitle{ font-size: 22px; }

  /* Payment options: 2-col grid on small screens */
  .payRow{ grid-template-columns: 1fr 1fr; }
  .payOpt.gcash{ grid-column: 1 / -1; }

  /* Action buttons: stack (big tap targets) */
  .btnRow{ grid-template-columns: 1fr; }
}
`;
