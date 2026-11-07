import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Hospital, LocateFixed, MapPin, Navigation } from "lucide-react";
import { portalApi, type CareCentre, type CentresResponse } from "../../api/portal";
import { directionsUrl, fetchRoute, geocode, straightLineKm, type Point, type RouteResult } from "../../lib/geo";

const pin = (color: string, size: number) =>
  L.divIcon({ className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45)"></span>` });
const pointOf = (c: CareCentre): Point | null => (c.latitude !== null && c.longitude !== null ? { lat: c.latitude, lng: c.longitude } : null);
const RADII = [5, 10, 25, 50];

/** Her location lives only in this component's state. It is never sent to CerviSetu, and goes when she clears it or leaves. */
export default function FindCentre({ token }: { token: string }) {
  const [data, setData] = useState<CentresResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [here, setHere] = useState<Point | null>(null);
  const [locNote, setLocNote] = useState("");
  const [manual, setManual] = useState(false);
  const [place, setPlace] = useState("");
  const [radius, setRadius] = useState(10);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeFailed, setRouteFailed] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const mapHost = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    let live = true;
    portalApi.centres(token).then((d) => { if (live) setData(d); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [token]);

  const assignedPoint = data?.assigned ? pointOf(data.assigned) : null;
  const listed = useMemo(() => {
    const all = (data?.nearby ?? []).map((c) => ({ c, km: here && pointOf(c) ? straightLineKm(here, pointOf(c) as Point) : null }));
    return here ? all.filter((x) => x.km !== null && x.km <= radius).sort((a, b) => (a.km as number) - (b.km as number)) : all;
  }, [data, here, radius]);

  useEffect(() => {
    if (!data || !mapHost.current || map.current) return;
    const m = L.map(mapHost.current, { scrollWheelZoom: false }).setView([19.05, 72.85], 11);
    const tiles = L.tileLayer(data.map.tile_url, { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" });
    let errors = 0;
    tiles.on("tileerror", () => { errors += 1; if (errors > 3) setMapFailed(true); });
    tiles.on("tileload", () => { errors = 0; setMapFailed(false); });
    tiles.addTo(m);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    return () => { m.remove(); map.current = null; layer.current = null; };
  }, [data]);

  useEffect(() => {
    let live = true;
    if (!here || !assignedPoint || !data?.map.routing_url) return;
    fetchRoute(data.map.routing_url, here, assignedPoint).then((r) => {
      if (!live) return;
      setRoute(r);
      setRouteFailed(!r);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assignedPoint is rebuilt each render from data
  }, [here, data]);

  useEffect(() => {
    const m = map.current, group = layer.current;
    if (!m || !group || !data) return;
    group.clearLayers();
    const bounds: [number, number][] = [];
    listed.forEach(({ c }) => {
      const p = pointOf(c);
      if (!p) return;
      L.marker([p.lat, p.lng], { icon: pin("#0F766E", 16), title: c.name, alt: c.name }).bindPopup(c.name).addTo(group);
      bounds.push([p.lat, p.lng]);
    });
    if (assignedPoint && data.assigned) {
      L.marker([assignedPoint.lat, assignedPoint.lng], { icon: pin("#BA2D0B", 24), title: data.assigned.name, alt: data.assigned.name, zIndexOffset: 500 })
        .bindTooltip(data.assigned.name, { permanent: true, direction: "top", offset: [0, -12] }).addTo(group);
      bounds.push([assignedPoint.lat, assignedPoint.lng]);
    }
    if (here) {
      L.marker([here.lat, here.lng], { icon: pin("#1D6FE8", 18), title: "Your location", alt: "Your location", zIndexOffset: 400 }).addTo(group);
      bounds.push([here.lat, here.lng]);
    }
    if (route) L.polyline(route.path, { color: "#1D6FE8", weight: 5 }).addTo(group);
    m.invalidateSize();
    if (bounds.length > 1) m.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
    else if (bounds.length === 1) m.setView(bounds[0], 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assignedPoint is rebuilt each render from data
  }, [data, listed, here, route]);

  const useMyLocation = () => {
    setLocNote("");
    if (!navigator.geolocation) {
      setLocNote("This device cannot share its location. You can type your area instead.");
      setManual(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => { setHere({ lat: p.coords.latitude, lng: p.coords.longitude }); setManual(false); },
      (e) => {
        setLocNote(e.code === e.PERMISSION_DENIED ? "Location was not shared. You can type your area instead." : "Your location could not be found. You can type your area instead.");
        setManual(true);
      },
      { timeout: 10000, maximumAge: 0 },
    );
  };

  const clear = () => { setHere(null); setRoute(null); setRouteFailed(false); setPlace(""); setLocNote("Your location has been cleared."); };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    const q = place.trim();
    if (q.length < 2 || !data) return;
    setLocNote("");
    const found = await geocode(data.map.geocoder_url, q);
    if (found) { setHere(found); setManual(false); }
    else setLocNote("That place could not be found. Try a nearby area, or use the list below.");
  };

  if (failed) return <p role="alert" className="text-sm text-slate-700" data-testid="centres-failed">Your centre details could not be loaded. Please try again later.</p>;
  if (!data) return <p className="text-sm text-slate-600">Loading map</p>;

  const assignedKm = here && assignedPoint ? straightLineKm(here, assignedPoint) : null;
  return (
    <div className="space-y-4" data-testid="find-centre">
      <div className="rounded-2xl border border-[#F19941]/50 bg-[#FFF8F1] p-4" data-testid="assigned-centre">
        <span className="inline-block rounded-full bg-[#FBDDC0] px-3 py-0.5 text-xs font-semibold text-black">Your Referral Centre</span>
        <p className="mt-2 text-base font-bold text-black">{data.assigned?.name ?? data.assigned_name}</p>
        {data.assigned && <p className="text-sm text-slate-700">{[data.assigned.address, data.assigned.area].filter(Boolean).join(", ")}</p>}
        {data.assigned_status === "LOCATION_MISSING" && <p className="mt-2 text-sm font-medium text-[#BA2D0B]" data-testid="assigned-missing">The map location of this centre has not been added yet. Please ask your health worker for directions.</p>}
        {data.assigned_status === "NOT_IN_DIRECTORY" && <p className="mt-2 text-sm font-medium text-[#BA2D0B]" data-testid="assigned-missing">This centre is not available in the directory right now. Please ask your health worker for directions.</p>}
        {assignedKm !== null && (
          <p className="mt-2 text-sm text-slate-800" data-testid="assigned-distance">
            {route ? `${route.km.toFixed(1)} km by road, about ${route.minutes} min by car` : `${assignedKm.toFixed(1)} km in a straight line. The road distance will be longer.`}
          </p>
        )}
        {routeFailed && <p className="mt-1 text-xs text-slate-600" data-testid="route-failed">Travel time is not available right now.</p>}
        {assignedPoint && (
          <a href={directionsUrl(assignedPoint.lat, assignedPoint.lng)} target="_blank" rel="noreferrer" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#BA2D0B] px-4 text-sm font-semibold text-white" data-testid="assigned-directions">
            <Navigation className="size-4" aria-hidden="true" />Get Directions
          </a>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        {here ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-700" data-testid="location-on">Using your location on this screen only. It is not saved or shared with your care team.</p>
            <button type="button" onClick={clear} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold" data-testid="location-clear">Clear My Location</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-700">Share your location to see how far your centre is. This is your choice. It stays on this screen and is not saved or shared with your care team.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={useMyLocation} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-black px-4 text-sm font-semibold" data-testid="location-use"><LocateFixed className="size-4" aria-hidden="true" />Use My Location</button>
              <button type="button" onClick={() => setManual(true)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold" data-testid="location-manual"><MapPin className="size-4" aria-hidden="true" />Type My Area</button>
            </div>
          </>
        )}
        {manual && !here && (
          <form onSubmit={search} className="mt-3">
            <label className="text-sm font-semibold text-black" htmlFor="centre-place">Your area or address</label>
            <div className="mt-1 flex gap-2">
              <input id="centre-place" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm" data-testid="location-input" />
              <button type="submit" className="min-h-11 shrink-0 rounded-xl bg-black px-4 text-sm font-semibold text-white" data-testid="location-search">Search</button>
            </div>
            <p className="mt-1 text-xs text-slate-600">What you type may be sent to OpenStreetMap to find the place. Enter an area, not your full house address.</p>
          </form>
        )}
        {locNote && <p role="status" className="mt-2 text-sm font-medium text-slate-800" data-testid="location-note">{locNote}</p>}
      </div>

      <div className="relative">
        <div ref={mapHost} className="relative z-0 h-64 w-full overflow-hidden rounded-2xl border border-slate-200 sm:h-80" data-testid="centre-map" />
        {mapFailed && <p role="status" className="mt-2 text-sm text-slate-700" data-testid="map-failed">The map could not load. The list and directions below still work.</p>}
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#1D6FE8]" />Your location</li>
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#BA2D0B]" />Assigned referral centre</li>
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#0F766E]" />Other listed centre</li>
        </ul>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-black">Other Listed Centres</h3>
          {here && (
            <label className="flex items-center gap-2 text-sm text-slate-700">Within
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="min-h-11 rounded-lg border border-slate-300 px-2" data-testid="radius">
                {RADII.map((km) => <option key={km} value={km}>{`${km} km`}</option>)}
              </select>
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-600">These are not your assigned centre. Please go to your referral centre unless your health worker tells you otherwise.</p>
        {listed.length === 0 && <p className="mt-2 text-sm text-slate-700" data-testid="nearby-empty">No listed centres in this distance. Try a wider distance.</p>}
        <ul className="mt-2 space-y-2" data-testid="nearby-list">
          {listed.map(({ c, km }) => (
            <li key={c.name} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <Hospital className="size-5 shrink-0 text-[#0F766E]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-black">{c.name}</p>
                <p className="text-xs text-slate-600">{[km !== null ? `${km.toFixed(1)} km in a straight line` : "", c.address, c.area].filter(Boolean).join(" · ")}</p>
                {c.services.length > 0 && <p className="text-xs text-slate-600">{c.services.join(", ").replace(/_/g, " ").toLowerCase()}</p>}
              </div>
              {pointOf(c) && <a href={directionsUrl(c.latitude as number, c.longitude as number)} target="_blank" rel="noreferrer" aria-label={`Directions to ${c.name}`} title="Directions" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-300"><Navigation className="size-4" aria-hidden="true" /></a>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
