import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CircleHelp, Maximize2, Minus, Plus, RotateCcw, ScanSearch, Sparkles } from "lucide-react";

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
  { id: "anatomy", label: "Anatomy", icon: Sparkles, labels: ["tz", "cervix", "os"], cam: [0, -0.2, 16], target: [0, -0.25, 0], ring: 0x0284c7, text: "Drag to rotate in 3D. Select any anatomical marker to inspect cervical and uterine structures." },
  { id: "screening", label: "Screening (VIA)", icon: ScanSearch, labels: ["tz", "os"], cam: [0.5, -1.2, 5.8], target: [0, -1.05, 0.2], ring: 0x9d174d, text: "Visual Inspection with Acetic Acid (VIA) inspects the transformation zone for acetowhite epithelial changes." },
  { id: "findings", label: "Clinical Guidance", icon: CircleHelp, labels: ["tz"], cam: [-0.6, -1.1, 6], target: [0, -1.05, 0.2], ring: 0x9d174d, text: "Clinical triage maps Bethesda classifications (NILM, LSIL, HSIL, CIN 1–3) to immediate tertiary colposcopy referral." },
] as const;
type Mode = (typeof MODES)[number];

const clamp = THREE.MathUtils.clamp;
const smooth = THREE.MathUtils.smoothstep;
const hex = (c: number) => new THREE.Color(c);

// Half-width of the opening carved into the front of the organ at height y: cavity, canal, then vagina.
function opening(y: number): number {
  let w = 0;
  if (y > 0.35 && y < 1.98) w = (0.1 + 0.92 * Math.pow((y - 0.35) / 1.5, 1.15)) * Math.sqrt(clamp((1.98 - y) / 0.2, 0, 1));
  if (y >= -0.65 && y <= 0.4) w = Math.max(w, 0.075);
  if (y < -0.5) w = Math.max(w, 0.6 * Math.sqrt(clamp((-0.5 - y) / 0.28, 0, 1)));
  return w;
}

function buildOrgan() {
  const profile = new THREE.SplineCurve(
    ([[0.001, 2.28], [0.7, 2.22], [1.25, 2.0], [1.55, 1.62], [1.45, 1.15], [1.12, 0.6], [0.82, 0.05], [0.72, -0.45], [0.8, -0.9], [0.84, -1.4], [0.76, -2.1], [0.68, -2.95]] as const).map(([r, y]) => new THREE.Vector2(r, y)),
  ).getSpacedPoints(240);
  const seg = 320;
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const skin = hex(0xec8c88), light = hex(0xf6b6ad), wall = hex(0xf0a097), cavity = hex(0xb02d3d), canal = hex(0x9c2535), vagina = hex(0xd85a63), c = new THREE.Color();
  profile.forEach((p, j) => {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = p.x * Math.cos(a);
      const y = p.y;
      let z = p.x * 0.68 * Math.sin(a);
      const fibre = 0.5 + 0.5 * Math.sin(Math.abs(x) * 30 + y * 14 + 2 * Math.sin(y * 5));
      z *= 1 + 0.008 * fibre;
      c.copy(skin).lerp(light, fibre * 0.42);
      if (z > 0) {
        const w = opening(y);
        const inVagina = y < -0.5;
        const t = w > 0 ? smooth(w - Math.abs(x), 0, 0.09) : 0;
        const floor = inVagina ? -0.25 + 0.035 * Math.sin(y * 32) : -0.06;
        const lip = w > 0 ? Math.exp(-(((Math.abs(x) - w) / 0.07) ** 2)) * 0.05 : 0;
        z = z * (1 - t) + floor * t + lip * (1 - t);
        if (t > 0) {
          const deep = inVagina ? c.clone().copy(vagina).multiplyScalar(0.86 + 0.14 * (0.5 + 0.5 * Math.sin(y * 32))) : (w < 0.1 ? canal : cavity);
          c.copy(wall).lerp(light, fibre * 0.5).lerp(deep, smooth(t, 0.35, 0.9));
        }
      }
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b, smooth(y, -2.95, -2.2));
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
  return new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, transparent: true, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.32, envMapIntensity: 0.5, side: THREE.DoubleSide }));
}

