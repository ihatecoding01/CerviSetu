/**
 * Unified API Configuration & Token Manager for CerviSetu.
 * Handles environment-based URL resolution, cross-origin cookies,
 * and header-based Bearer token fallbacks.
 */

const STAFF_TOKEN_KEY = "cervisetu_staff_token";
const PATIENT_TOKEN_KEY = "cervisetu_patient_token";

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // When hosted on Cloudflare Pages or remote demo without custom env
    if (host.endsWith(".pages.dev") || host.includes("cervi-setu")) {
      return "https://health-hackathon-8bhk.onrender.com";
    }
  }

  // Local development fallback (Vite proxy forwards /api to localhost:8000)
  return "";
}

export const BASE_URL = getApiBaseUrl();

export function getStaffToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STAFF_TOKEN_KEY) || localStorage.getItem(STAFF_TOKEN_KEY);
}

export function setStaffToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token && typeof token === "string" && token.trim().length > 0) {
    sessionStorage.setItem(STAFF_TOKEN_KEY, token.trim());
    localStorage.setItem(STAFF_TOKEN_KEY, token.trim());
  } else {
    sessionStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_TOKEN_KEY);
  }
}

export function getPatientToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PATIENT_TOKEN_KEY) || localStorage.getItem(PATIENT_TOKEN_KEY);
}

export function setPatientToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token && typeof token === "string" && token.trim().length > 0) {
    sessionStorage.setItem(PATIENT_TOKEN_KEY, token.trim());
    localStorage.setItem(PATIENT_TOKEN_KEY, token.trim());
  } else {
    sessionStorage.removeItem(PATIENT_TOKEN_KEY);
    localStorage.removeItem(PATIENT_TOKEN_KEY);
  }
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getStaffToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-Staff-Session"] = token;
  }
  return headers;
}

/**
 * Enhanced fetch wrapper with credentials and dual-mode token injection.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const tokenHeaders = getAuthHeaders();
  
  let mergedHeaders: HeadersInit = { ...tokenHeaders };
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        (mergedHeaders as Record<string, string>)[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        (mergedHeaders as Record<string, string>)[key] = value;
      });
    } else {
      mergedHeaders = { ...mergedHeaders, ...init.headers };
    }
  }

  const response = await window.fetch(input, {
    credentials: "include",
    ...init,
    headers: mergedHeaders,
  });

  // Track any refreshed session token returned in headers
  const refreshedToken = response.headers.get("x-staff-token");
  if (refreshedToken) {
    setStaffToken(refreshedToken);
  }

  return response;
}

