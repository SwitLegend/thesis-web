// src/components/AppShell.jsx
import React from "react";
import Topbar from "./Topbar";

export default function AppShell({ children, topbarProps }) {
  return (
    <div className="appShell">
      <Topbar {...topbarProps} />
      <main id="appMain" className="appMain" role="main">
        {children}
      </main>
    </div>
  );
}
