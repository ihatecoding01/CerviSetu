import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Loader2, MapPin, Pencil, Phone, Plus, Power, Search, X } from "lucide-react";
import { adminApi, HOSPITAL_TYPES, SERVICES, type Hospital, type HospitalInput } from "../../api/admin";

const EMPTY: HospitalInput = { name: "", hospital_type: "TERTIARY_HOSPITAL", area: "", address: "", phone: "", services: [], latitude: null, longitude: null, location_source: "" };
const typeLabel = (id: string) => HOSPITAL_TYPES.find((t) => t.id === id)?.label ?? id;
const serviceLabel = (id: string) => SERVICES.find((s) => s.id === id)?.label ?? id;
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-black focus:outline-none focus:border-black";

export function AdminHospitals({ isAdmin }: { isAdmin: boolean }) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<HospitalInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setHospitals(await adminApi.list());
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? hospitals.filter((h) => `${h.name} ${h.area}`.toLowerCase().includes(q)) : hospitals;
  }, [hospitals, query]);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center" data-testid="admin-denied">
        <h1 className="text-lg font-bold">Administrators only</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with an administrator account to manage hospitals.</p>
      </div>
    );
  }

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError(null);
  };

  const toggleService = (id: string) =>
    setForm((f) => ({ ...f, services: f.services.includes(id) ? f.services.filter((s) => s !== id) : [...f.services, id] }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.services.length === 0) {
      setError("Select at least one service.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) await adminApi.update(editingId, form);
      else await adminApi.add(form);
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The hospital could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (h: Hospital) => {
    setEditingId(h.hospital_id);
    setError(null);
    setForm({ name: h.name, hospital_type: h.hospital_type, area: h.area, address: h.address, phone: h.phone, services: h.services, latitude: h.latitude ?? null, longitude: h.longitude ?? null, location_source: h.location_source ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleActive = async (h: Hospital) => {
    setBusyId(h.hospital_id);
    setError(null);
    try {
      await adminApi.setActive(h.hospital_id, !h.active);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The hospital could not be updated.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6" data-testid="admin-hospitals">
      <header>
        <h1 className="text-xl font-bold">Hospitals and services</h1>
        <p className="mt-1 text-sm text-slate-500">Add each hospital and the cervical cancer services it offers.</p>
      </header>

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-bold">{editingId ? "Edit hospital" : "Add a hospital"}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Hospital name
            <input required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} data-testid="hospital-name" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Level of care
            <select value={form.hospital_type} onChange={(e) => setForm({ ...form, hospital_type: e.target.value })} className={inputClass} data-testid="hospital-type">
              {HOSPITAL_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Area
            <input required minLength={2} maxLength={80} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={inputClass} data-testid="hospital-area" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Phone
            <input type="tel" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} data-testid="hospital-phone" />
          </label>
          <label className="text-xs font-semibold text-slate-600 md:col-span-2">
            Address
            <input maxLength={240} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} data-testid="hospital-address" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Latitude
            <input type="number" step="any" min={6} max={38} value={form.latitude ?? ""} onChange={(e) => setForm({ ...form, latitude: e.target.value === "" ? null : Number(e.target.value) })} className={inputClass} data-testid="hospital-latitude" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Longitude
            <input type="number" step="any" min={68} max={98} value={form.longitude ?? ""} onChange={(e) => setForm({ ...form, longitude: e.target.value === "" ? null : Number(e.target.value) })} className={inputClass} data-testid="hospital-longitude" />
          </label>
          <label className="text-xs font-semibold text-slate-600 md:col-span-2">
            Where these coordinates came from
            <input maxLength={120} value={form.location_source} onChange={(e) => setForm({ ...form, location_source: e.target.value })} className={inputClass} data-testid="hospital-location-source" />
            {form.latitude !== null && form.longitude !== null && (
              <a className="mt-1 inline-block font-semibold text-[#0F766E] underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}#map=17/${form.latitude}/${form.longitude}`}>Check this point on the map</a>
            )}
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-xs font-semibold text-slate-600">Services available</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <label key={s.id} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-black has-[:checked]:border-black has-[:checked]:bg-slate-50">
                <input type="checkbox" checked={form.services.includes(s.id)} onChange={() => toggleService(s.id)} className="mt-0.5 shrink-0 accent-black" data-testid={`service-${s.id}`} />
                <span className="min-w-0 break-words">{s.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p role="alert" className="mt-4 text-sm text-[#BA2D0B]">{error}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="submit" disabled={saving} data-testid="hospital-save" className="flex cursor-pointer items-center gap-2 rounded-full bg-black px-5 py-2.5 text-xs font-semibold text-white hover:bg-black/85 disabled:opacity-50">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            {editingId ? "Save changes" : "Add hospital"}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-xs font-semibold hover:border-black">
              <X className="size-3.5" />
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Listed hospitals</h2>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Search by hospital or area</span>
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by hospital or area" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm focus:border-black focus:outline-none" />
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-10 text-slate-400"><Loader2 className="size-5 animate-spin" /></div>
        ) : loadFailed ? (
          <div className="py-8 text-center text-sm text-slate-600">
            <p>Hospitals could not be loaded.</p>
            <button type="button" onClick={() => void load()} className="mt-2 cursor-pointer font-semibold underline">Try again</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500" data-testid="hospital-empty">
            <Building2 className="mx-auto mb-2 size-6 text-slate-300" />
            {hospitals.length === 0 ? "No hospitals have been added yet." : "No hospitals match your search."}
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {shown.map((h) => (
              <li key={h.hospital_id} data-testid="hospital-row" className={`rounded-xl border border-slate-200 p-4 ${h.active ? "" : "bg-slate-50 opacity-75"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-sm font-bold">{h.name}</h3>
                      {!h.active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Inactive</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{typeLabel(h.hospital_type)}</p>
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      <span className="min-w-0 break-words">{[h.area, h.address].filter(Boolean).join(" · ")}</span>
                    </p>
                    {h.latitude == null && <p className="mt-1 text-xs font-semibold text-[#BA2D0B]">No map location. Patients cannot see this centre on the map.</p>}
                    {h.phone && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600" data-no-translate>
                        <Phone className="size-3.5 shrink-0" />
                        {h.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => edit(h)} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:border-black">
                      <Pencil className="size-3" />
                      Edit
                    </button>
                    <button type="button" disabled={busyId === h.hospital_id} onClick={() => void toggleActive(h)} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:border-black disabled:opacity-50">
                      {busyId === h.hospital_id ? <Loader2 className="size-3 animate-spin" /> : <Power className="size-3" />}
                      {h.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {h.services.map((s) => (
                    <li key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{serviceLabel(s)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
