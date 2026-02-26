// src/components/NotificationCenter.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useToasts } from "../hooks/useToasts";

const easeOut = [0.16, 1, 0.3, 1];

export default function NotificationCenter({ onOpen } = {}) {
  const {
    notifications,
    unreadCount,
    markAllRead,
    markRead,
    clearNotifications,
    formatRelative,
  } = useToasts();

  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onDown);
    };
  }, [open]);

  const badgeText = useMemo(() => {
    if (!unreadCount) return "";
    return unreadCount > 99 ? "99+" : String(unreadCount);
  }, [unreadCount]);

  return (
    <div className="notifWrap" ref={ref}>
      <button
        className={"iconBtn iconOnly notifBtn" + (open ? " isOpen" : "")}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) onOpen?.();
            return next;
          });
        }}
        aria-label="Notifications"
        aria-expanded={open ? "true" : "false"}
        title="Notifications"
      >
        {/* ✅ Swap SVG to emoji */}
        <span className="notifEmoji" aria-hidden="true">
          🔔
        </span>

        {unreadCount > 0 ? (
          <span className="notifBadge">{badgeText}</span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="notifBackdrop"
              initial={reduce ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={
                reduce ? { duration: 0 } : { duration: 0.16, ease: easeOut }
              }
              onClick={() => setOpen(false)}
            />

            <motion.div
              className="notifCard"
              initial={
                reduce
                  ? { opacity: 1 }
                  : { opacity: 0, y: -8, scale: 0.98, filter: "blur(8px)" }
              }
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: -6, scale: 0.98, filter: "blur(8px)" }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 520, damping: 40, mass: 0.9 }
              }
              role="dialog"
              aria-label="Notification center"
            >
              <div className="notifHead">
                <div>
                  <div className="notifTitle">Notifications</div>
                  <div className="notifSub">
                    {unreadCount ? `${unreadCount} unread` : "All caught up"}
                  </div>
                </div>

                <div className="notifHeadActions">
                  <button
                    className="notifHeadBtn"
                    type="button"
                    onClick={markAllRead}
                  >
                    Mark read
                  </button>
                  <button
                    className="notifHeadBtn"
                    type="button"
                    onClick={clearNotifications}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="notifList" role="list">
                {notifications.length === 0 ? (
                  <div className="notifEmpty">
                    <div className="notifEmptyIcon" aria-hidden="true">
                      🔔
                    </div>
                    <div className="notifEmptyTitle">No notifications yet</div>
                    <div className="notifEmptySub">
                      Queue updates, reservations, and low stock warnings will
                      appear here.
                    </div>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      className={"notifItem" + (n.read ? "" : " unread")}
                      type="button"
                      role="listitem"
                      onClick={() => {
                        markRead(n.id);
                        if (n.href) navigate(n.href);
                        setOpen(false);
                      }}
                    >
                      <div className="notifIcon" aria-hidden="true">
                        {n.icon || "🔔"}
                      </div>

                      <div className="notifBody">
                        <div className="notifRow">
                          <div className="notifItemTitle">{n.title}</div>
                          <div className="notifTime">
                            {formatRelative(n.createdAt)}
                          </div>
                        </div>
                        {n.message ? (
                          <div className="notifMsg">{n.message}</div>
                        ) : null}
                      </div>

                      {!n.read ? (
                        <span className="notifDot" aria-hidden="true" />
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
