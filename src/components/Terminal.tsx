import { useEffect, useMemo, useRef, useState } from "react";
import type { Server } from "../data";
import { ShellSession, type TermLine } from "../terminalEngine";

interface Line extends TermLine { prompt?: boolean; }

const CLS: Record<string, string> = {
  out: "text-ink/85",
  err: "text-bad",
  ok: "text-ok",
  warn: "text-amber",
  dim: "text-dim",
  cyan: "text-info",
  cmd: "text-ink",
};

export default function Terminal({ server, height = 460, onCommand }: { server: Server; height?: number; onCommand?: (cmd: string) => void }) {
  const session = useMemo(() => new ShellSession(), []);
  const [lines, setLines] = useState<Line[]>(() => [
    { t: `KONTUR OPS remote shell — подключение через агент ${server.ip}:${server.port}`, c: "dim" },
    { t: `${server.os} · ядро ${server.kernel} · токен сессии проверен ✔`, c: "dim" },
    { t: "help — список команд, ↑/↓ — история", c: "dim" },
    { t: "" },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState(session.cwd);
  const [busy, setBusy] = useState(false);
  const histIdx = useRef(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  const prompt = () => (
    <span className="whitespace-nowrap">
      <span className="text-ok font-semibold">admin@{server.name.split("-").slice(0, 2).join("-")}</span>
      <span className="text-dim">:</span>
      <span className="text-info">{cwd === "/home/admin" ? "~" : cwd}</span>
      <span className="text-amber font-semibold">$ </span>
    </span>
  );

  const submit = () => {
    const raw = input;
    if (busy) return;
    setInput("");
    histIdx.current = -1;
    setLines((l) => [...l, { t: raw, prompt: true }]);
    onCommand?.(raw);
    const res = session.run(raw, server);
    setCwd(session.cwd);
    if (res.clear) { setLines([]); return; }
    if (res.stream && res.lines.length > 2) {
      setBusy(true);
      res.lines.forEach((ln, i) => {
        setTimeout(() => {
          setLines((l) => [...l, ln]);
          if (i === res.lines.length - 1) setBusy(false);
        }, 180 + i * 170);
      });
    } else {
      setLines((l) => [...l, ...res.lines]);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { submit(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = session.hist;
      if (!h.length) return;
      histIdx.current = histIdx.current < 0 ? h.length - 1 : Math.max(0, histIdx.current - 1);
      setInput(h[histIdx.current]);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const h = session.hist;
      if (histIdx.current < 0) return;
      histIdx.current = histIdx.current >= h.length - 1 ? -1 : histIdx.current + 1;
      setInput(histIdx.current < 0 ? "" : h[histIdx.current]);
    }
    if (e.key === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  return (
    <div
      className="card overflow-hidden flex flex-col bg-[#0a0e15]"
      style={{ height }}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-panel">
        <span className="w-2.5 h-2.5 rounded-full bg-bad/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-ok/70" />
        <span className="ml-2 font-mono text-[11px] text-mut tracking-wider">admin@{server.name} — bash через kontur-agent (exec relay)</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-ok">
          <span className="w-1.5 h-1.5 rounded-full bg-ok ring-pulse" style={{ ["--ring-c" as string]: "#3ecf8e66" }} /> ws://{server.ip}:{server.port}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-[1.55] cursor-text">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {l.prompt && prompt()}
            <span className={l.prompt ? "text-ink" : CLS[l.c ?? "out"]}>{l.t}</span>
          </div>
        ))}
        {busy ? (
          <span className="text-dim">…</span>
        ) : (
          <div className="flex items-center">
            {prompt()}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              className="flex-1 bg-transparent outline-none text-ink caret-amber font-mono text-[12.5px] min-w-0"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
        )}
      </div>
    </div>
  );
}
