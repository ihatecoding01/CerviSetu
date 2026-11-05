/** Staff sign-in: staff ID + PIN, one-click demo sign-in per role, session check, logout. */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const OFFLINE_KEY = "cervisetu_staff_offline";

export type StaffRole = "DOCTOR" | "NURSE" | "ASHA" | "ADMIN";

export interface StaffProfile {
  staff_id: string;
  name: string;
  role: StaffRole;
  role_label: string;
  facility: string;
  offline?: boolean;
}

// Mirrors the backend demo roster, used only when the API cannot be reached (offline demo).
export const DEMO_STAFF: Record<StaffRole, StaffProfile> = {
  DOCTOR: { staff_id: "DR-1001", name: "Dr. A. Sharma", role: "DOCTOR", role_label: "Doctor", facility: "Mirzapur District Spoke" },
  NURSE: { staff_id: "RN-2001", name: "Sister Sunita Patel", role: "NURSE", role_label: "Nurse", facility: "Mirzapur District Spoke" },
  ASHA: { staff_id: "AW-3001", name: "Meena Devi", role: "ASHA", role_label: "ASHA Worker", facility: "Vindhyachal Rural Ward 2" },
  ADMIN: { staff_id: "AD-4001", name: "District Programme Officer", role: "ADMIN", role_label: "Administrator", facility: "Mirzapur District Health Society" },
};

// Credentials pre-filled on the sign-in screen (matches CERVISETU_STAFF_DEMO_PIN in .env.example).
export const PRELOADED_PIN = "246810";

export class StaffLoginError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function call(path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE_URL}/api/staff/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function readOffline(): StaffProfile | null {
  try {
    const raw = sessionStorage.getItem(OFFLINE_KEY);
    return raw ? (JSON.parse(raw) as StaffProfile) : null;
  } catch {
    return null;
  }
}

function writeOffline(p: StaffProfile | null) {
  try {
    if (p) sessionStorage.setItem(OFFLINE_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(OFFLINE_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function signedIn(res: Response): Promise<StaffProfile> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.staff) {
    const d = data.detail || {};
    throw new StaffLoginError(d.code || "LOGIN_FAILED", d.message || "Sign-in failed. Please try again.");
  }
  writeOffline(null);
  return data.staff as StaffProfile;
}

export const staffApi = {
  async session(): Promise<StaffProfile | null> {
    try {
      // Never leave the app blank: if the check stalls, carry on to sign-in
      const res = await Promise.race([
        call("session"),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
      ]);
      if (!res.ok) throw new Error("unreachable");
      const data = await res.json();
      return data.authenticated ? data.staff : readOffline();
    } catch {
      return readOffline();
    }
  },

  async login(staffId: string, pin: string): Promise<StaffProfile> {
    let res: Response;
    try {
      res = await call("login", { staff_id: staffId, pin });
      if (res.status >= 500 || res.status === 404) throw new Error("unreachable");
    } catch {
      // Server unreachable: allow the pre-filled roster accounts so the app still opens (sample data).
      const match = Object.values(DEMO_STAFF).find((p) => p.staff_id === staffId.trim().toUpperCase());
      if (match && pin === PRELOADED_PIN) {
        const profile = { ...match, offline: true };
        writeOffline(profile);
        return profile;
      }
      throw new StaffLoginError("OFFLINE", "Cannot reach the server. Please try again shortly.");
    }
    return signedIn(res);
  },

  async demoLogin(role: StaffRole): Promise<StaffProfile> {
    try {
      const res = await call("demo-login", { role });
      if (res.status >= 500 || res.status === 404) throw new Error("unreachable");
      return await signedIn(res);
    } catch (e) {
      if (e instanceof StaffLoginError) throw e;
      // Backend offline: sign in locally so the demo still works (API calls fall back to sample data).
      const profile = { ...DEMO_STAFF[role], offline: true };
      writeOffline(profile);
      return profile;
    }
  },

  async logout(): Promise<void> {
    writeOffline(null);
    try {
      await call("logout", {});
    } catch {
      /* offline */
    }
  },
};
