/** Staff sign-in: staff ID + PIN, one-click demo sign-in per role, session check, logout. */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type StaffRole = "DOCTOR" | "NURSE" | "ASHA" | "HOSPITAL" | "ADMIN";

export interface StaffProfile {
  staff_id: string;
  name: string;
  role: StaffRole;
  role_label: string;
  facility: string;
  health_post?: string | null;
  hospital?: string | null;
  offline?: boolean;
}

// Test accounts in the seeded directory, pre-filled on the sign-in screen.
export const DEMO_STAFF: Record<StaffRole, { staff_id: string }> = {
  DOCTOR: { staff_id: "DR-1001" },
  NURSE: { staff_id: "RN-2001" },
  ASHA: { staff_id: "AW-3001" },
  HOSPITAL: { staff_id: "HD-5001" },
  ADMIN: { staff_id: "AD-4001" },
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

async function signedIn(res: Response): Promise<StaffProfile> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.staff) {
    const d = data.detail || {};
    throw new StaffLoginError(d.code || "LOGIN_FAILED", d.message || "Sign-in failed. Please try again.");
  }
  return data.staff as StaffProfile;
}

export const staffApi = {
  async session(): Promise<StaffProfile | null> {
    try {
      const res = await Promise.race([
        call("session"),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
      ]);
      if (!res.ok) return null;
      const data = await res.json();
      return data.authenticated ? data.staff : null;
    } catch {
      return null;
    }
  },

  async login(staffId: string, pin: string): Promise<StaffProfile> {
    let res: Response;
    try {
      res = await call("login", { staff_id: staffId, pin });
    } catch {
      throw new StaffLoginError("OFFLINE", "Cannot reach the server. Please try again shortly.");
    }
    return signedIn(res);
  },

  async demoLogin(role: StaffRole): Promise<StaffProfile> {
    let res: Response;
    try {
      res = await call("demo-login", { role });
    } catch {
      throw new StaffLoginError("OFFLINE", "Cannot reach the server. Please try again shortly.");
    }
    return signedIn(res);
  },

  async logout(): Promise<void> {
    try {
      await call("logout", {});
    } catch {
      /* the session cookie expires on its own */
    }
  },
};