function buildCervix() {
  const g = new THREE.SphereGeometry(0.62, 160, 120);
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const base = hex(0xee7d86), zone = hex(0xf49a78), dark = hex(0x8e1f30), c = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.sqrt(v.x * v.x + v.y * v.y);
    const inTz = Math.exp(-(((r - 0.34) / 0.11) ** 2));
    const inOs = smooth(0.12 - r, 0, 0.06);
    c.copy(base).lerp(zone, inTz * 0.9).lerp(dark, inOs * 0.95);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.28, envMapIntensity: 0.6 }));
  m.position.set(0, -1.02, 0.44);
  m.scale.set(1, 0.85, 0.68);
  return m;
}

function taperedTube(points: [number, number, number][], radius: number, taper: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const g = new THREE.TubeGeometry(curve, 64, radius, 24, false);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const u = i / p.count;
    const s = 1 - (1 - taper) * u;
    p.setXYZ(i, v.x * s, v.y * s, v.z * s);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

function fimbriae(material: THREE.Material) {
  const g = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const pts: [number, number, number][] = [
      [0, 0, 0],
      [Math.cos(a) * 0.12, Math.sin(a) * 0.12 - 0.05, 0.08],
      [Math.cos(a) * 0.22, Math.sin(a) * 0.22 - 0.12, 0.2],
    ];
    g.add(taperedTube(pts, 0.024, 0.3, material));
  }
  return g;
}

function adnexa(side: 1 | -1, tubeMaterial: THREE.Material, fringeMaterial: THREE.Material, ovaryMaterial: THREE.Material) {
  const g = new THREE.Group();
  const tubePts: [number, number, number][] = [
    [1.15, 1.82, 0],
    [1.7, 2.05, 0.1],
    [2.35, 2.05, -0.05],
    [2.65, 1.6, -0.15],
    [2.5, 1.1, -0.05],
  ];
  g.add(taperedTube(tubePts, 0.08, 0.55, tubeMaterial));
  const fringe = fimbriae(fringeMaterial);
  fringe.position.set(2.5, 1.05, -0.05);
  g.add(fringe);
  const ovaryGeo = new THREE.SphereGeometry(0.38, 48, 36);
  const p = ovaryGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const bump = 1 + 0.08 * Math.sin(v.x * 12) * Math.cos(v.y * 12);
    v.multiplyScalar(bump);
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
  const tubeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe67679, roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.3, envMapIntensity: 0.5 });
  const fringeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd95f68, roughness: 0.42, clearcoat: 0.5, envMapIntensity: 0.4 });
  const ovaryMaterial = new THREE.MeshPhysicalMaterial({ color: 0xedb9a0, roughness: 0.46, clearcoat: 0.5, envMapIntensity: 0.45 });
  [1, -1].forEach((side) => {
    const a = adnexa(side as 1 | -1, tubeMaterial, fringeMaterial, ovaryMaterial);
    a.traverse((o) => { if (o instanceof THREE.Mesh && side === -1) (o.material as THREE.Material).side = THREE.DoubleSide; });
    group.add(a);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.013, 10, 96), new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true }));
  ring.position.set(0, -1.02, 0.62);
  group.add(buildOrgan(), buildCervix(), ring);
  return { group, ring };
}

