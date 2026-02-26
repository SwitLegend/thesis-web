// src/components/Topbar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../services/auth";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import NotificationCenter from "./NotificationCenter";

function initialsFrom(nameOrEmail = "") {
  const s = String(nameOrEmail).trim();
  if (!s) return "U";
  if (s.includes("@")) return s[0].toUpperCase();
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "U";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function roleLabel(role) {
  const r = (role || "").toLowerCase();
  if (!r) return "Account";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/**
 * React Router v6 NavLink matches by prefix by default.
 * Use end:true for root dashboards so "Dashboard" doesn't stay active.
 */
function linksForRole(role) {
  switch (role) {
    case "admin":
      return [
        { to: "/admin", label: "Dashboard", end: true },
        { to: "/admin/branches", label: "Branches" },
        { to: "/admin/medicines", label: "Medicines" },
        { to: "/inventory", label: "Inventory" },
        { to: "/reservations-hub", label: "Reservations" },
        { to: "/queue-dashboard", label: "Queue" },
        { to: "/stock", label: "Stock Lookup" },
      ];
    case "pharmacist":
      return [
        { to: "/pharmacist", label: "Dashboard", end: true },
        { to: "/queue-dashboard", label: "Queue" },
        { to: "/verify-reservation", label: "Verify" },
        { to: "/inventory", label: "Inventory" },
        { to: "/reservations-hub", label: "Reservations" },
        { to: "/stock", label: "Stock Lookup" },
      ];
    case "customer":
      return [
        { to: "/customer", label: "Home", end: true },
        { to: "/reserve", label: "Reserve" },
        { to: "/stock", label: "Stock Lookup" },
      ];
    case "kiosk":
      return [
        { to: "/kiosk", label: "Kiosk", end: true },
        { to: "/queue-display", label: "Display" },
      ];
    case "display":
      return [{ to: "/queue-display", label: "Queue Display", end: true }];
    default:
      return [{ to: "/dashboard", label: "Dashboard", end: true }];
  }
}

export default function Topbar({
  brand = "PMS",
  links,
  showNav = true,
  showTheme = true,
  showNotifications = true,
  showUserMenu = true,
}) {
  const { user, profile, loading } = useAuth();
  const role = profile?.role || "guest";

  const computedLinks = useMemo(
    () => (links ? links : linksForRole(role)),
    [links, role]
  );

  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  const displayName =
    profile?.fullName ||
    profile?.name ||
    profile?.email ||
    user?.displayName ||
    user?.email ||
    "Guest";

  const avatarText = initialsFrom(displayName);

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onDown(e) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
        return;
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  // =========================================================
  // ✅ Notification visibility rules:
  // - Hidden on /login
  // - Only visible for role: admin or pharmacist
  // - Hidden for: display, kiosk, customer (covered by allowlist)
  // =========================================================
  const isLoginPage =
    location.pathname === "/login" || location.pathname.startsWith("/login/");

  const roleCanSeeNotifications =
    !!profile && (role === "admin" || role === "pharmacist");

  const shouldShowNotifications =
    showNotifications && !!user && !loading && !isLoginPage && roleCanSeeNotifications;

  return (
    <header className="topbar" role="banner">
      <div className="topbarInner">
        <div className="topbarLeft">
          <Link className="brand" to={user ? "/dashboard" : "/login"}>
            <span className="brandMark" aria-hidden="true">
              💊
            </span>
            <span className="brandText">{brand}</span>
          </Link>

          {showNav && (
            <nav className="topbarNav desktopOnly" aria-label="Primary">
              {computedLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={Boolean(l.end)}
                  className={({ isActive }) =>
                    "navLink" + (isActive ? " active" : "")
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <div className="topbarRight">
          {/* Mobile menu button */}
          {showNav && (
            <button
              className={
                "iconBtn iconOnly iconBtnMenu mobileOnly" +
                (mobileOpen ? " isOpen" : "")
              }
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen ? "true" : "false"}
              aria-controls="mobileNav"
              onClick={() =>
                setMobileOpen((v) => {
                  const next = !v;
                  if (next) setMenuOpen(false);
                  return next;
                })
              }
            >
              <span className="hamburger" aria-hidden="true">
                <span className="bar" />
                <span className="bar" />
                <span className="bar" />
              </span>
              <span className="srOnly">
                {mobileOpen ? "Close menu" : "Open menu"}
              </span>
            </button>
          )}

          {/* ✅ Notifications (only when allowed) */}
          {shouldShowNotifications && (
            <NotificationCenter
              onOpen={() => {
                setMenuOpen(false);
                setMobileOpen(false);
              }}
            />
          )}

          {/* Theme button */}
          {showTheme && (
            <button
              className="iconBtn iconOnly"
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === "dark" ? "🌙" : "☀️"}
              <span className="srOnly">Toggle theme</span>
            </button>
          )}

          {/* User menu */}
          {showUserMenu && (
            <div className="userMenu" ref={menuRef}>
              <button
                className="userBtn"
                type="button"
                onClick={() =>
                  setMenuOpen((v) => {
                    const next = !v;
                    if (next) setMobileOpen(false);
                    return next;
                  })
                }
                aria-expanded={menuOpen ? "true" : "false"}
                aria-label="Account menu"
                title="Account"
              >
                <span className="avatar" aria-hidden="true">
                  {avatarText}
                </span>

                <span className="userMeta desktopOnly">
                  <span className="userRole">{roleLabel(role)}</span>
                  <span className="userName">
                    {loading ? "Loading…" : displayName}
                  </span>
                </span>

                <span className="caret" aria-hidden="true">
                  ▾
                </span>
              </button>

              {menuOpen && (
                <div className="menuCard" role="menu">
                  <div className="menuTop">
                    <div className="menuName">{displayName}</div>
                    <div className="menuSub">
                      {roleLabel(role)}
                      {profile?.branchName ? ` • ${profile.branchName}` : ""}
                    </div>
                  </div>

                  <div className="menuDivider" />

                  <button
                    className="menuItem"
                    type="button"
                    onClick={() => navigate("/profile")}
                    role="menuitem"
                  >
                    Profile
                  </button>

                

                  <div className="menuDivider" />

                  {user ? (
                    <button
                      className="menuItem danger"
                      type="button"
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  ) : (
                    <button
                      className="menuItem"
                      type="button"
                      onClick={() => navigate("/login")}
                      role="menuitem"
                    >
                      Sign in
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      {showNav && mobileOpen && (
        <>
          <div
            className="mobileBackdrop"
            role="presentation"
            onClick={() => setMobileOpen(false)}
          />
          <nav id="mobileNav" className="mobileNav" aria-label="Mobile">
            {computedLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={Boolean(l.end)}
                className={({ isActive }) =>
                  "mobileLink" + (isActive ? " active" : "")
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
