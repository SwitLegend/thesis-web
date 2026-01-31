// src/pages/AdminDashboard.jsx
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

export default function AdminDashboard() {
  const { profile } = useAuth();
  const reduce = useReducedMotion();
  const m = makeMotion(!!reduce);

  return (
    <div className="pPage adminDash">
      <style>{css}</style>

      <motion.div className="pShell" variants={m.page} initial="hidden" animate="show">
        <div className="pHeader">
          <div className="pHeaderText">
            <div className="pTitle">Admin Dashboard</div>
            <div className="pSubtitle">Manage branches, medicines, inventory, and queues</div>
          </div>
          <div className="pHeaderRight" />
        </div>

        <motion.div className="card" variants={m.card}>
          <div className="cardHead">
            <div className="cardTitle">Welcome</div>
            <div className="cardHint">Signed in</div>
          </div>

          <div className="profileRow">
            <div className="dashAvatar" aria-hidden="true">
              {(profile?.fullName || "Admin").slice(0, 1).toUpperCase()}
            </div>

            <div className="profileMeta">
              <div className="dashName">{profile?.fullName || "Admin"}</div>
              <div className="roleLine">
                Role: <span className="roleChip">{profile?.role || "admin"}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div className="grid" variants={m.item}>
          <DashLink to="/admin/branches">
            <ActionCard icon="🏢" title="Branches" desc="Add/edit branches and manage locations." motionProps={m} />
          </DashLink>

          <DashLink to="/admin/medicines">
            <ActionCard icon="💊" title="Medicines" desc="Add medicines and update branch stocks." motionProps={m} />
          </DashLink>

          <DashLink to="/inventory">
            <ActionCard icon="📦" title="Inventory" desc="View current stock levels per branch." motionProps={m} />
          </DashLink>
<DashLink to="/reservations-hub">
            <ActionCard
              icon="🗂️"
              title="Reservations Hub"
              desc="Manage active, finished, and archived tasks."
              motionProps={m}
            />
          </DashLink>
          <DashLink to="/kiosk">
            <ActionCard icon="🎫" title="Queue Kiosk" desc="Customer kiosk: tap to join the queue." motionProps={m} />
          </DashLink>
<DashLink to="/stock">
            <ActionCard
              icon="🔎"
              title="Stock Lookup"
              desc="Check medicine availability across branches."
              motionProps={m}
            />
          </DashLink>
          <DashLink to="/queue-dashboard">
            <ActionCard icon="🧑‍⚕️" title="Queue Dashboard" desc="Waiting area display: Serving & Next." motionProps={m} />
          </DashLink>

          <DashLink to="/queue-display">
            <ActionCard icon="🖥️" title="Queue Display" desc="TV view for waiting area: shows serving/next." motionProps={m} />
          </DashLink>

          <DashLink to="/reserve">
            <ActionCard icon="🧾" title="Reserve Medicines" desc="Customer page: reserve meds + generate QR." motionProps={m} />
          </DashLink>

          <DashLink to="/verify-reservation">
            <ActionCard icon="✅" title="Verify Reservation" desc="Scan & Claim: Reservations." motionProps={m} />
          </DashLink>


          <DashLink to="/admin/users">
            <ActionCard icon="👤" title="User Accounts" desc="Manage users and role assignments." motionProps={m} />
          </DashLink>
        </motion.div>

        <motion.div className="footerHint" variants={m.item}>
          Tip: Use Queue Display on a TV/monitor so customers can see updates live.
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
    <motion.div className="actionCard" variants={card} {...hoverable}>
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
   Scoped Dashboard Tokens
   (no global :root collisions)
========================= */
.adminDash{
  --bg0:#ffffff;
  --bg1:#f8fafc;

  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --card: rgba(255,255,255,.86);
  --stroke:#e2e8f0;
  --stroke2:#cbd5e1;
  --divider: rgba(226,232,240,.85);

  --primary:#2563eb;
  --primary-weak: rgba(37,99,235,.12);

  --btn-bg: rgba(255,255,255,.92);

  --chip-bg: rgba(248,250,252,.95);

  --icon-bg: rgba(255,255,255,.94);
  --icon-stroke: rgba(226,232,240,.95);

  --avatar-bg: rgba(37, 99, 235, 0.14);
  --avatar-ink: #1d4ed8;
  --avatar-stroke: rgba(37, 99, 235, 0.28);

  --radius: 18px;
  --radius-sm: 14px;

  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

[data-theme="dark"] .adminDash{
  --bg0:#050814;
  --bg1:#0b1022;

  --ink:#e5e7eb;
  --muted:#9ca3af;
  --muted2:#cbd5e1;

  --card: rgba(15,23,42,.78);
  --stroke:#1f2937;
  --stroke2:#334155;
  --divider: rgba(148,163,184,.22);

  --primary:#3b82f6;
  --primary-weak: rgba(59,130,246,.20);

  --btn-bg: rgba(15,23,42,.68);

  --chip-bg: rgba(15,23,42,.55);

  --icon-bg: rgba(15,23,42,.62);
  --icon-stroke: rgba(226,232,240,.14);

  --avatar-bg: rgba(59,130,246,.18);
  --avatar-ink: #93c5fd;
  --avatar-stroke: rgba(59,130,246,.35);

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

*{ box-sizing:border-box; }
@media (prefers-reduced-motion: reduce){
  *{ scroll-behavior:auto !important; }
}

/* =========================
   Layout
========================= */
.adminDash.pPage{
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

[data-theme="dark"] .adminDash.pPage{
  background:
    radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.adminDash .pShell{
  width: min(980px, 100%);
  display:grid;
  gap: 16px;
}

/* =========================
   Header
========================= */
.adminDash .pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;

  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}

.adminDash .pHeaderText{ min-width: 240px; }

.adminDash .pTitle{
  font-size: 26px;
  font-weight: 950;
  letter-spacing: -0.3px;
}

.adminDash .pSubtitle{
  font-size: 13px;
  color: var(--muted2);
  margin-top: 4px;
  font-weight: 750;
  line-height: 1.45;
}

/* =========================
   Cards
========================= */
.adminDash .card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}

.adminDash .cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin-bottom: 12px;
  gap: 10px;
}

.adminDash .cardTitle{ font-size: 16px; font-weight: 950; letter-spacing: -0.2px; }
.adminDash .cardHint{ font-size: 12px; color: var(--muted); font-weight: 800; }

.adminDash .profileRow{
  display:flex;
  align-items:center;
  gap: 12px;
  flex-wrap:wrap;
}

.adminDash .dashAvatar{
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display:grid;
  place-items:center;
  font-weight: 950;
  background: var(--avatar-bg);
  color: var(--avatar-ink);
  border: 1px solid var(--avatar-stroke);
  box-shadow: 0 12px 18px rgba(59,130,246,.10);
}

.adminDash .profileMeta{
  display:grid;
  gap: 4px;
}

.adminDash .dashName{ font-size: 16px; font-weight: 950; }
.adminDash .roleLine{ font-size: 13px; color: var(--muted2); font-weight: 750; }

.adminDash .roleChip{
  display:inline-block;
  padding: 4px 10px;
  margin-left: 8px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--chip-bg);
  color: var(--ink);
  font-weight: 950;
  font-size: 12px;
  text-transform: capitalize;
}

/* =========================
   Action Grid
========================= */
.adminDash .grid{
  display:grid;
  gap: 16px;
  align-items: stretch;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.adminDash .linkReset{
  text-decoration:none;
  color: inherit;
}

.adminDash .actionCard{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
  cursor:pointer;
  will-change: transform;
  transition: box-shadow .15s ease;
}

.adminDash .actionCard:hover{
  box-shadow: 0 22px 48px rgba(15,23,42,.10);
}

[data-theme="dark"] .adminDash .actionCard:hover{
  box-shadow: 0 22px 48px rgba(0,0,0,.35);
}

.adminDash .actionTop{
  display:flex;
  align-items:center;
  gap: 10px;
  margin-bottom: 8px;
}

.adminDash .actionIcon{
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display:grid;
  place-items:center;
  border: 1px solid var(--icon-stroke);
  background: var(--icon-bg);
  font-size: 18px;
  box-shadow: var(--shadow-sm);
}

.adminDash .actionTitle{
  font-size: 16px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.adminDash .actionDesc{
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
  margin-top: 6px;
  font-weight: 750;
}

.adminDash .actionGo{
  margin-top: 12px;
  font-size: 13px;
  font-weight: 950;
  color: var(--primary);
}

/* =========================
   Footer Hint
========================= */
.adminDash .footerHint{
  font-size: 12px;
  color: var(--muted);
  text-align:center;
  padding-top: 6px;
  font-weight: 750;
}
`;
