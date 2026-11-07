import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CalendarDays, ChevronDown, CircleHelp, Crosshair, Info, Maximize2, Minus, Plus, RotateCcw, ScanSearch, Sparkles } from "lucide-react";

type Vec = [number, number, number];
type Part = { id: string; label: string; at: Vec; text: string; side: "left" | "right"; top: number };
const PARTS: Part[] = [
  { id: "tz", label: "Transformation zone", at: [-0.3, -0.86, 0.62], side: "left", top: 40, text: "Where two types of cervical cells meet. Most cervical precancer begins here, so screening looks closely at this area." },
  { id: "cervix", label: "Cervix", at: [-0.42, -1.2, 0.5], side: "left", top: 54, text: "The lower part of the uterus, which opens into the vagina." },
  { id: "os", label: "External os", at: [0, -1.02, 0.68], side: "right", top: 62, text: "The opening of the cervix into the vagina." },
  { id: "ecto", label: "Ectocervix", at: [0.45, -1.22, 0.47], side: "right", top: 72, text: "The outer part of the cervix, seen during a speculum examination." },
  { id: "canal", label: "Endocervical canal", at: [0, -0.2, 0], side: "right", top: 44, text: "The narrow passage that connects the vagina and the uterus." },
  { id: "internal", label: "Internal os", at: [0, 0.38, 0], side: "left", top: 28, text: "The inner opening, where the cervical canal meets the uterine cavity." },
  { id: "fornix", label: "Vaginal fornix", at: [0.52, -0.72, 0.12], side: "right", top: 52, text: "The recess of the vagina that surrounds the cervix." },
  { id: "uterus", label: "Uterus", at: [1.0, 1.2, 0.71], side: "right", top: 30, text: "The muscular organ above the cervix." },
  { id: "tube", label: "Fallopian tube", at: [-2.45, 2.2, 0], side: "left", top: 4, text: "The tube that links each ovary region to the uterus." },
  { id: "ovary", label: "Ovary", at: [2.25, 0.85, 0.32], side: "right", top: 18, text: "One of two organs that store eggs and make hormones." },
];
const MODES = [
  { id: "anatomy", label: "Anatomy", icon: Sparkles, labels: ["cervix"], cam: [1.3, 0.25, 11], target: [0, 0, 0], ring: 0x0f766e, text: "Drag to rotate, and select a point to learn about each part." },
  { id: "screening", label: "Screening (VIA)", icon: ScanSearch, labels: ["tz", "os"], cam: [0.5, -1.2, 5.8], target: [0, -1.05, 0.2], ring: 0xf19941, text: "In VIA, a health worker looks at the cervix after applying dilute acetic acid. The highlighted ring marks the transformation zone. A positive screen is not a diagnosis." },
  { id: "followup", label: "Changes Over 14 Days", icon: CalendarDays, labels: ["os"], cam: [2.4, 0, 11], target: [0, 0, 0], ring: 0x0f766e, text: "" },
  { id: "findings", label: "Common findings", icon: CircleHelp, labels: ["tz"], cam: [-0.6, -1.1, 6], target: [0, -1.05, 0.2], ring: 0xba2d0b, text: "Reports may use terms like NILM, LSIL, HSIL, or CIN 1 to 3. Only histopathology and the treating doctor confirm a diagnosis." },
] as const;
type Mode = (typeof MODES)[number];

// Placeholder notice: the mesh below is procedural. Set VITE_CERVIX_MODEL_URL to a licensed GLB to replace it.
// A GLB may include empty nodes named anchor_<part id> so annotation points follow the real anatomy.
const MODEL_URL: string = import.meta.env.VITE_CERVIX_MODEL_URL ?? "";
const HALF_W = 3.6;
const HALF_H = 2.65;
const isWide = (m: Mode) => m.id === "anatomy" || m.id === "followup";

const STOPS = [
  { to: 10, title: "Daily reminders", color: 0x0f766e, text: "After a referral, reminders go out only if she has agreed to messages." },
  { to: 13, title: "Intensive contact", color: 0xf19941, text: "Health staff try to reach her directly and record what happened." },
  { to: 14, title: "ASHA home visit", color: 0xba2d0b, text: "An ASHA worker is assigned to visit. A refusal, or no contact, goes to a doctor for review." },
];

