/**
 * Zero-Dependency HTML5 History API Router for CerviSetu
 * Enables real URL paths, deep-linking, browser back/forward history, and bookmarking.
 */
import { useState, useEffect, useCallback } from "react";
import type { Tab } from "../components/dashboard/DashboardLayout";

export type ViewType = "landing" | "gateway" | "staff" | "patient";

export interface AppRoute {
  view: ViewType;
  tab?: Tab;
  patientToken?: string;
  path: string;
}

const TAB_PATH_MAP: Record<string, Tab> = {
  overview: "overview-tab",
  prevention: "prevention-tab",
  encounter: "encounter-tab",
  intake: "intake-tab",
  tracker: "tracker-tab",
  asha: "asha-tab",
  audit: "privacy-tab",
  privacy: "privacy-tab",
  patient: "patient-tab",
  admin: "admin-tab",
};

const TAB_TO_SLUG: Record<Tab, string> = {
  "overview-tab": "overview",
  "prevention-tab": "prevention",
  "encounter-tab": "encounter",
  "intake-tab": "intake",
  "tracker-tab": "tracker",
  "asha-tab": "asha",
  "privacy-tab": "audit",
  "patient-tab": "patient",
  "admin-tab": "admin",
};

export function parsePath(pathname: string): AppRoute {
  const cleanPath = pathname.trim().replace(/\/+$/, "") || "/";

  // 1. Patient Companion Paths (/patient or /patient/:token)
  if (cleanPath.startsWith("/patient")) {
    const parts = cleanPath.split("/").filter(Boolean);
    // No default patient: a bare /patient resolves to the logged-in patient's own record (or the login)
    const token = parts[1] ? parts[1].toUpperCase() : undefined;
    return { view: "patient", patientToken: token, path: token ? `/patient/${token}` : "/patient" };
  }

  // 2. Staff CareUI Workstation Paths (/staff or /staff/:tab)
  if (cleanPath.startsWith("/staff")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const subSlug = parts[1] || "overview";
    const mappedTab = TAB_PATH_MAP[subSlug.toLowerCase()] || "overview-tab";
    return { view: "staff", tab: mappedTab, path: `/staff/${TAB_TO_SLUG[mappedTab]}` };
  }

  // 3. Dedicated Gateway Path
  if (cleanPath === "/gateway") {
    return { view: "gateway", path: "/gateway" };
  }

  // 4. Landing Page Paths (/ or /landing)
  if (cleanPath === "/" || cleanPath === "/landing" || cleanPath === "/book-screening") {
    return { view: "landing", path: cleanPath };
  }

  // 5. Default Fallback
  return { view: "landing", path: "/" };
}

export function useRouter() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    parsePath(window.location.pathname)
  );

  // Sync with browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(parsePath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Programmatic navigation
  const navigate = useCallback((target: string | { view: ViewType; tab?: Tab; token?: string }) => {
    let targetPath = "/";

    if (typeof target === "string") {
      targetPath = target;
    } else {
      if (target.view === "landing") {
        targetPath = "/";
      } else if (target.view === "gateway") {
        targetPath = "/gateway";
      } else if (target.view === "patient") {
        targetPath = target.token ? `/patient/${target.token}` : "/patient";
      } else if (target.view === "staff") {
        const slug = target.tab ? TAB_TO_SLUG[target.tab] : "overview";
        targetPath = `/staff/${slug}`;
      }
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
    setCurrentRoute(parsePath(targetPath));
  }, []);

  return { currentRoute, navigate };
}

