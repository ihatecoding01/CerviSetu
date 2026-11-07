import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Car, ChevronDown, ChevronRight, Clock, Crosshair, Hospital, LocateFixed, MapPin, Minus, Navigation, Plus, Route, Search } from "lucide-react";
import { portalApi, type CareCentre, type CentresResponse } from "../../api/portal";
import { directionsUrl, fetchRoute, trafficRange, geocode, straightLineKm, type Point, type RouteResult } from "../../lib/geo";

const teardrop = (color: string, size: number) =>
  L.divIcon({
    className: "",
    iconSize: [size, size * 1.25],
    iconAnchor: [size / 2, size * 1.25],
    tooltipAnchor: [0, -size],
    html: `<svg viewBox="0 0 32 40" width="${size}" height="${size * 1.25}" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))" aria-hidden="true"><path d="M16 39C7 28 1 22 1 15a15 15 0 1 1 30 0c0 7-6 13-15 24z" fill="${color}" stroke="#fff" stroke-width="2"/><rect x="8" y="7" width="16" height="16" rx="4" fill="#fff"/><path d="M14 10h4v3h3v4h-3v3h-4v-3h-3v-4h3z" fill="${color}"/></svg>`,
  });
const START = L.divIcon({
  className: "",
  iconSize: [34, 43],
  iconAnchor: [17, 43],
  tooltipAnchor: [0, -36],
  html: `<svg viewBox="0 0 32 40" width="34" height="43" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))" aria-hidden="true"><path d="M16 39C7 28 1 22 1 15a15 15 0 1 1 30 0c0 7-6 13-15 24z" fill="#2E9E3F" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15" r="5.5" fill="#fff"/></svg>`,
});
const pointOf = (c: CareCentre): Point | null => (c.latitude !== null && c.longitude !== null ? { lat: c.latitude, lng: c.longitude } : null);
const RADII = [5, 10, 25, 50];
const place_ = (c: CareCentre) => [c.address, c.area].filter(Boolean).join(", ");
const mapBtn = "flex size-11 items-center justify-center bg-white text-slate-800 hover:bg-slate-50 cursor-pointer disabled:text-slate-300";

/** Her location lives only in this component's state. It is never sent to CerviSetu, and goes when she clears it or leaves. */
export interface AssignedInfo { place: string | null; directions: string | null }