const clamp = THREE.MathUtils.clamp;
const smooth = THREE.MathUtils.smoothstep;
const hex = (c: number) => new THREE.Color(c);

// Half-width of the opening carved into the front of the organ at height y: cavity, canal, then vagina.
function opening(y: number): number {
  let w = 0;
  if (y > 0.35 && y < 1.98) w = (0.08 + 0.6 * Math.pow((y - 0.35) / 1.5, 1.15)) * Math.sqrt(clamp((1.98 - y) / 0.2, 0, 1));
  if (y >= -0.65 && y <= 0.4) w = Math.max(w, 0.075);
  if (y < -0.5) w = Math.max(w, 0.56 * Math.sqrt(clamp((-0.5 - y) / 0.28, 0, 1)));
  return w;
}

function buildOrgan() {
  const profile = new THREE.SplineCurve(
    ([[0.001, 2.28], [0.7, 2.22], [1.25, 2.0], [1.55, 1.62], [1.45, 1.15], [1.12, 0.6], [0.82, 0.05], [0.72, -0.45], [0.8, -0.9], [0.84, -1.4], [0.76, -1.95], [0.7, -2.45]] as const).map(([r, y]) => new THREE.Vector2(r, y)),
  ).getSpacedPoints(240);
  const seg = 320;
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const skin = hex(0xe9a09a), light = hex(0xf2b9b0), wall = hex(0xeeb0a6), cavity = hex(0xb9525b), canal = hex(0xa5434f), vagina = hex(0xcf7a7c), c = new THREE.Color();
  profile.forEach((p, j) => {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = p.x * Math.cos(a);
      const y = p.y;
      let z = p.x * 0.68 * Math.sin(a);
      const fibre = 0.5 + 0.5 * Math.sin(Math.abs(x) * 30 + y * 14 + 2 * Math.sin(y * 5));
      z *= 1 + 0.0015 * fibre;
      c.copy(skin).lerp(light, fibre * 0.1).multiplyScalar(0.84 + 0.16 * Math.max(0, Math.sin(a)));
      if (z > 0) {
        const w = opening(y);
        const inVagina = y < -0.5;
        const t = w > 0 ? smooth(w - Math.abs(x), 0, 0.16) : 0;
        const floor = inVagina ? -0.25 + 0.012 * Math.sin(y * 26) : -0.06;
        const lip = w > 0 ? Math.exp(-(((Math.abs(x) - w) / 0.07) ** 2)) * 0.05 : 0;
        z = z * (1 - t) + floor * t + lip * (1 - t);
        if (t > 0) {
          const deep = inVagina ? c.clone().copy(vagina).multiplyScalar(0.94 + 0.06 * (0.5 + 0.5 * Math.sin(y * 26))) : (w < 0.1 ? canal : cavity);
          c.copy(wall).lerp(light, fibre * 0.08).lerp(deep, smooth(t, 0.35, 0.9));
        }
      }
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b, smooth(y, -2.45, -1.8));
      if (j < profile.length - 1) {
        const n = (i + 1) % seg;
        index.push(j * seg + i, j * seg + n, (j + 1) * seg + i, j * seg + n, (j + 1) * seg + n, (j + 1) * seg + i);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(index);
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, transparent: true, roughness: 0.56, clearcoat: 0.22, clearcoatRoughness: 0.5, envMapIntensity: 0.32, side: THREE.DoubleSide }));
}

function buildCervix() {
  const g = new THREE.SphereGeometry(0.62, 160, 120);
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const base = hex(0xe58f92), zone = hex(0xeeaa94), dark = hex(0x96404a), c = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = Math.hypot(v.x, v.y);
    c.copy(base);
    if (v.z > 0) {
      const slit = Math.exp(-((v.x / 0.04) ** 2) - (v.y / 0.17) ** 2);
      v.multiplyScalar(1 - slit * 0.22 - Math.exp(-((d / 0.22) ** 2)) * 0.1);
      c.lerp(zone, Math.exp(-(((d - 0.3) / 0.12) ** 2)) * 0.75).lerp(dark, clamp(slit * 1.2, 0, 1));
    }
    p.setXYZ(i, v.x, v.y, v.z);
    c.toArray(colors, i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, clearcoat: 0.28, clearcoatRoughness: 0.45, envMapIntensity: 0.35 }));
  m.position.set(0, -1.02, 0.2);
  m.scale.set(1, 0.95, 0.78);
  return m;
}

