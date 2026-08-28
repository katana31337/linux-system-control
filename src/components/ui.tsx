import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { groupColor } from "../data";

// ─── Иконки (inline SVG) ────────────────────────────────────────────────────
const P: Record<string, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  server: <><rect x="2" y="3" width="20" height="7" rx="2" /><rect x="2" y="14" width="20" height="7" rx="2" /><path d="M6 6.5h.01M6 17.5h.01M10.5 6.5h3M10.5 17.5h3" /></>,
  terminal: <><path d="m4 17 6-5-6-5" /><path d="M12 19h8" /></>,
  users: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
  scroll: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  key: <><path d="m21 2-2 2" /><path d="M15.5 7.5 19 4l1 1-3.5 3.5" /><circle cx="8.5" cy="15.5" r="5.5" /><path d="m12.4 11.6 3.1-3.1" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  refresh: <><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
  power: <><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><path d="M12 2v10" /></>,
  play: <path d="M6 4l14 8-14 8z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  chevR: <path d="m9 18 6-6-6-6" />,
  chevD: <path d="m6 9 6 6 6-6" />,
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M13 2v7h7" /></>,
  wifi: <><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><path d="M12 20h.01" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /></>,
  out: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  menu: <path d="M3 12h18M3 6h18M3 18h18" />,
  trash: <><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  send: <><path d="m22 2-11 11" /><path d="M22 2 15 22l-4-9-9-4z" /></>,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  cpu: <><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></>,
  ram: <><rect x="2" y="6" width="20" height="11" rx="2" /><path d="M6 10v3M10 10v3M14 10v3M18 10v3M6 17v3M18 17v3" /></>,
  disk: <><path d="M22 12H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /><path d="M6 16h.01M10 16h.01" /></>,
  db: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>,
  net: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  box: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.27 6.96 8.73 5.05 8.73-5.05" /><path d="M12 22.08V12" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  zap: <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  radar: <><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" /><path d="M2.29 9.62a10 10 0 1 0 19.02-1.27" /><path d="M16.24 7.76a6 6 0 1 0-8.01 8.91" /><path d="M17.99 11.66a6 6 0 0 1-2.22 4.58" /><circle cx="12" cy="12" r="2" /><path d="m13.41 10.59 5.66-5.66" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ n, size = 16, className = "" }: { n: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      {P[n]}
    </svg>
  );
}

// ─── Графики ────────────────────────────────────────────────────────────────
export function Sparkline({ data, color, w = 110, h = 30, fill = false, sw = 1.6 }: { data: number[]; color: string; w?: number; h?: number; fill?: boolean; sw?: number }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / rng) * (h - 7)] as const);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const lp = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="block overflow-visible">
      {fill && <polygon points={`0,${h} ${line} ${w},${h}`} fill={color} opacity="0.13" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lp[0]} cy={lp[1]} r="2.4" fill={color} />
    </svg>
  );
}

export function AreaChart({ data, color, h = 150, max = 100, unit = "%" }: { data: number[]; color: string; h?: number; max?: number; unit?: string }) {
  const W = 600;
  if (data.length < 2) return null;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, h - 6 - (Math.min(v, max) / max) * (h - 20)] as const);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const gid = `g${color.replace("#", "")}`;
  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${h}`} className="w-full block" style={{ height: h }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={h * f} y2={h * f} stroke="#22304a" strokeWidth="1" strokeDasharray="3 6" />
        ))}
        <polygon points={`0,${h} ${line} ${W},${h}`} fill={`url(#${gid})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="absolute right-2 top-1 font-mono text-[10px] text-dim tnum">{max}{unit}</div>
      <div className="absolute right-2 bottom-1 font-mono text-[10px] text-dim tnum">0</div>
    </div>
  );
}

export function Gauge({ value, color, size = 92, label }: { value: number; color: string; size?: number; label: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1c2739" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-lg font-bold tnum" style={{ color }}>{Math.round(v)}<span className="text-[11px] text-mut">%</span></div>
      </div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export function BarMeter({ value, color, className = "" }: { value: number; color: string; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-[#1a2436] overflow-hidden ${className}`}>
      <div className="h-full rounded-full barfill" style={{ width: `${Math.min(100, value)}%`, background: color, transition: "width .9s cubic-bezier(.2,.7,.2,1)" }} />
    </div>
  );
}

// ─── Статусы и чипы ─────────────────────────────────────────────────────────
export function StatusDot({ status, pulse = true }: { status: "online" | "warning" | "offline"; pulse?: boolean }) {
  const c = status === "online" ? "#3ecf8e" : status === "warning" ? "#ffb224" : "#f0566a";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${pulse && status !== "offline" ? "ring-pulse" : ""}`}
      style={{ background: c, ["--ring-c" as string]: c + "66" }}
    />
  );
}

export function GroupChip({ name }: { name: string }) {
  const c = groupColor(name);
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-mono text-[11px] whitespace-nowrap"
      style={{ color: c, borderColor: c + "44", background: c + "12" }}>
      <span className="w-1.5 h-1.5 rounded-[2px]" style={{ background: c }} />
      {name}
    </span>
  );
}

export function Tag({ t }: { t: string }) {
  return <span className="px-1.5 py-0.5 rounded bg-[#1a2436] border border-line font-mono text-[10px] text-mut">{t}</span>;
}

// ─── Модальное окно ─────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, w = 540, icon }: { open: boolean; onClose: () => void; title: string; children: ReactNode; w?: number; icon?: IconName }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${open ? "" : "pointer-events-none"}`}>
      <div className={`absolute inset-0 bg-[#06080d]/75 backdrop-blur-[2px] transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div className={`relative card anim-pop shadow-2xl shadow-black/60 w-full transition-all duration-200 ${open ? "opacity-100" : "opacity-0 scale-95"}`} style={{ maxWidth: w }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-amber"><Icon n={icon} size={17} /></span>}
            <h3 className="font-display font-semibold text-[15px] tracking-wide">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-mut hover:text-ink hover:bg-raise transition-colors cursor-pointer"><Icon n="x" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Тосты ──────────────────────────────────────────────────────────────────
interface Toast { id: number; msg: string; kind: "ok" | "err" | "info" }
const ToastCtx = createContext<(msg: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-3), { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  const meta = { ok: ["#3ecf8e", "check"] as const, err: ["#f0566a", "alert"] as const, info: ["#56c8e8", "activity"] as const };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[80] space-y-2.5">
        {list.map((t) => {
          const [c, ic] = meta[t.kind];
          return (
            <div key={t.id} className="anim-pop card flex items-center gap-3 pl-3.5 pr-4 py-3 min-w-[280px] max-w-[380px] shadow-xl shadow-black/50" style={{ borderLeft: `3px solid ${c}` }}>
              <span style={{ color: c }}><Icon n={ic} size={16} /></span>
              <span className="text-[13px] leading-snug">{t.msg}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// ─── Мелочи ─────────────────────────────────────────────────────────────────
export function CopyBtn({ text, label }: { text: string; label?: string }) {
  const toast = useToast();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).catch(() => {});
        toast("Скопировано в буфер обмена", "info");
      }}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-line text-mut hover:text-amber hover:border-amber/40 transition-colors font-mono text-[11px] cursor-pointer"
    >
      <Icon n="copy" size={13} /> {label ?? "copy"}
    </button>
  );
}

export function SectionHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
      <div>
        <h2 className="font-display text-xl font-bold tracking-wide">{title}</h2>
        {sub && <p className="text-[13px] text-mut mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