/** Interactive anatomy figure seamlessly integrated into the landing hero. */
export default function CervixModel() {
  const stage = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const zoomBy = useRef<(factor: number) => void>(() => undefined);
  const toggleSpin = useRef<() => boolean>(() => false);
  const look = useRef<(mode: Mode) => void>(() => undefined);
  const ringColor = useRef<(color: number) => void>(() => undefined);
  const pins = useRef<Record<string, HTMLButtonElement | null>>({});
  const tags = useRef<Record<string, HTMLButtonElement | null>>({});
  const lines = useRef<Record<string, SVGLineElement | null>>({});
  const [webgl, setWebgl] = useState(true);
  const [active, setActive] = useState("tz");
  const [modeId, setModeId] = useState<Mode["id"]>("anatomy");
  const [showMode, setShowMode] = useState(true);
  const [spinning, setSpinning] = useState(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];
  const part = PARTS.find((p) => p.id === active) ?? PARTS[0];
  const shown = new Set<string>(mode.labels);
  if (!showMode) shown.add(active);

  const noteTitle = showMode ? mode.label : part.label;
  const noteText = showMode ? mode.text : part.text;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
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
    camera.position.set(...(MODES[0].cam as unknown as Vec));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xf3d9d2, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(3, 5, 7);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-5, -3, 4);
    scene.add(key, fill);
    const { group: model, ring } = buildModel();
    scene.add(model);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...(MODES[0].target as unknown as Vec));
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let spin = !still;
    let goal: { cam: THREE.Vector3; target: THREE.Vector3 } | null = null;
    renderer.domElement.style.touchAction = "pan-y";
    controls.addEventListener("start", () => { goal = null; });
    zoomBy.current = (f) => {
      goal = null;
      const offset = camera.position.clone().sub(controls.target);
      camera.position.copy(controls.target).add(offset.setLength(clamp(offset.length() * f, 3, 20)));
    };
    toggleSpin.current = () => { spin = !spin; return spin; };
    look.current = (m) => {
      goal = { cam: new THREE.Vector3(...(m.cam as unknown as Vec)), target: new THREE.Vector3(...(m.target as unknown as Vec)) };
      if (still) { camera.position.copy(goal.cam); controls.target.copy(goal.target); goal = null; }
    };
    ringColor.current = (color) => (ring.material as THREE.MeshBasicMaterial).color.setHex(color);
    const wheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy.current(e.deltaY > 0 ? 1.08 : 0.93); } };
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    const size = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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
        if (spin) swing += 0.008;
        model.rotation.y = Math.sin(swing) * 0.32;
        model.position.y = Math.sin(t / 1400) * 0.025;
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t / 450) * 0.3;
      }
      renderer.render(scene, camera);
      const w = el.clientWidth;
      const h = el.clientHeight;
      const front = camera.position.clone().sub(controls.target).normalize().z > -0.2;
      PARTS.forEach((p) => {
        const pin = pins.current[p.id];
        if (!pin) return;
        v.set(p.at[0], p.at[1], p.at[2]).applyMatrix4(model.matrixWorld).project(camera);
        const x = ((v.x + 1) / 2) * w;
        const y = ((1 - v.y) / 2) * h;
        const inView = x > 0 && x < w && y > 0 && y < h;
        pin.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        pin.style.opacity = front && inView ? "1" : "0";
        pin.style.pointerEvents = front && inView ? "auto" : "none";
        const tag = tags.current[p.id];
        const line = lines.current[p.id];
        if (tag && line) {
          line.setAttribute("x1", String(x));
          line.setAttribute("y1", String(y));
          line.setAttribute("x2", String(p.side === "left" ? tag.offsetLeft + tag.offsetWidth : tag.offsetLeft));
          line.setAttribute("y2", String(tag.offsetTop + tag.offsetHeight / 2));
          line.style.opacity = front && inView ? "1" : "0";
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
  useEffect(() => { ringColor.current(mode.ring); }, [mode]);

  const pick = (id: string) => { setActive(id); setShowMode(false); };
  const expand = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void figure.current?.requestFullscreen?.();
  };

  return (
    <figure
      ref={figure}
      className="m-0 w-full relative select-none [&:fullscreen]:bg-slate-950 [&:fullscreen]:p-6"
      data-testid="cervix-model"
    >
      {/* Ambient Radial Medical Glow behind Model (Seamless blending into Hero backdrop) */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[320px] sm:w-[460px] h-[320px] sm:h-[460px] rounded-full bg-radial from-pink-200/35 via-sky-100/25 to-transparent blur-3xl opacity-80" />
      </div>

      <div
        ref={stage}
        className="relative w-full h-[450px] sm:h-[500px] lg:h-[520px] rounded-2xl border border-black/8 bg-linear-to-b from-white/75 via-white/40 to-white/80 backdrop-blur-xs shadow-xs overflow-hidden flex flex-col justify-between p-3.5"
      >
        {/* Full-bleed 3D Canvas */}
        <div
          ref={host}
          className="absolute inset-0 cursor-grab active:cursor-grabbing [&>canvas]:block"
          data-testid="cervix-canvas"
        />

        {/* Top Header Floating Glass Pill: Modes & Quick Actions */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          {/* Mode Segmented Glass Tabs */}
          <div
            className="inline-flex items-center p-1 rounded-lg bg-white/90 backdrop-blur-md border border-black/10 shadow-2xs gap-0.5"
            role="group"
            aria-label="Clinical exploration modes"
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={modeId === m.id}
                onClick={() => {
                  setModeId(m.id);
                  setShowMode(true);
                }}
                data-testid={`mode-${m.id}`}
                className={`h-7 px-2.5 rounded-md text-[11px] font-heading font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  modeId === m.id
                    ? "bg-[#0F172A] text-white font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <m.icon className="size-3 shrink-0" aria-hidden="true" />
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Controls: Rotate, Zoom & Fullscreen */}
          <div className="inline-flex items-center gap-1 bg-white/90 backdrop-blur-md border border-black/10 shadow-2xs rounded-lg p-1">
            <button
              type="button"
              className={`size-7 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                spinning ? "text-[#0284C7] bg-sky-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              aria-label="Toggle autorotate"
              title="Toggle autorotate"
              onClick={() => setSpinning(toggleSpin.current())}
              data-testid="spin"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              type="button"
              className="size-7 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() => zoomBy.current(0.85)}
              data-testid="zoom-in"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              type="button"
              className="size-7 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() => zoomBy.current(1.18)}
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              className="size-7 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              aria-label="Fullscreen"
              title="Fullscreen"
              onClick={expand}
              data-testid="expand"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Anatomical Pins & Overlay Tags */}
        {webgl ? (
          <>
            <svg className="absolute inset-0 size-full pointer-events-none z-10" aria-hidden="true">
              {PARTS.filter((p) => shown.has(p.id)).map((p) => (
                <line
                  key={p.id}
                  ref={(l) => { lines.current[p.id] = l; }}
                  stroke="#0284C7"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              ))}
            </svg>

            {PARTS.map((p) => (
              <button
                key={p.id}
                ref={(b) => { pins.current[p.id] = b; }}
                type="button"
                title={p.label}
                aria-label={p.label}
                aria-pressed={!showMode && active === p.id}
                onClick={() => pick(p.id)}
                data-testid={`pin-${p.id}`}
                className="absolute left-0 top-0 size-6 flex items-center justify-center cursor-pointer rounded-full z-15 group"
              >
                <span
                  className={`block rounded-full bg-white shadow-sm transition-all ${
                    !showMode && active === p.id
                      ? "size-4 border-[3px] border-[#9D174D] ring-4 ring-pink-100"
                      : "size-2.5 border-2 border-[#0284C7] group-hover:scale-125"
                  }`}
                />
              </button>
            ))}

            {PARTS.filter((p) => shown.has(p.id)).map((p) => (
              <button
                key={p.id}
                ref={(b) => { tags.current[p.id] = b; }}
                type="button"
                tabIndex={-1}
                onClick={() => pick(p.id)}
                style={{ top: `${p.top}%` }}
                data-testid={`tag-${p.id}`}
                className={`absolute ${
                  p.side === "left" ? "left-2" : "right-2"
                } max-w-[42%] rounded-md bg-white/95 backdrop-blur-md shadow-2xs border border-black/10 px-2 py-0.5 text-[11px] font-heading font-semibold text-slate-800 cursor-pointer z-15 hover:border-[#0284C7] hover:text-[#0284C7] transition-all`}
              >
                {p.label}
              </button>
            ))}
          </>
        ) : (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-600" data-testid="cervix-fallback">
            The 3D interactive view is not available on this device.
          </p>
        )}

        {/* Bottom Floating Glass Card: Part Description & Live Annotation */}
        <div
          className="relative z-10 rounded-xl bg-white/90 backdrop-blur-md border border-black/10 p-3 sm:px-4 sm:py-2.5 shadow-2xs flex items-center justify-between gap-3 text-xs"
          aria-live="polite"
          data-testid="cervix-note"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-slate-900 tracking-tight">
                {noteTitle}
              </span>
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-sky-50 text-[#0369A1] border border-sky-200 font-semibold">
                Interactive Specimen
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-600 font-sans line-clamp-2 leading-relaxed">
              {noteText}
            </p>
          </div>

          <span className="hidden sm:inline-flex shrink-0 text-[10px] font-mono-data text-slate-400">
            Drag to rotate
          </span>
        </div>
      </div>
    </figure>
  );
}
