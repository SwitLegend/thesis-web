// src/pages/CustomerDashboard.jsx
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { motion, useReducedMotion } from "framer-motion";

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
    hidden: { opacity: 0, y: reduce ? 0 : 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce ? { duration: 0 } : { duration: 0.32, ease: easeOut },
    },
  },
  hoverable: reduce
    ? {}
    : {
        whileHover: { y: -2, scale: 1.01 },
        whileTap: { scale: 0.985 },
        transition: { type: "spring", stiffness: 650, damping: 35 },
      },
});

export default function CustomerDashboard() {
  const { profile } = useAuth();
  const reduce = useReducedMotion();
  const m = makeMotion(!!reduce);

  const fullName = profile?.fullName || "Customer";
  const role = String(profile?.role || "customer");

  return (
    <div className="pPage customerDash">
      <style>{css}</style>

      <motion.div className="pShell" variants={m.page} initial="hidden" animate="show">
        {/* Header */}
        <div className="pHeader">
          <div className="pHeaderText">
            <div className="pTitle">Customer Dashboard</div>
            <div className="pSubtitle">Reserve medicines and check stock availability</div>
          </div>

          <div className="pHeaderRight">
            <span className="pill">
              Role: <b>{role}</b>
            </span>
          </div>
        </div>

        {/* Profile Card */}
        <motion.div className="card" variants={m.card}>
          <div className="cardHead">
            <div className="cardTitle">Welcome</div>
            <div className="cardHint">Signed in</div>
          </div>

          <div className="profileRow">
            <div className="avatar" aria-hidden="true">
              {fullName.slice(0, 1).toUpperCase()}
            </div>

            <div className="profileMeta">
              <div className="name">{fullName}</div>
              <div className="roleLine">
                Role: <span className="roleChip">{role}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions (ONLY 2) */}
        <motion.div className="grid" variants={m.item}>
          <DashLink to="/reserve">
            <ActionCard
              icon="🧾"
              title="Reserve Medicines"
              desc="Reserve your medicines and generate a QR/token."
              motionProps={m}
            />
          </DashLink>

          <DashLink to="/stock">
            <ActionCard
              icon="🔎"
              title="Stock Lookup"
              desc="Search medicines and see which branches have stock."
              motionProps={m}
            />
          </DashLink>
        </motion.div>

        <motion.div className="footerHint" variants={m.item}>
          Tip: Use Stock Lookup first to check availability before reserving.
        </motion.div>
      </motion.div>
    </div>
  );
}

function DashLink({ to, children }) {
  return (
    <Link to={to} className="linkReset">
      {children}
    </Link>
  );
}

function ActionCard({ icon, title, desc, motionProps }) {
  const { card, hoverable } = motionProps;

  return (
    <motion.div className="actionCard" variants={card} {...hoverable} role="article">
      <div className="actionTop">
        <div className="actionIcon" aria-hidden="true">
          {icon}
        </div>
        <div className="actionTitle">{title}</div>
      </div>

      <div className="actionDesc">{desc}</div>
      <div className="actionGo">Open →</div>
    </motion.div>
  );
}