/** `stacked` puts the map on top and the controls under it, for a narrow column beside the patient's next step. */
export default function FindCentre({ token, stacked = false, onAssigned, locationSlot }: { token: string; stacked?: boolean; onAssigned?: (a: AssignedInfo) => void; locationSlot?: HTMLElement | null }) {
  const [data, setData] = useState<CentresResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [here, setHere] = useState<Point | null>(null);
  const [locNote, setLocNote] = useState("");
  const [manual, setManual] = useState(false);
  const [picking, setPicking] = useState(false);
  const [place, setPlace] = useState("");
  const [radius, setRadius] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const [assignedRoute, setAssignedRoute] = useState<RouteResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);
  const [routeFailed, setRouteFailed] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [showList, setShowList] = useState(!stacked);
  const mapHost = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pickingRef = useRef(false);

  useEffect(() => {
    let live = true;
    portalApi.centres(token).then((d) => { if (live) setData(d); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [token]);

  const assignedPoint = useMemo(() => (data?.assigned ? pointOf(data.assigned) : null), [data]);
  useEffect(() => {
    if (!data) return;
    onAssigned?.({ place: data.assigned ? place_(data.assigned) || null : null, directions: assignedPoint ? directionsUrl(assignedPoint.lat, assignedPoint.lng) : null });
  }, [data, assignedPoint, onAssigned]);
  const listed = useMemo(() => {
    const all = (data?.nearby ?? []).map((c) => ({ c, km: here && pointOf(c) ? straightLineKm(here, pointOf(c) as Point) : null }));
    return here ? all.filter((x) => x.km !== null && x.km <= radius).sort((a, b) => (a.km as number) - (b.km as number)) : all;
  }, [data, here, radius]);
  const selectedCentre = listed.find((x) => x.c.name === selected)?.c ?? null;
  const selectedPoint = useMemo(() => (selectedCentre ? pointOf(selectedCentre) : null), [selectedCentre]);
  // The end point she is viewing. Her official destination stays the assigned centre whatever she views.
  const endPoint = selectedPoint ?? assignedPoint;
  const route = selectedPoint ? selectedRoute : assignedRoute;

  const frame = useCallback(() => {
    const m = map.current;
    if (!m || !data) return;
    m.invalidateSize();
    const keep: [number, number][] = [...(route?.path ?? [])];
    (here ? [here, endPoint] : [selectedPoint ?? assignedPoint]).forEach((p) => { if (p) keep.push([p.lat, p.lng]); });
    if (keep.length > 1) m.fitBounds(keep, { padding: [64, 64], maxZoom: 15 });
    else if (keep.length === 1) m.setView(keep[0], 13);
    else if (data.nearby.length) m.fitBounds(data.nearby.flatMap((c) => (pointOf(c) ? [[c.latitude, c.longitude] as [number, number]] : [])), { padding: [40, 40], maxZoom: 13 });
  }, [data, here, assignedPoint, endPoint, selectedPoint, route]);

  useEffect(() => {
    if (!data || !mapHost.current || map.current) return;
    const m = L.map(mapHost.current, { scrollWheelZoom: false, zoomControl: false }).setView([19.05, 72.85], 12);
    const tiles = L.tileLayer(data.map.tile_url, { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" });
    let errors = 0;
    tiles.on("tileerror", () => { errors += 1; if (errors > 3) setMapFailed(true); });
    tiles.on("tileload", () => { errors = 0; setMapFailed(false); });
    tiles.addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (!pickingRef.current) return;
      pickingRef.current = false;
      setPicking(false);
      setManual(false);
      setLocNote("");
      setHere({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    const sized = new ResizeObserver(() => m.invalidateSize());
    sized.observe(mapHost.current);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    return () => { sized.disconnect(); m.remove(); map.current = null; layer.current = null; };
  }, [data]);

  useEffect(() => {
    let live = true;
    setAssignedRoute(null);
    setRouteFailed(false);
    if (!here || !assignedPoint || !data?.map.routing_url) return;
    fetchRoute(data.map.routing_url, here, assignedPoint).then((r) => {
      if (!live) return;
      setAssignedRoute(r);
      setRouteFailed(!r);
    });
    return () => { live = false; };
  }, [here, assignedPoint, data]);

  useEffect(() => {
    let live = true;
    setSelectedRoute(null);
    if (!here || !selectedPoint || !data?.map.routing_url) return;
    fetchRoute(data.map.routing_url, here, selectedPoint).then((r) => { if (live) setSelectedRoute(r); });
    return () => { live = false; };
  }, [here, selectedPoint, data]);

  useEffect(() => {
    const group = layer.current;
    if (!group || !data) return;
    group.clearLayers();
    if (route) L.polyline(route.path, { color: "#1D6FE8", weight: 6, opacity: 0.95 }).addTo(group);
    // No road route available: join the two points honestly, dashed so it cannot be read as a road to follow.
    else if (here && endPoint) L.polyline([[here.lat, here.lng], [endPoint.lat, endPoint.lng]], { color: "#1D6FE8", weight: 4, opacity: 0.85, dashArray: "2 10", lineCap: "round", className: "cs-direct-line" }).addTo(group);
    listed.forEach(({ c }) => {
      const p = pointOf(c);
      if (!p) return;
      const isSelected = c.name === selected;
      const marker = L.marker([p.lat, p.lng], { icon: teardrop("#0F9488", isSelected ? 38 : 28), title: c.name, alt: c.name, zIndexOffset: isSelected ? 300 : 0 })
        .on("click", () => { if (!pickingRef.current) setSelected(c.name); });
      marker.bindTooltip(isSelected && here ? `End: ${c.name}` : c.name, { permanent: isSelected, direction: "top" });
      marker.addTo(group);
    });
    if (assignedPoint && data.assigned) {
      L.marker([assignedPoint.lat, assignedPoint.lng], { icon: teardrop("#C8400F", 44), title: data.assigned.name, alt: data.assigned.name, zIndexOffset: 500 })
        .bindTooltip(here && !selectedPoint ? `End: ${data.assigned.name}` : data.assigned.name, { permanent: true, direction: "top" })
        .addTo(group);
    }
    if (here) L.marker([here.lat, here.lng], { icon: START, title: "Start: your location", alt: "Start: your location", zIndexOffset: 400 }).bindTooltip("Start: your location", { permanent: true, direction: "top" }).addTo(group);
  }, [data, listed, here, route, selected, assignedPoint, endPoint, selectedPoint]);

  // Framing follows her location, the route and her selection, never the whole directory.
  useEffect(() => { frame(); }, [frame]);

  const startPicking = () => {
    const next = !picking;
    pickingRef.current = next;
    setPicking(next);
    setLocNote("");
  };

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

  const clear = () => { setHere(null); setSelected(null); setPlace(""); setLocNote("Your location has been cleared."); };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    const q = place.trim();
    if (q.length < 2 || !data) return;
    setLocNote("");
    const found = await geocode(data.map.geocoder_url, q);
    if (found) { setHere(found); setManual(false); }
    else setLocNote("That place could not be found. Try a nearby area, or use the list below.");
  };

  if (failed) return <p role="alert" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700" data-testid="centres-failed">Your centre details could not be loaded. Please try again later.</p>;
  if (!data) return <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading map</p>;

  const assignedKm = here && assignedPoint ? straightLineKm(here, assignedPoint) : null;
  const panel = "bg-white border-slate-200 p-5";
  return (
    <section aria-labelledby="find-centre-title" className={stacked ? "flex flex-col gap-3" : "grid grid-cols-1 gap-3 lg:grid-cols-[38fr_62fr] lg:grid-rows-[auto_1fr] lg:gap-x-4 lg:gap-y-0"} data-testid="find-centre">
      {stacked && locationSlot && here ? createPortal(
      <div className={stacked ? (locationSlot && here ? "" : "order-2 rounded-xl border border-slate-200 bg-white p-4") : `${panel} rounded-2xl border lg:rounded-b-none lg:border-b-0 lg:pb-3`}>
        {stacked ? <h2 id="find-centre-title" className="sr-only">Map of your referral centre</h2> : <><div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#D5EFEF] text-[#0F766E]"><MapPin className="size-6" aria-hidden="true" /></span>
          <h2 id="find-centre-title" className="text-2xl font-bold text-black">Find Your Centre</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">See your assigned referral centre, nearby facilities, distance and directions.</p></>}

        <div className={stacked ? "empty:hidden mb-3" : "mt-4 rounded-2xl border border-[#F19941]/60 bg-[#FFF8F1] p-4"} data-testid="assigned-centre">
          {!stacked && <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#FBDDC0] text-[#C8400F]"><Hospital className="size-6" aria-hidden="true" /></span>
            <div className="min-w-0">
              <span className="inline-block rounded-full bg-[#FBDDC0] px-3 py-0.5 text-xs font-semibold text-black">Your Referral Centre</span>
              <p className="mt-1.5 text-lg font-bold leading-snug text-black">{data.assigned?.name ?? data.assigned_name}</p>
              {data.assigned && <p className="text-sm text-slate-600">{place_(data.assigned)}</p>}
            </div>
          </div>}
          {data.assigned_status === "LOCATION_MISSING" && <p className="mt-3 text-sm font-medium text-[#BA2D0B]" data-testid="assigned-missing">The map location of this centre has not been added yet. Please ask your health worker for directions.</p>}
          {data.assigned_status === "NOT_IN_DIRECTORY" && <p className="mt-3 text-sm font-medium text-[#BA2D0B]" data-testid="assigned-missing">This centre is not available in the directory right now. Please ask your health worker for directions.</p>}
          {assignedKm !== null && (
            <div className="mt-3 first:mt-0 text-sm text-slate-800" data-testid="assigned-distance">
              {assignedRoute ? (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
                  <span className="flex items-center gap-1.5"><Car className="size-4 text-[#0F766E]" aria-hidden="true" />{`${assignedRoute.km.toFixed(1)} km by road`}</span>
                  <span className="flex items-center gap-1.5"><Clock className="size-4 text-[#0F766E]" aria-hidden="true" />{trafficRange(assignedRoute.km, assignedRoute.minutes)}</span>
                </p>
              ) : <p>{`${assignedKm.toFixed(1)} km in a straight line. The road distance will be longer.`}</p>}
            </div>
          )}
          {routeFailed && <p className="mt-1 text-xs text-slate-600" data-testid="route-failed">Travel time is not available right now.</p>}
          {selectedPoint && assignedPoint && (
            <button type="button" onClick={() => setSelected(null)} className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-[#C8400F] bg-white px-4 text-sm font-semibold text-[#A93509] cursor-pointer" data-testid="back-to-assigned">Show My Referral Centre on Map</button>
          )}
          {assignedPoint && !stacked && (
            <a href={directionsUrl(assignedPoint.lat, assignedPoint.lng)} target="_blank" rel="noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C8400F] px-4 text-sm font-semibold text-white hover:bg-[#A93509]" data-testid="assigned-directions">
              <Navigation className="size-4" aria-hidden="true" />Get Directions
            </a>
          )}
        </div>

        <div className={stacked ? "" : "mt-3"}>
          {here ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 basis-48 text-xs text-slate-600" data-testid="location-on">Your location is not saved or shared with your care team. To draw the route, a map service receives the start and end points.</p>
              <button type="button" onClick={clear} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold" data-testid="location-clear">Clear My Location</button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600">Share your location to see how far your centre is. This is your choice. It is not saved or shared with your care team. To draw the route, a map service receives the start and end points.</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button type="button" onClick={useMyLocation} className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-300 p-1.5 text-xs font-semibold" data-testid="location-use"><LocateFixed className="size-4" aria-hidden="true" />Use My Location</button>
                <button type="button" aria-expanded={manual} onClick={() => setManual(!manual)} className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-300 p-1.5 text-xs font-semibold" data-testid="location-manual"><Search className="size-4" aria-hidden="true" />Type My Area</button>
                <button type="button" aria-pressed={picking} onClick={startPicking} className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border p-1.5 text-xs font-semibold ${picking ? "border-[#0F766E] bg-[#D5EFEF] text-[#0B5D57]" : "border-slate-300"}`} data-testid="location-pick"><MapPin className="size-4" aria-hidden="true" />Choose on Map</button>
              </div>
            </>
          )}
          {picking && !here && <p role="status" className="mt-2 text-sm font-medium text-[#0B5D57]" data-testid="pick-note">Tap the map where you are.</p>}
          {manual && !here && (
            <form onSubmit={search} className="mt-2">
              <label className="text-sm font-semibold text-black" htmlFor="centre-place">Locality, landmark or pincode</label>
              <div className="mt-1 flex gap-2">
                <input id="centre-place" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm" data-testid="location-input" />
                <button type="submit" className="min-h-11 shrink-0 rounded-xl bg-black px-4 text-sm font-semibold text-white" data-testid="location-search">Search</button>
              </div>
              <p className="mt-1 text-xs text-slate-600">What you type may be sent to OpenStreetMap to find the place. Enter an area, not your full house address.</p>
            </form>
          )}
          {locNote && <p role="status" className="mt-2 text-sm font-medium text-slate-800" data-testid="location-note">{locNote}</p>}
        </div>
      </div>,
        locationSlot) : (
      <div className={stacked ? (locationSlot && here ? "" : "order-2 rounded-xl border border-slate-200 bg-white p-4") : `${panel} rounded-2xl border lg:rounded-b-none lg:border-b-0 lg:pb-3`}>
        {stacked ? <h2 id="find-centre-title" className="sr-only">Map of your referral centre</h2> : <><div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#D5EFEF] text-[#0F766E]"><MapPin className="size-6" aria-hidden="true" /></span>
          <h2 id="find-centre-title" className="text-2xl font-bold text-black">Find Your Centre</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">See your assigned referral centre, nearby facilities, distance and directions.</p></>}

        <div className={stacked ? "empty:hidden mb-3" : "mt-4 rounded-2xl border border-[#F19941]/60 bg-[#FFF8F1] p-4"} data-testid="assigned-centre">
          {!stacked && <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#FBDDC0] text-[#C8400F]"><Hospital className="size-6" aria-hidden="true" /></span>
            <div className="min-w-0">
              <span className="inline-block rounded-full bg-[#FBDDC0] px-3 py-0.5 text-xs font-semibold text-black">Your Referral Centre</span>
              <p className="mt-1.5 text-lg font-bold leading-snug text-black">{data.assigned?.name ?? data.assigned_name}</p>
              {data.assigned && <p className="text-sm text-slate-600">{place_(data.assigned)}</p>}
            </div>
          </div>}
          {data.assigned_status === "LOCATION_MISSING" && <p className="mt-3 text-sm font-medium text-[#BA2D0B]" data-testid="assigned-missing">The map location of this centre has not been added yet. Please ask your health worker for directions.</p>}
          {data.assigned_status === "NOT_IN_DIRECTORY" && <p className="mt-3 text-sm font-medium text-[#BA2D0B]" data-testid="assigned-missing">This centre is not available in the directory right now. Please ask your health worker for directions.</p>}
          {assignedKm !== null && (
            <div className="mt-3 first:mt-0 text-sm text-slate-800" data-testid="assigned-distance">
              {assignedRoute ? (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
                  <span className="flex items-center gap-1.5"><Car className="size-4 text-[#0F766E]" aria-hidden="true" />{`${assignedRoute.km.toFixed(1)} km by road`}</span>
                  <span className="flex items-center gap-1.5"><Clock className="size-4 text-[#0F766E]" aria-hidden="true" />{trafficRange(assignedRoute.km, assignedRoute.minutes)}</span>
                </p>
              ) : <p>{`${assignedKm.toFixed(1)} km in a straight line. The road distance will be longer.`}</p>}
            </div>
          )}
          {routeFailed && <p className="mt-1 text-xs text-slate-600" data-testid="route-failed">Travel time is not available right now.</p>}
          {selectedPoint && assignedPoint && (
            <button type="button" onClick={() => setSelected(null)} className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-[#C8400F] bg-white px-4 text-sm font-semibold text-[#A93509] cursor-pointer" data-testid="back-to-assigned">Show My Referral Centre on Map</button>
          )}
          {assignedPoint && !stacked && (
            <a href={directionsUrl(assignedPoint.lat, assignedPoint.lng)} target="_blank" rel="noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C8400F] px-4 text-sm font-semibold text-white hover:bg-[#A93509]" data-testid="assigned-directions">
              <Navigation className="size-4" aria-hidden="true" />Get Directions
            </a>
          )}
        </div>

        <div className={stacked ? "" : "mt-3"}>
          {here ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 basis-48 text-xs text-slate-600" data-testid="location-on">Your location is not saved or shared with your care team. To draw the route, a map service receives the start and end points.</p>
              <button type="button" onClick={clear} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold" data-testid="location-clear">Clear My Location</button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600">Share your location to see how far your centre is. This is your choice. It is not saved or shared with your care team. To draw the route, a map service receives the start and end points.</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button type="button" onClick={useMyLocation} className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-300 p-1.5 text-xs font-semibold" data-testid="location-use"><LocateFixed className="size-4" aria-hidden="true" />Use My Location</button>
                <button type="button" aria-expanded={manual} onClick={() => setManual(!manual)} className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-300 p-1.5 text-xs font-semibold" data-testid="location-manual"><Search className="size-4" aria-hidden="true" />Type My Area</button>
                <button type="button" aria-pressed={picking} onClick={startPicking} className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border p-1.5 text-xs font-semibold ${picking ? "border-[#0F766E] bg-[#D5EFEF] text-[#0B5D57]" : "border-slate-300"}`} data-testid="location-pick"><MapPin className="size-4" aria-hidden="true" />Choose on Map</button>
              </div>
            </>
          )}
          {picking && !here && <p role="status" className="mt-2 text-sm font-medium text-[#0B5D57]" data-testid="pick-note">Tap the map where you are.</p>}
          {manual && !here && (
            <form onSubmit={search} className="mt-2">
              <label className="text-sm font-semibold text-black" htmlFor="centre-place">Locality, landmark or pincode</label>
              <div className="mt-1 flex gap-2">
                <input id="centre-place" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm" data-testid="location-input" />
                <button type="submit" className="min-h-11 shrink-0 rounded-xl bg-black px-4 text-sm font-semibold text-white" data-testid="location-search">Search</button>
              </div>
              <p className="mt-1 text-xs text-slate-600">What you type may be sent to OpenStreetMap to find the place. Enter an area, not your full house address.</p>
            </form>
          )}
          {locNote && <p role="status" className="mt-2 text-sm font-medium text-slate-800" data-testid="location-note">{locNote}</p>}
        </div>
      </div>
      )}

      <div className={stacked ? "relative order-1" : "relative lg:col-start-2 lg:row-span-2 lg:row-start-1"}>
        <div ref={mapHost} className={`relative z-0 w-full overflow-hidden border border-slate-200 ${stacked ? "h-[360px] lg:h-[420px] rounded-xl" : "h-[420px] rounded-2xl lg:h-full lg:min-h-[680px]"} ${picking ? "[&_.leaflet-container]:cursor-crosshair cursor-crosshair" : ""}`} data-testid="centre-map" />
        <div className="absolute bottom-[76px] right-3 z-10 flex flex-col gap-2 sm:bottom-[72px]">
          <div className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-xl shadow-md">
            <button type="button" className={mapBtn} aria-label="Zoom in" title="Zoom in" onClick={() => map.current?.zoomIn()} data-testid="map-zoom-in"><Plus className="size-5" /></button>
            <button type="button" className={mapBtn} aria-label="Zoom out" title="Zoom out" onClick={() => map.current?.zoomOut()} data-testid="map-zoom-out"><Minus className="size-5" /></button>
          </div>
          <button type="button" className={`${mapBtn} rounded-xl shadow-md`} aria-label="Recenter" title="Recenter" onClick={frame} data-testid="map-recenter"><Crosshair className="size-5 text-[#0F766E]" /></button>
          {route && <button type="button" className={`${mapBtn} rounded-xl shadow-md`} aria-label="Fit route" title="Fit route" onClick={frame} data-testid="map-fit-route"><Route className="size-5 text-[#1D6FE8]" /></button>}
        </div>
        <ul className="absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-2xl bg-white px-3 py-2 text-xs text-slate-700 shadow-md">
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#2E9E3F]" />Start: your location</li>
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#C8400F]" />Your assigned centre</li>
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#0F9488]" />Nearby centres (not a substitute)</li>
          {route && <li className="flex items-center gap-1.5"><span className="h-1 w-6 rounded-full bg-[#1D6FE8]" />Route</li>}
          {!route && here && assignedPoint && <li className="flex items-center gap-1.5" data-testid="legend-direct"><span className="w-6 border-t-[3px] border-dotted border-[#1D6FE8]" />Straight line, not a road route</li>}
        </ul>
        {selectedCentre && (
          <div role="status" className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-2 pl-3 text-xs shadow-md sm:right-auto sm:max-w-[80%]" data-testid="viewing-banner">
            <span><strong className="block text-sm text-black">{selectedCentre.name}</strong><span className="font-semibold text-[#BA2D0B]">This is not your assigned centre.</span></span>
            <button type="button" onClick={() => setSelected(null)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold cursor-pointer" data-testid="banner-back">Show My Referral Centre on Map</button>
          </div>
        )}
        {mapFailed && <p role="status" className="absolute inset-x-3 top-3 z-10 rounded-xl bg-white p-2 text-sm text-slate-700 shadow-md" data-testid="map-failed">The map could not load. The list and directions below still work.</p>}
      </div>

      <div className={stacked ? "order-3 rounded-xl border border-slate-200 bg-white p-4" : `${panel} rounded-2xl border lg:col-start-1 lg:row-start-2 lg:rounded-t-none lg:border-t-0 lg:pt-1`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {stacked
            ? <button type="button" aria-expanded={showList} onClick={() => setShowList((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold text-black cursor-pointer" data-testid="nearby-toggle">{here ? `Nearby centres (within ${radius} km)` : "Other centres"}<ChevronDown className={`size-4 transition-transform ${showList ? "rotate-180" : ""}`} aria-hidden="true" /></button>
            : <h3 className="text-base font-bold text-black">{here ? `Nearby Centres (within ${radius} km)` : "Other Listed Centres"}</h3>}
          {here && (
            <label className="flex items-center gap-1 text-xs text-slate-700"><span className="sr-only">Within</span>
              <select aria-label="Within" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="min-h-11 rounded-lg border border-slate-300 px-1" data-testid="radius">
                {RADII.map((km) => <option key={km} value={km}>{`${km} km`}</option>)}
              </select>
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-600">These are not your assigned centre. Please go to your referral centre unless your health worker tells you otherwise.</p>
        {showList && listed.length === 0 && <p className="mt-2 text-sm text-slate-700" data-testid="nearby-empty">No listed centres in this distance. Try a wider distance.</p>}
        {showList && <ul className="mt-2 space-y-2" data-testid="nearby-list">
          {listed.map(({ c, km }) => {
            const open = selected === c.name;
            return (
              <li key={c.name} className={`rounded-xl border ${open ? "border-[#0F9488] bg-[#F1FAFA]" : "border-slate-200"}`}>
                <button type="button" aria-expanded={open} onClick={() => setSelected(open ? null : c.name)} className="flex min-h-14 w-full items-center gap-3 p-3 text-left cursor-pointer" data-testid="nearby-row">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#D5EFEF] text-[#0F766E]"><Hospital className="size-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-black">{c.name}</span>
                    <span className="block text-xs text-slate-600">{km !== null ? `${km.toFixed(1)} km in a straight line` : c.area}</span>
                  </span>
                  {open ? <ChevronDown className="size-5 shrink-0 text-slate-500" aria-hidden="true" /> : <ChevronRight className="size-5 shrink-0 text-slate-500" aria-hidden="true" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 text-xs text-slate-700" data-testid="nearby-details">
                    {selectedRoute && <p className="mb-1 text-sm font-semibold text-black" data-testid="nearby-route">{`${selectedRoute.km.toFixed(1)} km by road`} · {trafficRange(selectedRoute.km, selectedRoute.minutes)}</p>}
                    {place_(c) && <p>{place_(c)}</p>}
                    {c.services.length > 0 && <p className="mt-1">{c.services.join(", ").replace(/_/g, " ").toLowerCase()}</p>}
                    <p className="mt-1 font-semibold text-[#BA2D0B]">This is not your assigned centre.</p>
                    <a href={directionsUrl(c.latitude as number, c.longitude as number)} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-black" data-testid="nearby-directions"><Navigation className="size-4" aria-hidden="true" />Directions to this centre</a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>}
      </div>
    </section>
  );
}