function taperedTube(points: Vec[], radius: number, end: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const n = 64, r = 14;
  const g = new THREE.TubeGeometry(curve, n, radius, r);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const center = curve.getPointAt(i / n);
    const scale = 1 + (end - 1) * (i / n);
    for (let k = 0; k <= r; k++) {
      const at = i * (r + 1) + k;
      v.fromBufferAttribute(p, at).sub(center).multiplyScalar(scale).add(center);
      p.setXYZ(at, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

function adnexa(side: 1 | -1, tubeMaterial: THREE.Material, fringeMaterial: THREE.Material, ovaryMaterial: THREE.Material) {
  const g = new THREE.Group();
  g.add(taperedTube([[1.42, 1.72, 0], [1.95, 2.18, 0], [2.65, 2.3, 0.02], [3.2, 1.85, 0.05], [3.25, 1.3, 0.1]], 0.1, 1.9, tubeMaterial));
  for (let i = 0; i < 14; i++) {
    const a = -1.05 + (i / 13) * 2.1;
    const reach = 0.42 + (i % 3) * 0.1;
    g.add(taperedTube([[3.25, 1.32, 0.1], [3.25 + Math.sin(a) * reach * 0.5, 1.1, 0.1 + Math.cos(a) * 0.1], [3.2 + Math.sin(a) * reach, 0.86 + (i % 2) * 0.1, 0.1 + Math.cos(a * 2) * 0.18]], 0.05, 0.35, fringeMaterial));
  }
  const ovaryGeo = new THREE.SphereGeometry(0.42, 56, 40);
  const p = ovaryGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + 0.035 * Math.sin(v.x * 17) * Math.sin(v.y * 19) * Math.sin(v.z * 15 + 1));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  ovaryGeo.computeVertexNormals();
  const ovary = new THREE.Mesh(ovaryGeo, ovaryMaterial);
  ovary.scale.set(1.2, 0.82, 0.82);
  ovary.position.set(2.3, 0.85, 0);
  g.add(ovary, taperedTube([[1.36, 1.2, 0], [1.75, 0.95, 0], [2.1, 0.85, 0]], 0.075, 0.8, tubeMaterial));
  g.scale.x = side;
  return g;
}

function buildModel() {
  const group = new THREE.Group();
  const tubeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe39a96, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.3 });
  const fringeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd98a8a, roughness: 0.58, clearcoat: 0.15, envMapIntensity: 0.3 });
  const ovaryMaterial = new THREE.MeshPhysicalMaterial({ color: 0xecc3ae, roughness: 0.6, clearcoat: 0.15, envMapIntensity: 0.3 });
  [1, -1].forEach((side) => {
    const a = adnexa(side as 1 | -1, tubeMaterial, fringeMaterial, ovaryMaterial);
    a.traverse((o) => { if (o instanceof THREE.Mesh && side === -1) (o.material as THREE.Material).side = THREE.DoubleSide; });
    group.add(a);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.008, 10, 96), new THREE.MeshBasicMaterial({ color: 0x0f766e, transparent: true }));
  ring.position.set(0, -1.02, 0.62);
  group.add(buildOrgan(), buildCervix(), ring);
  return { group, ring };
}

