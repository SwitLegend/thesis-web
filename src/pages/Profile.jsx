// src/pages/Profile.jsx
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
    show: { opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { duration: 0.32, ease: easeOut } },
  },
});

export default function Profile() {
  const { user, profile } = useAuth();
  const reduce = useReducedMotion();
  const m = makeMotion(!!reduce);

  const name = profile?.fullName || "—";
  const email = profile?.email || user?.email || "—";
  const role = profile?.role || "—";
  const branch = profile?.branchName || profile?.branch || "—";

  const dashByRole =
    role === "admin"
      ? "/admin"
      : role === "pharmacist"
      ? "/pharmacist"
      : role === "customer"
      ? "/customer"
      : "/dashboard";

  return (
    <div className="pPage">
      <style>{css}</style>

      <motion.div className="pShell" variants={m.page} initial="hidden" animate="show">
        <div className="pHeader">
          <div className="pHeaderText">
            <div className="pTitle">Profile</div>
            <div className="pSubtitle">Your account details</div>
          </div>

          <div className="pHeaderRight">
            <Link className="btn" to={dashByRole}>
              Back to Dashboard
            </Link>
          </div>
        </div>

        <motion.div className="card" variants={m.card}>
          <div className="cardHead">
            <div className="cardTitle">Account</div>
            <div className="cardHint">Signed in</div>
          </div>

          <div className="rows">
            <div className="row">
              <div className="k">Full Name</div>
              <div className="v">{name}</div>
            </div>
            <div className="row">
              <div className="k">Email</div>
              <div className="v">{email}</div>
            </div>
            <div className="row">
              <div className="k">Role</div>
              <div className="v">
                <span className="chip">{role}</span>
              </div>
            </div>
            <div className="row">
              <div className="k">Branch</div>
              <div className="v">{branch}</div>
            </div>
          </div>

          <div className="hint">
            Tip: use the top-right menu to switch theme or sign out.
          </div>
        </motion.div>

        <motion.div className="grid" variants={m.item}>
          <Link to="/stock" className="linkReset">
            <div className="miniCard">
              <div className="miniTitle">Stock Lookup</div>
              <div className="miniDesc">Read-only medicine availability</div>
              <div className="miniGo">Open →</div>
            </div>
          </Link>

          <Link to="/reserve" className="linkReset">
            <div className="miniCard">
              <div className="miniTitle">Reserve Medicines</div>
              <div className="miniDesc">Generate a QR reservation</div>
              <div className="miniGo">Open →</div>
            </div>
          </Link>

          <Link to="/verify-reservation" className="linkReset">
            <div className="miniCard">
              <div className="miniTitle">Verify Reservation</div>
              <div className="miniDesc">Staff: scan QR/token</div>
              <div className="miniGo">Open →</div>
            </div>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

const css = `
:root{
  --bg0:#ffffff;
  --bg1:#f8fafc;

  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --card: rgba(255,255,255,.86);
  --stroke:#e2e8f0;
  --stroke2:#cbd5e1;

  --primary:#2563eb;
  --primary-weak: rgba(37,99,235,.12);

  --radius: 18px;
  --radius-sm: 14px;
  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

[data-theme="dark"]{
  --bg0:#050814;
  --bg1:#0b1022;

  --ink:#e5e7eb;
  --muted:#9ca3af;
  --muted2:#cbd5e1;

  --card: rgba(15,23,42,.78);
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

[data-theme="dark"] .pPage{
  background:
    radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.pShell{
  width: min(920px, 100%);
  display:grid;
  gap: 16px;
}

.pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(226,232,240,.85);
}
[data-theme="dark"] .pHeader{
  border-bottom-color: rgba(51,65,85,.75);
}

.pHeaderText{ min-width: 240px; }
.pTitle{ font-size: 26px; font-weight: 950; letter-spacing: -0.3px; }
.pSubtitle{ font-size: 13px; color: var(--muted2); margin-top: 4px; font-weight: 750; line-height: 1.45; }

.pHeaderRight{ display:flex; align-items:center; gap: 10px; }

.btn{
  height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  font-weight: 950;
  cursor:pointer;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,.92);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
[data-theme="dark"] .btn{
  background: rgba(15,23,42,.65);
}

.card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}

.cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin-bottom: 12px;
  gap: 10px;
}
.cardTitle{ font-size: 16px; font-weight: 950; letter-spacing: -0.2px; }
.cardHint{ font-size: 12px; color: var(--muted); font-weight: 800; }

.rows{ display:grid; gap: 10px; }
.row{
  display:flex;
  justify-content:space-between;
  gap: 14px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(226,232,240,.85);
  background: rgba(255,255,255,.55);
}
[data-theme="dark"] .row{
  border-color: rgba(51,65,85,.70);
  background: rgba(2,6,23,.25);
}
.k{ color: var(--muted2); font-weight: 850; font-size: 13px; }
.v{ font-weight: 950; font-size: 13px; text-align:right; }

.chip{
  display:inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: rgba(248,250,252,.95);
  font-weight: 950;
  font-size: 12px;
  text-transform: capitalize;
}
[data-theme="dark"] .chip{
  background: rgba(15,23,42,.65);
}

.hint{
  margin-top: 12px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 750;
}

.grid{
  display:grid;
  gap: 16px;
  align-items: stretch;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.linkReset{
  text-decoration:none;
  color: inherit;
}

.miniCard{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
  cursor:pointer;
  transition: transform .12s ease, box-shadow .15s ease;
}
.miniCard:hover{
  transform: translateY(-2px);
  box-shadow: 0 22px 48px rgba(15,23,42,.10);
}
.miniTitle{ font-size: 15px; font-weight: 950; }
.miniDesc{ font-size: 13px; color: var(--muted); font-weight: 750; margin-top: 6px; }
.miniGo{ margin-top: 12px; font-size: 13px; font-weight: 950; color: var(--primary); }
`;
