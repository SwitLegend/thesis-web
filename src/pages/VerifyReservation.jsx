// src/pages/VerifyReservation.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listBranches, listMedicines } from "../services/inventoryService";
import {
  getReservationByToken,
  claimReservationByToken,
  getReservationItems,
} from "../services/reservationService";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const easeOut = [0.16, 1, 0.3, 1];

export default function VerifyReservation() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  // ✅ read query params (?token=...&branchId=...)
  const [sp] = useSearchParams();
  const didInitFromQuery = useRef(false);

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");

  const [meds, setMeds] = useState([]);
  const medsById = useMemo(() => {
    const map = {};
    for (const m of meds) map[m.id] = m;
    return map;
  }, [meds]);

  const [token, setToken] = useState("");
  const [reservation, setReservation] = useState(null);
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [scannerOn, setScannerOn] = useState(false);
  const scannerRef = useRef(null);
  const scannerId = "qr-reader-box";

  useEffect(() => {
    (async () => {
      const b = await listBranches();
      const m = await listMedicines();
      setBranches(b);
      setMeds(m);
      if (b.length) setBranchId(b[0].id);
    })();
  }, []);

  // ✅ Auto-fill from URL query params after branches load
  useEffect(() => {
    if (didInitFromQuery.current) return;
    if (!branches.length) return;

    const qToken = String(sp.get("token") || "").trim();
    const qBranch = String(sp.get("branchId") || "").trim();

    if (!qToken && !qBranch) return;

    didInitFromQuery.current = true;

    if (qBranch) setBranchId(qBranch);
    if (qToken) setToken(qToken);

    // Auto lookup when token exists (use qBranch if present, else default branch)
    if (qToken) {
      const useBranch = qBranch || branches[0]?.id || branchId || "";
      if (useBranch) handleLookup(qToken, useBranch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

  // Stop scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parseQrInput(raw) {
    const clean = String(raw || "").trim();
    if (!clean) return { token: "", branchId: "" };

    // If it's JSON, extract fields
    if (clean.startsWith("{") && clean.endsWith("}")) {
      try {
        const obj = JSON.parse(clean);
        const extractedToken = String(obj?.token || obj?.qrToken || "").trim();
        const extractedBranchId = String(obj?.branchId || "").trim();

        // If it looks like our reservation payload, use it
        if (obj?.type === "reservation" && extractedToken) {
          return { token: extractedToken, branchId: extractedBranchId };
        }

        // If JSON but not our type, still try token keys
        if (extractedToken) return { token: extractedToken, branchId: extractedBranchId };
      } catch {
        // fall through
      }
    }

    // Otherwise treat as plain token string
    return { token: clean, branchId: "" };
  }

  async function stopScanner() {
    try {
      if (scannerRef.current) {
        const s = scannerRef.current;
        scannerRef.current = null;
        await s.stop();
        await s.clear();
      }
    } catch {
      // ignore
    }
  }

  async function startScanner() {
    setMsg("");
    setReservation(null);
    setItems([]);

    try {
      await stopScanner();

      const html5Qr = new Html5Qrcode(scannerId);
      scannerRef.current = html5Qr;

      setScannerOn(true);

      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          const { token: extractedToken, branchId: extractedBranchId } = parseQrInput(decodedText);
          if (!extractedToken) return;

          // Put ONLY the extracted token into the textbox
          setToken(extractedToken);

          // If QR includes branchId, auto-select it
          if (extractedBranchId) setBranchId(extractedBranchId);

          await stopScanner();
          setScannerOn(false);

          // Lookup using extracted values (branch override if provided)
          await handleLookup(extractedToken, extractedBranchId);
        },
        () => {}
      );
    } catch (e) {
      setScannerOn(false);
      setMsg(e?.message || "Failed to start camera. Use HTTPS or localhost.");
    }
  }

  // ✅ Accept raw token OR JSON in the textbox too
  async function handleLookup(input = token, branchOverride = "") {
    setMsg("");
    setReservation(null);
    setItems([]);

    const parsed = parseQrInput(input);
    const useToken = parsed.token;
    const useBranch = branchOverride || parsed.branchId || branchId;

    if (!useBranch) return setMsg("Select a branch first.");
    if (!useToken) return setMsg("Enter or scan a QR token.");

    // If user pasted JSON, replace textbox content with token only
    if (String(input || "").trim() !== useToken) setToken(useToken);
    // If pasted JSON has branchId, auto-set branch dropdown
    if (parsed.branchId && parsed.branchId !== branchId) setBranchId(parsed.branchId);

    try {
      setBusy(true);

      const r = await getReservationByToken({ branchId: useBranch, qrToken: useToken });
      if (!r) {
        setMsg("No reservation found for this token in this branch.");
        return;
      }

      setReservation(r);

      const list = await getReservationItems(r.id);
      setItems(list || []);
    } catch (e) {
      setMsg(e?.message || "Lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClaim() {
    setMsg("");

    const parsed = parseQrInput(token);
    const useToken = parsed.token;
    const useBranch = parsed.branchId || branchId;

    if (!useBranch) return setMsg("Select a branch first.");
    if (!useToken) return setMsg("Enter or scan a QR token.");

    // normalize textbox
    if (token.trim() !== useToken) setToken(useToken);
    if (parsed.branchId && parsed.branchId !== branchId) setBranchId(parsed.branchId);

    try {
      setBusy(true);
      await claimReservationByToken({ branchId: useBranch, qrToken: useToken });

      setMsg("✅ Reservation claimed successfully!");

      // Refresh reservation object (items stay displayed)
      const r = await getReservationByToken({ branchId: useBranch, qrToken: useToken });
      setReservation(r);
    } catch (e) {
      setMsg(e?.message || "Claim failed.");
    } finally {
      setBusy(false);
    }
  }

  const status = reservation?.status || "—";

  function getNiceMedicineName(it) {
    const stored = (it.medicineName || "").trim();
    if (stored) return stored;
    const m = medsById[it.medicineId];
    if (m?.name) return m.name;
    return "Unknown medicine";
  }

  function getNiceSub(it) {
    const m = medsById[it.medicineId];
    const parts = [];
    if (m?.genericName) parts.push(m.genericName);
    const formStrength = [m?.form, m?.strength].filter(Boolean).join(" / ");
    if (formStrength) parts.push(formStrength);
    return parts.join(" • ");
  }

  // ✅ calculate total cost of this reservation
  const totalCost = useMemo(() => {
    return (items || []).reduce((sum, it) => {
      const qty = Number(it.qty) || 0;
      const priceFromItem = Number(it.price) || 0;
      const fallbackPrice = Number(medsById[it.medicineId]?.price) || 0;
      const unitPrice = priceFromItem || fallbackPrice;
      return sum + unitPrice * qty;
    }, 0);
  }, [items, medsById]);

  const hasReservationLoaded = !!reservation;

  const bad =
    String(msg || "").toLowerCase().includes("failed") ||
    String(msg || "").toLowerCase().includes("no ") ||
    String(msg || "").toLowerCase().includes("error");

  const anim = reduce
    ? { transition: { duration: 0 } }
    : { transition: { duration: 0.22, ease: "easeOut" } };

  return (
    <div className="pPage verifyRes">
      <style>{css}</style>

      <motion.div className="vShell" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} {...anim}>
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
              <div className="pTitle">Verify Reservation</div>
              <div className="pSubtitle">Scan QR token or type token to verify/claim</div>
            </div>
          </div>

          <div className="pHeaderRight">
            <span className="pill">
              Status: <b>{status}</b>
            </span>

            <span className="pill" title="Calculated from reservation items">
              Total: <b>{hasReservationLoaded ? `₱${totalCost.toFixed(2)}` : "—"}</b>
            </span>
          </div>
        </div>

        <div className="vGrid">
          {/* Left */}
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="cardTitle">Controls</div>
                <div className="cardHint">Pick branch + scan/token</div>
              </div>
            </div>

            <div className="stack">
              <div className="field">
                <label className="label">Branch</label>
                <select
                  className="control"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={busy}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label">QR Token</label>
                <input
                  className="control"
                  placeholder="Scan QR or type token..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={busy}
                />
                <div className="note" style={{ marginTop: 8 }}>
                  Tip: You can paste the full QR JSON here — it will auto-extract the token.
                </div>
              </div>

              <div className="btnRow">
                <motion.button
                  className="btnPrimary"
                  onClick={() => handleLookup()}
                  disabled={busy || !branchId}
                  whileHover={busy || reduce ? undefined : { scale: 1.02 }}
                  whileTap={busy || reduce ? undefined : { scale: 0.97 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 32 }}
                >
                  {busy ? "Working..." : "Lookup"}
                </motion.button>

                <motion.button
                  className="btnSoft"
                  onClick={startScanner}
                  disabled={busy || !branchId}
                  whileHover={busy || reduce ? undefined : { scale: 1.02 }}
                  whileTap={busy || reduce ? undefined : { scale: 0.97 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 32 }}
                >
                  Open QR Scanner
                </motion.button>

                <motion.button
                  className="btnDanger"
                  onClick={async () => {
                    await stopScanner();
                    setScannerOn(false);
                  }}
                  disabled={!scannerOn}
                  whileHover={!scannerOn || reduce ? undefined : { scale: 1.02 }}
                  whileTap={!scannerOn || reduce ? undefined : { scale: 0.97 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 32 }}
                >
                  Stop Scanner
                </motion.button>
              </div>

              <motion.button
                className="btnHard"
                onClick={handleClaim}
                disabled={busy || !branchId || !token.trim()}
                whileHover={busy || reduce ? undefined : { scale: 1.02 }}
                whileTap={busy || reduce ? undefined : { scale: 0.97 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 32 }}
              >
                {busy ? "Claiming..." : "Claim Reservation"}
              </motion.button>

              <AnimatePresence>
                {msg ? (
                  <motion.div
                    key={msg}
                    className={bad ? "toast bad" : "toast ok"}
                    initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduce ? 0 : 8 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
                  >
                    {msg}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="note">
                ✅ Camera scanning works only on <b>HTTPS</b> or <b>localhost</b>.
                <br />
                If you open your app on your phone using <b>http://192.168.x.x</b>, the camera may be
                blocked.
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="cardTitle">Scanner / Result</div>
                <div className="cardHint">Scan then auto-lookup</div>
              </div>
            </div>

            {/* Scanner */}
            <div className="scannerWrap">
              <div id={scannerId} className="scannerBox" />
              {!scannerOn ? (
                <div className="scannerOverlay">
                  Scanner is OFF. Tap <b>Open QR Scanner</b>.
                </div>
              ) : null}
            </div>

            {/* Details */}
            <div className="section">
              <div className="sectionTitle">Reservation Details</div>

              {reservation ? (
                <div className="detailBox">
                  <div className="detailRow">
                    <span className="k">Customer</span>
                    <span className="v">{reservation.customerName || "—"}</span>
                  </div>
                  <div className="detailRow">
                    <span className="k">Phone</span>
                    <span className="v">{reservation.customerPhone || "—"}</span>
                  </div>
                  <div className="detailRow">
                    <span className="k">Token</span>
                    <span className="vMono">{reservation.qrToken}</span>
                  </div>
                  <div className="detailRow">
                    <span className="k">Total Qty</span>
                    <span className="v">{reservation.totalQty ?? "—"}</span>
                  </div>

                  <div className="detailRow">
                    <span className="k">Total Cost</span>
                    <span className="v">₱{totalCost.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="empty">
                  No reservation loaded yet. Scan or type a token then press Lookup.
                </div>
              )}

              {items?.length ? (
                <>
                  <div className="sectionTitle" style={{ marginTop: 12 }}>
                    Reserved Items
                  </div>

                  <div className="itemsBox">
                    {items.map((it) => {
                      const name = getNiceMedicineName(it);
                      const sub = getNiceSub(it);

                      const qty = Number(it.qty) || 0;
                      const priceFromItem = Number(it.price) || 0;
                      const fallbackPrice = Number(medsById[it.medicineId]?.price) || 0;
                      const unitPrice = priceFromItem || fallbackPrice;
                      const lineTotal = unitPrice * qty;

                      return (
                        <div key={it.id} className="itemRow">
                          <div className="itemLeft">
                            <div className="itemName">{name}</div>
                            <div className="itemSub">{sub ? sub : it.medicineId}</div>
                          </div>

                          <div className="itemRight">
                            <div className="qty">x{qty}</div>
                            <div className="price">
                              ₱{unitPrice.toFixed(2)}
                              <span className="dot">•</span>
                              Line: ₱{lineTotal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const css = `
/* =========================
   Scoped Tokens
========================= */
.verifyRes{
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

  --warn-ink:#b91c1c;

  --pill-bg: var(--surface);
  --pill-ink:#334155;

  --hard-bg:#eff6ff;
  --hard-stroke:#dbeafe;
  --hard-ink:#1d4ed8;

  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

html.dark .verifyRes,
[data-theme="dark"] .verifyRes{
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

  --warn-ink:#fca5a5;

  --pill-bg: var(--surface2);
  --pill-ink: var(--muted2);

  --hard-bg: rgba(59,130,246,.16);
  --hard-stroke: rgba(59,130,246,.35);
  --hard-ink: #93c5fd;

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

.verifyRes *{ box-sizing:border-box; }

/* =========================
   Page
========================= */
.verifyRes.pPage{
  min-height:100vh;
  width:100%;
  padding: clamp(14px, 3vw, 26px);
  padding-top: 40px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  color: var(--ink);

  background:
    radial-gradient(1200px 600px at 20% 10%, #eef2ff 0%, rgba(238,242,255,0) 50%),
    radial-gradient(900px 540px at 92% 18%, #eff6ff 0%, rgba(239,246,255,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

html.dark .verifyRes.pPage,
[data-theme="dark"] .verifyRes.pPage{
  background:
    radial-gradient(900px 540px at 20% 10%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 540px at 92% 18%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.verifyRes .vShell{
  max-width: 1120px;
  margin: 0 auto;
  display:grid;
  gap: 16px;
}

/* =========================
   Header (scoped)
========================= */
.verifyRes .pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}
.verifyRes .pHeaderLeft{
  display:flex;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
  min-width: 0;
}
.verifyRes .pHeaderText{
  min-width: 240px;
  display:grid;
  gap: 6px;
  min-width: 0;
}
.verifyRes .pTitle{
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.2px;
}
.verifyRes .pSubtitle{
  font-size: 13px;
  color: var(--muted2);
  font-weight: 750;
  line-height: 1.45;
}
.verifyRes .pHeaderRight{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap:wrap;
  justify-content:flex-end;
}

.verifyRes .pill{
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
}

/* =========================
   Base button (scoped)
========================= */
.verifyRes .btn{
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
.verifyRes .btn:disabled{ opacity:.7; cursor:not-allowed; }
.verifyRes .btnGhost{
  border-color: var(--stroke);
  background: var(--surface);
}

/* =========================
   Grid
========================= */
.verifyRes .vGrid{
  display:grid;
  grid-template-columns: 380px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 980px){
  .verifyRes .vGrid{ grid-template-columns: 1fr; }
  .verifyRes .pTitle{ font-size: 20px; }
}

/* =========================
   Cards
========================= */
.verifyRes .card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(6px);
  min-width: 0;
}
.verifyRes .cardHead{
  display:flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.verifyRes .cardTitle{ font-size: 14px; font-weight: 900; }
.verifyRes .cardHint{ font-size: 12px; color: var(--muted); font-weight: 800; }

/* =========================
   Controls
========================= */
.verifyRes .stack{ display:grid; gap: 12px; }
.verifyRes .field{ display:grid; gap: 6px; min-width: 0; }
.verifyRes .label{ font-size: 12px; color: var(--muted2); font-weight: 900; }

.verifyRes .control{
  height: 42px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline: none;
  background: var(--surface);
  color: var(--ink);
  font-size: 14px;
  font-weight: 800;
  width: 100%;
  min-width: 0;
}
.verifyRes .control::placeholder{ color: var(--muted); font-weight: 800; }
.verifyRes .control:focus{
  border-color: #93c5fd;
  box-shadow: 0 0 0 4px var(--primary-weak);
}

/* consistent button alignment across desktop + mobile */
.verifyRes .btnRow{
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
}
.verifyRes .btnRow > :nth-child(3){ grid-column: 1 / -1; }
@media (max-width: 520px){
  .verifyRes .btnRow{ grid-template-columns: 1fr; }
  .verifyRes .btnRow > :nth-child(3){ grid-column: auto; }
}

/* unified control buttons */
.verifyRes .btnPrimary,
.verifyRes .btnSoft,
.verifyRes .btnDanger,
.verifyRes .btnHard{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 950;
  line-height: 1.15;
  border: 1px solid transparent;
  box-sizing: border-box;
}

.verifyRes .btnPrimary{
  background: var(--primary);
  color:#fff;
  box-shadow: 0 10px 18px rgba(37,99,235,.16);
}
html.dark .verifyRes .btnPrimary,
[data-theme="dark"] .verifyRes .btnPrimary{
  box-shadow: 0 16px 30px rgba(59,130,246,.16);
}

.verifyRes .btnSoft{
  background: var(--surface);
  color: var(--ink);
  border-color: var(--stroke);
}

.verifyRes .btnDanger{
  background: var(--surface);
  color: var(--warn-ink);
  border-color: var(--bad-stroke);
}

.verifyRes .btnHard{
  background: var(--hard-bg);
  color: var(--hard-ink);
  border-color: var(--hard-stroke);
}

.verifyRes .toast{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid;
  font-size: 13px;
  font-weight: 950;
  background: var(--surface);
}
.verifyRes .toast.ok{ background: var(--ok-bg); border-color: var(--ok-stroke); color: var(--ok-ink); }
.verifyRes .toast.bad{ background: var(--bad-bg); border-color: var(--bad-stroke); color: var(--bad-ink); }

.verifyRes .note{
  font-size: 12px;
  color: var(--muted);
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  padding: 12px;
  border-radius: 14px;
  line-height: 1.55;
  font-weight: 800;
}

/* =========================
   Scanner
========================= */
.verifyRes .scannerWrap{
  margin-top: 6px;
  position: relative;
  border-radius: 16px;
  border: 1px solid var(--stroke);
  overflow: hidden;
  background: var(--surface);
}
.verifyRes .scannerBox{
  width: 100%;
  min-height: 320px;
}
@media (max-width: 520px){
  .verifyRes .scannerBox{ min-height: 260px; }
}
.verifyRes .scannerOverlay{
  position:absolute;
  inset:0;
  display:grid;
  place-items:center;
  text-align:center;
  padding: 14px;
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  font-weight: 950;
  color: var(--pill-ink);
}

/* =========================
   Sections / Details
========================= */
.verifyRes .section{ margin-top: 14px; }
.verifyRes .sectionTitle{ font-size: 12px; font-weight: 950; color: var(--pill-ink); }

.verifyRes .detailBox{
  margin-top: 10px;
  border: 1px solid var(--stroke);
  border-radius: 16px;
  background: var(--surface);
  padding: 12px;
  display:grid;
  gap: 8px;
}
.verifyRes .detailRow{
  display:flex;
  justify-content: space-between;
  gap: 10px;
}
.verifyRes .k{ font-size: 12px; color: var(--muted); font-weight: 950; }
.verifyRes .v{ font-size: 13px; font-weight: 950; color: var(--ink); }
.verifyRes .vMono{
  font-size: 12px;
  font-weight: 950;
  color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.verifyRes .empty{
  margin-top: 10px;
  padding: 14px;
  border-radius: 16px;
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  color: var(--muted);
  font-weight: 950;
  text-align:center;
}

/* =========================
   Items
========================= */
.verifyRes .itemsBox{
  margin-top: 10px;
  border: 1px solid var(--stroke);
  border-radius: 16px;
  background: var(--surface);
  overflow: hidden;
}
.verifyRes .itemRow{
  display:flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid var(--divider);
  align-items: center;
}
.verifyRes .itemLeft{ display:grid; gap: 4px; min-width: 0; }
.verifyRes .itemName{
  font-weight: 950;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.verifyRes .itemSub{
  font-size: 12px;
  color: var(--muted);
  font-weight: 850;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.verifyRes .itemRight{
  display:grid;
  justify-items: end;
  gap: 2px;
}
.verifyRes .qty{ font-weight: 950; color: var(--ink); }
.verifyRes .price{ font-size: 12px; color: var(--muted2); font-weight: 950; }
.verifyRes .dot{ margin: 0 6px; color: var(--stroke2); }
`;
