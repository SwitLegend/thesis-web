import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function TitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const base = "PilaFree";

    // ✅ Put more specific routes first (important!)
    const rules = [
      { prefix: "/admin/branches", title: "Admin • Branches" },
      { prefix: "/admin/medicines", title: "Admin • Medicines" },
      { prefix: "/admin/users", title: "Admin • Users" },
      { prefix: "/reservations-hub", title: "Reservations" },

      { prefix: "/queue-dashboard", title: "Queue Dashboard" },
      { prefix: "/queue-display", title: "Queue Display" },
      { prefix: "/kiosk", title: "Kiosk" },

      { prefix: "/verify-reservation", title: "Verify Reservation" },
      { prefix: "/reserve", title: "Reserve" },
      { prefix: "/inventory", title: "Inventory" },
      { prefix: "/stock", title: "Stock" },

      { prefix: "/profile", title: "Profile" },

      { prefix: "/admin", title: "Admin" },
      { prefix: "/pharmacist", title: "Pharmacist" },
      { prefix: "/customer", title: "Customer" },

      { prefix: "/dashboard", title: "Dashboard" },
      { prefix: "/login", title: "Login" },
      { prefix: "/unauthorized", title: "Unauthorized" },

      { prefix: "/builder", title: "Builder" },
    ];

    const match = rules.find(
      (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
    );

    document.title = match ? `${base} | ${match.title}` : base;
  }, [pathname]);

  return null;
}
