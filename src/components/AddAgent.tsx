import { useEffect, useRef, useState } from "react";
import { GROUPS, groupColor, handshakeMeta, makeAgentFromMeta, type AgentMeta, type Server } from "../data";
import { Icon, Modal, useToast } from "./ui";

const IP_RE = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const TOKEN_RE = /^[0-9a-f]{64}$/i;

type Phase = "form" | "handshake" | "done";
interface Step { label: string; state: "wait" | "run" | "ok" | "fail"; detail?: string; }

const HANDSHAKE_DEFS: [string, number][] = [
  ["TCP-соединение с агентом", 650],
  ["TLS-рукопожатие, проверка пина сертификата", 800],
  ["Проверка X-Agent-Token (constant-time)", 900],
  ["GET /v1/health — получение метаданных узла", 750],
];

export default function AddAgent({ open, onClose, onAdded }: {
  open: boolean;
  onClose: () => void;
  onAdded: (s: Server) => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("8443");
  const [group, setGroup] = useState(GROUPS[0]);
  const [token, setToken] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [meta, setMeta] = useState<AgentMeta | null>(null);
  const [failMsg, setFailMsg] = useState("");
  const toast = useToast();
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);
  useEffect(() => { if (open) { setPhase("form"); setSteps([]); setMeta(null); setFailMsg(""); } }, [open]);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const start = () => {
    setFailMsg("");
    if (!IP_RE.test(ip)) { setFailMsg("Некорректный IPv4-адрес агента"); return; }
    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) { setFailMsg("Порт должен быть числом от 1 до 65535"); return; }

    const tokenBad = !TOKEN_RE.test(token);
    setPhase("handshake");
    setSteps(HANDSHAKE_DEFS.map(([label]) => ({ label, state: "wait" })));

    let t = 0;
    const failAt = tokenBad ? 2 : -1;
    HANDSHAKE_DEFS.forEach(([, dur], i) => {
      t += 180;
      later(() => setSteps((s) => s.map((x, j) => (j === i ? { ...x, state: "run" } : x))), t);
      t += dur;
      later(() => setSteps((s) => s.map((x, j) => {
        if (j !== i) return x;
        if (j === failAt) return { ...x, state: "fail", detail: "агент ответил 401 Unauthorized: токен не принят" };
        return { ...x, state: "ok" };
      })), t);
      if (i === failAt) t += 100000; // дальше не идём
    });

    if (tokenBad) {
      setFailMsg("Агент отклонил токен. Убедитесь, что вставлен INSTALL TOKEN из вывода установки (64 hex-символа), и что токен не ротировали после установки.");
      return;
    }
    t += 350;
    later(() => { setMeta(handshakeMeta(ip, name)); setPhase("done"); }, t);
  };

  const commit = () => {
    if (!meta) return;
    const srv = makeAgentFromMeta(meta, ip, Number(port), group, token);
    onAdded(srv);
    toast(`Агент «${srv.name}» подключён и добавлен в реестр`, "ok");
    setName(""); setIp(""); setToken("");
    onClose();
  };

  const fieldCls = "w-full bg-panel border border-line rounded-lg px-3.5 py-2.5 text-[13.5px] font-mono placeholder:text-dim focus:border-amber/60 focus:bg-panel2 transition-colors outline-none";

  return (
    <Modal open={open} onClose={phase === "handshake" ? () => {} : onClose} title="Подключение агента" w={560}>
      {phase === "form" && (
        <div className="space-y-4">
          <p className="text-[12.5px] text-mut leading-relaxed">
            Укажите адрес, на котором агент слушает HTTPS-API, и <span className="text-ink">INSTALL TOKEN</span> из вывода установки.
            Консоль выполнит рукопожатие и только после проверки токена добавит узел в реестр.
          </p>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <label className="block">
              <span className="lbl block mb-1.5">IPv4-адрес агента</span>
              <input value={ip} onChange={(e) => setIp(e.target.value.trim())} placeholder="10.0.1.20" className={fieldCls} autoFocus />
            </label>
            <label className="block">
              <span className="lbl block mb-1.5">Порт</span>
              <input value={port} onChange={(e) => setPort(e.target.value.trim())} placeholder="8443" className={fieldCls} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="lbl block mb-1.5">Метка узла (необязательно)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="web-01" className={fieldCls} />
            </label>
            <label className="block">
              <span className="lbl block mb-1.5">Группа</span>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {GROUPS.map((g) => (
                  <button key={g} type="button" onClick={() => setGroup(g)}
                    className={`px-2.5 py-1.5 rounded-md text-[11.5px] font-mono border transition-all cursor-pointer ${group === g ? "" : "border-line text-mut hover:border-line2"}`}
                    style={group === g ? { borderColor: groupColor(g), color: groupColor(g), background: groupColor(g) + "14" } : undefined}>
                    {g}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <label className="block">
            <span className="lbl block mb-1.5">Install-токен (64 hex)</span>
            <textarea value={token} onChange={(e) => setToken(e.target.value.trim().toLowerCase())} rows={2}
              placeholder="7f3a9c2e44d0b18e9f02c6a1d44b8e30…" className={fieldCls + " resize-none"} />
            <span className="block mt-1.5 text-[11px] text-dim font-mono">
              печатается один раз: <span className="text-ok">$ kontur-agent status</span> на сервере
            </span>
          </label>

          {failMsg && (
            <div className="flex items-start gap-2 text-[12.5px] text-bad bg-bad/8 border border-bad/25 rounded-lg px-3 py-2.5">
              <Icon n="alert" size={14} className="mt-0.5 shrink-0" /> {failMsg}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-line text-[13px] text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer">Отмена</button>
            <button onClick={start}
              className="px-5 py-2.5 rounded-lg bg-amber text-bg font-display font-bold text-[13px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer flex items-center gap-2">
              <Icon n="zap" size={14} /> ПРОВЕРИТЬ И ПОДКЛЮЧИТЬ
            </button>
          </div>
        </div>
      )}

      {phase === "handshake" && (
        <div className="py-2">
          <div className="font-mono text-[12px] text-mut mb-4">wss://{ip || "…"}:{port || "…"} · протокол v1</div>
          <div className="space-y-1">
            {steps.map((s, i) => (
              <div key={s.label} className={`flex items-center gap-3 rounded-lg px-3.5 py-3 border anim-rise ${
                s.state === "fail" ? "border-bad/40 bg-bad/8" : s.state === "ok" ? "border-ok/25 bg-ok/5" : s.state === "run" ? "border-line2 bg-raise/60" : "border-line bg-panel"
              }`} style={{ animationDelay: `${i * 60}ms` }}>
                <span className="w-5 flex justify-center">
                  {s.state === "wait" && <span className="w-2 h-2 rounded-full bg-line2" />}
                  {s.state === "run" && <span className="w-4 h-4 rounded-full border-2 border-line2 border-t-amber spin" />}
                  {s.state === "ok" && <Icon n="check" size={15} className="text-ok" />}
                  {s.state === "fail" && <Icon n="x" size={15} className="text-bad" />}
                </span>
                <div className="min-w-0">
                  <div className={`text-[13px] font-medium ${s.state === "fail" ? "text-bad" : s.state === "wait" ? "text-dim" : "text-ink"}`}>{s.label}</div>
                  {s.detail && <div className="font-mono text-[11px] text-bad/90 mt-0.5">{s.detail}</div>}
                </div>
                {s.state === "ok" && i === 2 && <span className="ml-auto font-mono text-[10px] text-ok border border-ok/30 rounded px-1.5 py-0.5">200</span>}
              </div>
            ))}
          </div>
          {failMsg && (
            <div className="mt-4 flex justify-end gap-2.5">
              <button onClick={() => { setPhase("form"); setSteps([]); }}
                className="px-4 py-2.5 rounded-lg border border-line text-[13px] text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer">
                Изменить параметры
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "done" && meta && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-ok">
            <span className="p-2 rounded-lg bg-ok/12 border border-ok/30"><Icon n="check" size={18} /></span>
            <div>
              <div className="font-display font-bold text-[15px] text-ink">Рукопожатие успешно</div>
              <div className="font-mono text-[11.5px] text-mut">агент ответил на /v1/health · токен принят</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 card p-4 font-mono text-[12px]">
            {([
              ["hostname", meta.name], ["endpoint", `${ip}:${port}`],
              ["ОС", meta.os], ["ядро", meta.kernel],
              ["архитектура", `${meta.arch} · ${meta.cores} vCPU`], ["память", `${meta.ramGb} ГБ`],
              ["агент", `kontur-agent v${meta.agent}`], ["группа", group],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line/40 pb-1.5">
                <span className="text-dim">{k}</span><span className="text-ink text-right truncate">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-dim leading-relaxed">
            Узел будет добавлен в реестр, консоль закрепит TLS-пин и откроет поток телеметрии (каждые 5 с).
            Токен сохраняется в vault в зашифрованном виде; в БД пишется только его хэш.
          </p>
          <div className="flex justify-end gap-2.5">
            <button onClick={() => { setPhase("form"); setSteps([]); setMeta(null); }}
              className="px-4 py-2.5 rounded-lg border border-line text-[13px] text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer">Назад</button>
            <button onClick={commit}
              className="px-5 py-2.5 rounded-lg bg-ok text-bg font-display font-bold text-[13px] tracking-wide hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer flex items-center gap-2">
              <Icon n="plus" size={14} /> ДОБАВИТЬ В РЕЕСТР
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
