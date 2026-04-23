/**
 * FieldAppLayout — Shell layout for the Field Sales portal.
 * Premium dark navy theme with purple accents (Salesforce/HubSpot mobile feel).
 */
import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import FieldSidebar from "./components/FieldSidebar";
import "./styles/field-portal.css";

export default function FieldAppLayout() {
  const location = useLocation();

  // Smooth scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div
      data-field-portal
      className="min-h-screen flex w-full"
      style={{ background: "hsl(var(--field-bg))" }}
    >
      <FieldSidebar />
      <main className="flex-1 overflow-auto pb-24 md:pb-0">
        <div
          key={location.pathname}
          className="max-w-[1100px] mx-auto p-4 md:p-6 field-page-enter"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
