// src/components/Toaster.jsx
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useToasts } from "../hooks/useToasts";

export default function Toaster() {
  const { toasts, dismissToast } = useToasts();
  const reduce = useReducedMotion();

  return (
    <div className="toastViewport" aria-live="polite" aria-relevant="additions removals">
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={`toastCard kind-${t.kind || "info"}`}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: -10, scale: 0.98, filter: "blur(6px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98, filter: "blur(6px)" }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 520, damping: 38, mass: 0.9 }
            }
            role="status"
          >
            <div className="toastIcon" aria-hidden="true">
              {t.icon}
            </div>

            <div className="toastBody">
              <div className="toastTitle">{t.title}</div>
              {t.message ? <div className="toastMsg">{t.message}</div> : null}
              {t.action?.label ? (
                <button
                  className="toastAction"
                  type="button"
                  onClick={() => {
                    try {
                      t.action?.onClick?.();
                    } finally {
                      dismissToast(t.id);
                    }
                  }}
                >
                  {t.action.label}
                </button>
              ) : null}
            </div>

            <button
              className="toastClose"
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              title="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