const css = `
/* =========================
   Scoped Tokens (Dark Mode Ready)
========================= */
.customerDash{
  --bg0:#ffffff;
  --bg1:#f8fafc;

  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --card: rgba(255,255,255,.86);
  --surface: rgba(255,255,255,.92);
  --surface2: rgba(248,250,252,.92);

  --stroke:#e2e8f0;
  --stroke2:#cbd5e1;
  --divider: rgba(226,232,240,.85);

  --primary:#2563eb;
  --primary-weak: rgba(37,99,235,.12);

  --chipBlue-bg:#eff6ff;
  --chipBlue-stroke:#dbeafe;
  --chipBlue-ink:#1d4ed8;

  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
  --shadow-hover: 0 22px 48px rgba(15,23,42,.10);
}

html.dark .customerDash,
[data-theme="dark"] .customerDash{
  --bg0:#050814;
  --bg1:#0b1022;

  --ink:#e5e7eb;
  --muted:#9ca3af;
  --muted2:#cbd5e1;

  --card: rgba(15,23,42,.78);
  --surface: rgba(2,6,23,.38);
  --surface2: rgba(15,23,42,.55);

  --stroke:#1f2937;
  --stroke2:#334155;
  --divider: rgba(148,163,184,.22);

  --primary:#3b82f6;
  --primary-weak: rgba(59,130,246,.20);

  --chipBlue-bg: rgba(59,130,246,.14);
  --chipBlue-stroke: rgba(59,130,246,.35);
  --chipBlue-ink:#93c5fd;

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
  --shadow-hover: 0 22px 48px rgba(0,0,0,.46);
}

.customerDash,
.customerDash *{ box-sizing:border-box; }

/* =========================
   Page Layout
========================= */
.customerDash.pPage{
  min-height: 100vh;
  width: 100%;
  padding: clamp(16px, 3vw, 32px);
  padding-top: 40px;
  display:flex;
  justify-content:center;
  align-items:flex-start;

  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  color: var(--ink);
  background:
    radial-gradient(1100px 520px at 14% 8%, #eef2ff 0%, rgba(238,242,255,0) 60%),
    radial-gradient(900px 520px at 90% 20%, #eff6ff 0%, rgba(239,246,255,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

html.dark .customerDash.pPage,
[data-theme="dark"] .customerDash.pPage{
  background:
    radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.customerDash .pShell{
  width: min(980px, 100%);
  display:grid;
  gap: 16px;
}

/* =========================
   Header
========================= */
.customerDash .pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;

  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}

.customerDash .pHeaderText{ min-width: 240px; }

.customerDash .pTitle{
  font-size: 26px;
  font-weight: 950;
  letter-spacing: -0.3px;
}

.customerDash .pSubtitle{
  font-size: 13px;
  color: var(--muted2);
  margin-top: 4px;
  font-weight: 750;
  line-height: 1.45;
}

.customerDash .pHeaderRight{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content:flex-end;
}

.customerDash .pill{
  font-size:12px;
  font-weight:950;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
  display:inline-flex;
  align-items:center;
  gap: 6px;
}
.customerDash .pill b{
  text-transform: capitalize;
}

/* Mobile */
@media (max-width: 520px){
  .customerDash.pPage{ padding: 14px; padding-top: 26px; }
  .customerDash .pTitle{ font-size: 20px; }
  .customerDash .pHeaderRight{ width: 100%; justify-content:flex-start; }
}

/* =========================
   Cards
========================= */
.customerDash .card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}

.customerDash .cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin-bottom: 12px;
  gap: 10px;
}

.customerDash .cardTitle{
  font-size: 16px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.customerDash .cardHint{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
}

/* profile */
.customerDash .profileRow{
  display:flex;
  align-items:center;
  gap: 12px;
  flex-wrap:wrap;
}

.customerDash .avatar{
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display:grid;
  place-items:center;
  font-weight: 950;
  background: var(--chipBlue-bg);
  color: var(--chipBlue-ink);
  border: 1px solid var(--chipBlue-stroke);
  box-shadow: 0 12px 18px rgba(59,130,246,.10);
}

.customerDash .profileMeta{ display:grid; gap: 4px; }
.customerDash .name{ font-size: 16px; font-weight: 950; }

.customerDash .roleLine{
  font-size: 13px;
  color: var(--muted2);
  font-weight: 750;
}

.customerDash .roleChip{
  display:inline-block;
  padding: 4px 10px;
  margin-left: 8px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--surface2);
  color: var(--ink);
  font-weight: 950;
  font-size: 12px;
  text-transform: capitalize;
}

/* =========================
   Action Grid
========================= */
.customerDash .grid{
  display:grid;
  gap: 16px;
  align-items: stretch;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.customerDash .linkReset{
  text-decoration:none;
  color: inherit;
  outline: none;
}

.customerDash .linkReset:focus-visible .actionCard{
  box-shadow: 0 0 0 4px var(--primary-weak), var(--shadow);
  border-color: rgba(147,197,253,.85);
}

.customerDash .actionCard{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
  cursor:pointer;
  will-change: transform;
  transition: box-shadow .15s ease, border-color .15s ease, background .15s ease;
}

.customerDash .actionCard:hover{
  box-shadow: var(--shadow-hover);
  border-color: rgba(147,197,253,.55);
}

.customerDash .actionTop{
  display:flex;
  align-items:center;
  gap: 10px;
  margin-bottom: 8px;
}

.customerDash .actionIcon{
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display:grid;
  place-items:center;
  border: 1px solid var(--stroke);
  background: var(--surface);
  font-size: 18px;
  box-shadow: var(--shadow-sm);
}

.customerDash .actionTitle{
  font-size: 16px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.customerDash .actionDesc{
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
  margin-top: 6px;
  font-weight: 750;
}

.customerDash .actionGo{
  margin-top: 12px;
  font-size: 13px;
  font-weight: 950;
  color: var(--primary);
}

/* =========================
   Footer Hint
========================= */
.customerDash .footerHint{
  font-size: 12px;
  color: var(--muted);
  text-align:center;
  padding-top: 6px;
  font-weight: 750;
}
`;
