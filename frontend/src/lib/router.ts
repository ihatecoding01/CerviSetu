/**
 * Zero-Dependency HTML5 History API Router for CerviSetu
 * Enables real URL paths, deep-linking, browser back/forward history, and bookmarking.
 */
import { useState, useEffect, useCallback } from "react";
import type { Tab } from "../components/DashboardLayout";

export type ViewType = "landing" | "gateway" | "staff" | "patient";

export interface AppRoute {
  view: ViewType;
  tab?: Tab;
  patientToken?: string;
  path: string;
}

const TAB_PATH_MAP: Record<string, Tab> = {
  prevention: "prevention-tab",
  immunization: "prevention-tab",
  overview: "overview-tab",
  encounter: "encounter-tab",
  intake: "intake-tab",
  tracker: "tracker-tab",
  asha: "asha-tab",
  specialist: "specialist-tab",
  referral: "specialist-tab",
  audit: "privacy-tab",
  privacy: "privacy-tab",
};

const TAB_TO_SLUG: Record<Tab, string> = {
  "prevention-tab": "prevention",
  "asha-tab": "asha",
  "specialist-tab": "specialist",
  "overview-tab": "overview",
  "encounter-tab": "encounter",
  "intake-tab": "intake",
  "tracker-tab": "tracker",
  "privacy-tab": "audit",
};

export function parsePath(pathname: string): AppRoute {
  const cleanPath = pathname.trim().replace(/\/+$/, "") || "/";

  // Redirect legacy demo path to prevention workstation
  if (cleanPath === "/demo" || cleanPath === "/dual") {
    return { view: "staff", tab: "prevention-tab", path: "/staff/prevention" };
  }

  // 2. Patient Companion Paths (/patient or /patient/:token)
  if (cleanPath.startsWith("/patient")) {
    const parts = cleanPath.split("/").filter(Boolean);
    // No default patient: a bare /patient resolves to the logged-in patient's own record (or the login)
    const token = parts[1] ? parts[1].toUpperCase() : undefined;
    return { view: "patient", patientToken: token, path: token ? `/patient/${token}` : "/patient" };
  }

  // 3. Staff CareUI Workstation Paths (/staff or /staff/:tab)
  if (cleanPath.startsWith("/staff")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const subSlug = parts[1] || "overview";
    const mappedTab = TAB_PATH_MAP[subSlug.toLowerCase()] || "overview-tab";
    return { view: "staff", tab: mappedTab, path: `/staff/${TAB_TO_SLUG[mappedTab]}` };
  }

  // 4. Dedicated Gateway Path
  if (cleanPath === "/gateway") {
    return { view: "gateway", path: "/gateway" };
  }

  // 5. Landing Page Paths (/ or /landing)
  if (cleanPath === "/" || cleanPath === "/landing") {
    return { view: "landing", path: cleanPath };
  }

  // 6. Default Fallback
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