/** Interactive anatomy figure for the landing hero. Illustrative only: nothing here reads patient data or predicts disease. */
export default function CervixModel() {
  const stage = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const zoomBy = useRef<(factor: number) => void>(() => undefined);
  const toggleSpin = useRef<() => boolean>(() => false);
  const look = useRef<(mode: Mode) => void>(() => undefined);
  const ringColor = useRef<(color: number) => void>(() => undefined);
  const pins = useRef<Record<string, HTMLButtonElement | null>>({});
  const tags = useRef<Record<string, HTMLSpanElement | null>>({});
  const [webgl, setWebgl] = useState(true);
  const [active, setActive] = useState("tz");
  const [modeId, setModeId] = useState<Mode["id"]>("anatomy");
  const [showMode, setShowMode] = useState(true);
  const [panelOpen, setPanelOpen] = useState(() => window.matchMedia("(min-width: 640px)").matches);
  const [day, setDay] = useState(7);
  const [spinning, setSpinning] = useState(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];
  const stop = STOPS.find((x) => day <= x.to) ?? STOPS[2];
  const part = PARTS.find((p) => p.id === active) ?? PARTS[0];
  // One label at a time keeps the anatomy clear: the selected part, or the part this mode is about.
  const labelled = showMode ? mode.labels[0] : active;
  const noteTitle = showMode ? (modeId === "followup" ? stop.title : mode.label) : part.label;
  const noteText = showMode ? (modeId === "followup" ? stop.text : mode.text) : part.text;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL support is only known by trying
      setWebgl(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    
    scene.add(new THREE.HemisphereLight(0xffffff, 0xf3d9d2, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(3, 5, 7);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-5, -3, 4);
    scene.add(key, fill);
    const { group: model, ring } = buildModel();
    scene.add(model);
    const anchors: Record<string, THREE.Object3D> = {};
    if (MODEL_URL) {
      void import("three/examples/jsm/loaders/GLTFLoader.js").then(({ GLTFLoader }) => new GLTFLoader().load(MODEL_URL, (gltf) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const dims = box.getSize(new THREE.Vector3());
        gltf.scene.scale.setScalar(Math.min((HALF_W * 2) / dims.x, (HALF_H * 2) / dims.y));
        gltf.scene.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(gltf.scene.scale.x));
        [...model.children].forEach((child) => { if (child !== ring) model.remove(child); });
        model.add(gltf.scene);
        gltf.scene.traverse((o) => { if (o.name.startsWith("anchor_")) anchors[o.name.slice(7)] = o; });
      }, undefined, () => undefined)); // A failed download keeps the procedural model.
    }
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...(MODES[0].target as unknown as Vec));
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let spin = !still;
    let goal: { cam: THREE.Vector3; target: THREE.Vector3 } | null = null;
    renderer.domElement.style.touchAction = "pan-y";
    controls.addEventListener("start", () => { goal = null; fitted = false; });
    zoomBy.current = (f) => {
      goal = null;
      fitted = false;
      const offset = camera.position.clone().sub(controls.target);
      camera.position.copy(controls.target).add(offset.setLength(clamp(offset.length() * f, 3, 24)));
    };
    toggleSpin.current = () => { spin = !spin; return spin; };
    look.current = (m) => {
      modeNow = m;
      fitted = isWide(m);
      goal = { cam: camFor(m), target: new THREE.Vector3(...(m.target as unknown as Vec)) };
      if (still) { camera.position.copy(goal.cam); controls.target.copy(goal.target); goal = null; }
    };
    ringColor.current = (color) => (ring.material as THREE.MeshBasicMaterial).color.setHex(color);
    const wheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy.current(e.deltaY > 0 ? 1.08 : 0.93); } };
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    // The whole organ always fits: distance comes from the container's shape, not from CSS scaling.
    const fitDistance = () => {
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      return Math.max(HALF_H / tan, HALF_W / (tan * camera.aspect)) * 1.14;
    };
    let fitted = true;
    let modeNow: Mode = MODES[0];
    const camFor = (m: Mode) => {
      const c = new THREE.Vector3(...(m.cam as unknown as Vec));
      return isWide(m) ? c.setLength(fitDistance()) : c;
    };
    const size = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (fitted && isWide(modeNow)) camera.position.copy(camFor(modeNow));
    };
    const resized = new ResizeObserver(size);
    resized.observe(el);
    size();
    const v = new THREE.Vector3();
    let swing = 0;
    const frame = (t: number) => {
      if (goal) {
        camera.position.lerp(goal.cam, 0.07);
        controls.target.lerp(goal.target, 0.07);
        if (camera.position.distanceTo(goal.cam) < 0.02) goal = null;
      }
      controls.update();
      if (!still) {
        if (spin) swing += 0.004;
        model.rotation.y = Math.sin(swing) * 0.14;
        model.position.y = Math.sin(t / 2200) * 0.012;
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t / 450) * 0.3;
      }
      renderer.render(scene, camera);
      const w = el.clientWidth;
      const h = el.clientHeight;
      const front = camera.position.clone().sub(controls.target).normalize().z > -0.2;
      PARTS.forEach((p) => {
        const pin = pins.current[p.id];
        if (!pin) return;
        const anchor = anchors[p.id];
        if (anchor) anchor.getWorldPosition(v).project(camera);
        else v.set(p.at[0], p.at[1], p.at[2]).applyMatrix4(model.matrixWorld).project(camera);
        const x = ((v.x + 1) / 2) * w;
        const y = ((1 - v.y) / 2) * h;
        const inView = x > 0 && x < w && y > 0 && y < h;
        pin.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        pin.style.opacity = front && inView ? "1" : "0";
        pin.style.pointerEvents = front && inView ? "auto" : "none";
        const tag = tags.current[p.id];
        if (tag) {
          const width = tag.offsetWidth;
          const onRight = p.side === "right" && x + 18 + width < w;
          const left = clamp(onRight || x - 18 - width < 0 ? x + 18 : x - 18 - width, 4, Math.max(4, w - width - 4));
          tag.style.transform = `translate(${left}px, ${y - tag.offsetHeight / 2}px)`;
          tag.style.opacity = front && inView ? "1" : "0";
        }
      });
    };
    let running = false;
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; renderer.setAnimationLoop(frame); }
      if (!e.isIntersecting && running) { running = false; renderer.setAnimationLoop(null); }
    });
    seen.observe(el);
    return () => {
      seen.disconnect();
      resized.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("wheel", wheel);
      controls.dispose();
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
      });
      environment.dispose();
      room.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => { look.current(mode); }, [mode]);
  useEffect(() => { ringColor.current(modeId === "followup" ? stop.color : mode.ring); }, [modeId, stop, mode]);

  const pick = (id: string) => { setActive(id); setShowMode(false); };
  const expand = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void figure.current?.requestFullscreen?.(); };
  const roundBtn = "size-11 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center cursor-pointer hover:bg-slate-50 text-slate-800";
  const steps = [{ at: 0, day: "Day 0", label: "Referral" }, { at: 7, day: "Day 7", label: "Reminder" }, { at: 14, day: "Day 14", label: "Follow-up" }];

  return (
    <figure ref={figure} className="m-0 w-full [&:fullscreen]:overflow-auto [&:fullscreen]:p-6" data-testid="cervix-model">
      <div ref={stage} className="relative">
        <div className="relative h-[380px] sm:h-[480px] [:fullscreen_&]:h-[72vh] overflow-hidden bg-[radial-gradient(circle_at_50%_52%,#E4F5F4_0%,#F3FBFA_38%,#FFFFFF_68%)]">
          <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing [&>canvas]:block" data-testid="cervix-canvas" />
          {webgl ? (
            <>
              {PARTS.map((p) => (
                <button key={p.id} ref={(b) => { pins.current[p.id] = b; }} type="button" title={p.label} aria-label={p.label} aria-pressed={!showMode && active === p.id} onClick={() => pick(p.id)} data-testid={`pin-${p.id}`}
                  className="absolute left-0 top-0 size-6 flex items-center justify-center cursor-pointer rounded-full">
                  <span className={`block rounded-full ${!showMode && active === p.id ? "size-3 bg-[#0F766E] ring-[5px] ring-[#0F766E]/25" : "size-2.5 bg-white ring-[5px] ring-white/45 shadow"}`} />
                </button>
              ))}
              {PARTS.filter((p) => p.id === labelled).map((p) => (
                <span key={p.id} ref={(b) => { tags.current[p.id] = b; }} className="absolute left-0 top-0 pointer-events-none rounded-full bg-white/95 shadow-sm border border-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800 whitespace-nowrap" data-testid={`tag-${p.id}`}>{p.label}</span>
              ))}
              <div className="absolute right-1 top-1 flex gap-1.5">
                <button type="button" className="size-8 rounded-full bg-white border border-slate-200 flex items-center justify-center cursor-pointer" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy.current(0.85)} data-testid="zoom-in"><Plus className="size-3.5" /></button>
                <button type="button" className="size-8 rounded-full bg-white border border-slate-200 flex items-center justify-center cursor-pointer" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy.current(1.18)}><Minus className="size-3.5" /></button>
                <button type="button" className="size-8 rounded-full bg-white border border-slate-200 flex items-center justify-center cursor-pointer" aria-label="Reset view" title="Reset view" onClick={() => look.current(mode)} data-testid="reset-view"><Crosshair className="size-3.5" /></button>
              </div>
            </>
          ) : (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-600" data-testid="cervix-fallback">The 3D view is not available on this device. The anatomy guide below still works.</p>
          )}
        </div>
        <div id="explore-panel" hidden={!panelOpen} className="mt-2 sm:mt-0 sm:absolute sm:right-0 sm:bottom-3 sm:w-[148px] rounded-2xl bg-white sm:shadow-md sm:border border-slate-100 sm:p-1.5" role="group" aria-label="Explore" data-testid="explore-panel">
          <p className="hidden sm:block px-2 py-1 text-xs font-bold text-black">Explore</p>
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-1">
            {MODES.map((m) => (
              <button key={m.id} type="button" aria-pressed={modeId === m.id} onClick={() => { setModeId(m.id); setShowMode(true); }} data-testid={`mode-${m.id}`}
                className={`min-h-9 rounded-lg px-2 text-[11px] leading-tight text-left font-medium flex items-center gap-2 cursor-pointer ${modeId === m.id ? "bg-[#D5EFEF] text-[#0B5D57]" : "text-slate-700 hover:bg-slate-50"}`}>
                <m.icon className="size-4 shrink-0" aria-hidden="true" />{m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 sm:mt-0 sm:absolute sm:left-0 sm:bottom-3 sm:w-[172px] sm:bg-white/90 sm:rounded-xl sm:p-2 text-xs text-slate-700" data-testid="cervix-note">
          <div aria-live="polite"><strong className="block text-black">{noteTitle}</strong>{noteText}</div>
          <button type="button" aria-expanded={panelOpen} aria-controls="explore-panel" onClick={() => setPanelOpen(!panelOpen)} className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 font-semibold text-[#0B5D57] underline-offset-2 hover:underline cursor-pointer" data-testid="explore-toggle">
            {panelOpen ? "Hide Explore" : "Show Explore"}<ChevronDown className={`size-3.5 transition-transform motion-reduce:transition-none ${panelOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {showMode && (modeId === "screening" || modeId === "findings") && <em className="block mt-1 not-italic font-semibold text-[#BA2D0B]">Awaiting clinical review</em>}
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-white border border-slate-100 shadow-sm p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <label htmlFor="follow-up-day" className="flex items-center gap-2 text-sm font-bold text-black">
            <span>Referral Follow-up Journey (14 Days)</span>
            <Info className="size-4 shrink-0 text-slate-600" aria-hidden="true" />
          </label>
          <input id="follow-up-day" type="range" min={0} max={14} value={day} aria-valuetext={`Day ${day} of 14`} onChange={(e) => { setDay(Number(e.target.value)); setModeId("followup"); setShowMode(true); }} className="mt-2 w-full accent-[#14A098]" data-testid="timeline" />
          <div className="flex justify-between text-xs">
            {steps.map((s) => <button key={s.at} type="button" onClick={() => { setDay(s.at); setModeId("followup"); setShowMode(true); }} className={`cursor-pointer ${s.at === 7 ? "text-center" : s.at === 14 ? "text-right" : "text-left"}`}><strong className="block text-black">{s.day}</strong><span className="text-slate-600">{s.label}</span></button>)}
          </div>
          <span className="sr-only" data-testid="timeline-day">{`Day ${day} of 14`}</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="flex flex-col items-center gap-1 text-xs text-slate-700"><button type="button" className={roundBtn} aria-label="Rotate" aria-pressed={spinning} onClick={() => setSpinning(toggleSpin.current())} data-testid="spin"><RotateCcw className="size-4" /></button><span aria-hidden="true">Rotate</span></div>
          <div className="flex flex-col items-center gap-1 text-xs text-slate-700"><button type="button" className={roundBtn} aria-label="Expand" onClick={expand} data-testid="expand"><Maximize2 className="size-4" /></button><span aria-hidden="true">Expand</span></div>
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-slate-500">Illustrative model, not to scale. Colours and highlights show follow-up status only, not changes in the body or disease. Follow-up closes when the hospital confirms arrival.</figcaption>
    </figure>
  );
}
