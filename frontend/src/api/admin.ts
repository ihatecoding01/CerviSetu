/** Administrator hospital directory: which hospital offers which cervical cancer services. */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const HOSPITAL_TYPES = [
  { id: "URBAN_HEALTH_CENTRE", label: "Urban health centre" },
  { id: "PERIPHERAL_HOSPITAL", label: "Peripheral hospital" },
  { id: "TERTIARY_HOSPITAL", label: "Tertiary hospital" },
];

export const SERVICES = [
  { id: "VIA_SCREENING", label: "VIA screening" },
  { id: "HPV_DNA_TEST", label: "HPV DNA test" },
  { id: "COLPOSCOPY", label: "Colposcopy" },
  { id: "CERVICAL_BIOPSY", label: "Cervical biopsy" },
  { id: "HISTOPATHOLOGY", label: "Histopathology" },
  { id: "MRI_PELVIS", label: "Pelvic MRI" },
  { id: "PRECANCER_TREATMENT", label: "Precancer treatment" },
  { id: "GYNAE_ONCOLOGY_OPD", label: "Gynaecologic oncology OPD" },
  { id: "CANCER_SURGERY", label: "Cancer surgery" },
  { id: "CHEMOTHERAPY", label: "Chemotherapy" },
  { id: "RADIOTHERAPY", label: "Radiotherapy" },
];

export interface HospitalInput {
  name: string;
  hospital_type: string;
  area: string;
  address: string;
  phone: string;
  services: string[];
  latitude: number | null;
  longitude: number | null;
  location_source: string;
}

export interface Hospital extends HospitalInput {
  hospital_id: string;
  active: boolean;
}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/admin${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    if (res.status === 401 && detail?.code === "STAFF_SIGN_IN_REQUIRED") {
      window.dispatchEvent(new Event("cervisetu:staff-session-ended"));
    }
    if (Array.isArray(detail)) throw new Error("Please check the phone number and the required fields.");
    throw new Error((typeof detail === "string" ? detail : detail?.message) || "The request failed. Please try again.");
  }
  return data as T;
}

export interface HealthPost {
  name: string;
  area: string;
  hospital: string | null;
  active: boolean;
}

export interface StaffAccount {
  staff_id: string;
  name: string;
  role: string;
  health_post: string | null;
  hospital: string | null;
  active: boolean;
}

export interface StaffInput {
  staff_id?: string;
  name: string;
  role: string;
  health_post: string | null;
  hospital: string | null;
  pin?: string;
}

export interface DashboardCounts {
  referrals: number;
  arrivals: number;
  in_follow_up: number;
  overdue: number;
  declined: number;
}

export interface AdminAction {
  timestamp: string;
  action: string;
}

export const adminApi = {
  list: async () => (await call<{ hospitals: Hospital[] }>("/hospitals")).hospitals,
  add: (hospital: HospitalInput) => call<Hospital>("/hospitals", "POST", hospital),
  update: (id: string, hospital: HospitalInput) => call<Hospital>(`/hospitals/${id}`, "PUT", hospital),
  setActive: (id: string, active: boolean) => call<Hospital>(`/hospitals/${id}/status`, "POST", { active }),
  posts: async () => (await call<{ health_posts: HealthPost[] }>("/health-posts")).health_posts,
  addPost: (post: { name: string; area: string; hospital: string }) => call<HealthPost>("/health-posts", "POST", post),
  setPostActive: (name: string, active: boolean) => call<HealthPost>(`/health-posts/${encodeURIComponent(name)}/status`, "POST", { active }),
  setRoute: (name: string, hospital: string) => call<unknown>(`/routes/${encodeURIComponent(name)}`, "PUT", { hospital }),
  staff: async () => (await call<{ staff: StaffAccount[] }>("/staff")).staff,
  addStaff: (input: StaffInput) => call<StaffAccount>("/staff", "POST", input),
  updateStaff: (id: string, input: StaffInput) => call<StaffAccount>(`/staff/${id}`, "PUT", input),
  setStaffActive: (id: string, active: boolean) => call<StaffAccount>(`/staff/${id}/status`, "POST", { active }),
  dashboard: () => call<DashboardCounts>("/dashboard"),
  myActions: async () => (await call<{ actions: AdminAction[] }>("/my-actions")).actions,
};
