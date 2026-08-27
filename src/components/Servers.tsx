import { useEffect, useMemo, useState } from "react";
import { GROUPS, last, type MetricsMap, type Server } from "../data";
import { BarMeter, CopyBtn, GroupChip, Icon, Modal, SectionHead, Sparkline, StatusDot, Tag, useToast } from "./ui";

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

export default function Servers({ servers, metrics, onOpen, onAdd, query = "" }: {
  servers: Server[];
  metrics: MetricsMap;
  onOpen: (id: string, tab?: string) => void;
  onAdd: (s: Server) => void;
  query?: string;
}) {
  const [group, setGroup] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState(query);
  const [modal, setModal] = useState(false);

  useEffect(() => { setQ(query); }, [query]);

  const filtered = useMemo(
    () =>
      servers.filter(
        (s) =>
          (group === "all" || s.group === group) &&
          (status === "all" || s.status === status) &&
          (s.name + s.ip + s.tags.join(" ")).toLowerCase().includes(q.trim().toLowerCase())
      ),
    [servers, group, status, q]
  );

  return (
    <div>
      <SectionHead
        title="Реестр агентов"
        sub={`${servers.length} хостов · подключение по адресу агента и install-токену`}
        right={
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber text-bg font-display font-bold text-[12.5px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer">
            <Icon n="plus" size={14} /> ПОДКЛЮЧИТЬ АГЕНТА
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim"><Icon n="search" size={14} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="имя, ip, тег…"
            className="bg-panel border border-line rounded-lg pl-8 pr-3 py-2 text-[13px] w-56 focus:border-amber/60 outline-none transition-colors placeholder:text-dim" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{ n: "all", l: "Все группы" }, ...GROUPS.map((g) => ({ n: g.name, l: g.name }))].map((g) => (
            <button key={g.n} onClick={() => setGroup(g.n)}
              className={`px-3 py-1.5 rounded-lg border text-[12.5px] font-mono transition-all cursor-pointer ${group === g.n ? "border-amber/60 bg-amber/12 text-amber" : "border-line text-mut hover:border-line2 hover:text-ink"}`}>
              {g.l}
            </button>
          ))}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="bg-panel border border-line rounded-lg px-3 py-2 text-[12.5px] font-mono text-mut outline-none focus:border-amber/60 cursor-pointer">
          <option value="all">Любой статус</option>
          <option value="online">Онлайн</option>
          <option value="warning">Под нагрузкой</option>
          <option value="offline">Офлайн</option>
        </select>
        <span className="ml-auto font-mono text-[11.5px] text-dim">{filtered.length} из {servers.length}</span>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {filtered.map((s, i) => {
          const m = metrics[s.id];
          const cpu = last(m?.cpu ?? []);
          const mem = last(m?.mem ?? []);
          const disk = Math.round((s.diskUsed / s.diskTotal) * 100);
          return (
            <div key={s.id} className="card card-h p-4 anim-rise flex flex-col cursor-pointer" style={{ animationDelay: `${i * 45}ms` }} onClick={() => onOpen(s.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <StatusDot status={s.status} />
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-[14px] truncate">{s.name}</div>
                    <div className="font-mono text-[11px] text-dim">{s.ip}:{s.port}</div>
                  </div>
                </div>
                <GroupChip name={s.group} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {s.status === "offline" ? (
                  <div className="col-span-3 rounded-lg border border-dashed border-line bg-panel/50 py-3 text-[12px] text-dim font-mono">
                    агент не отвечает · last seen: {s.lastSeen}
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg bg-panel/70 border border-line/70 py-2">
                      <div className="font-mono font-bold text-[16px] tnum" style={{ color: cpu > 75 ? "#f0566a" : "#ffb224" }}>{cpu.toFixed(0)}%</div>
                      <div className="lbl mt-0.5">cpu</div>
                    </div>
                    <div className="rounded-lg bg-panel/70 border border-line/70 py-2">
                      <div className="font-mono font-bold text-[16px] tnum text-info">{mem.toFixed(0)}%</div>
                      <div className="lbl mt-0.5">ram</div>
                    </div>
                    <div className="rounded-lg bg-panel/70 border border-line/70 py-2">
                      <div className="font-mono font-bold text-[16px] tnum" style={{ color: disk > 88 ? "#ffb224" : "#3ecf8e" }}>{disk}%</div>
                      <div className="lbl mt-0.5">диск</div>
                    </div>
                  </>
                )}
              </div>

              {s.status !== "offline" && (
                <div className="mt-3 flex items-center justify-between">
                  <Sparkline data={(m?.cpu ?? []).slice(-26)} color={cpu > 75 ? "#f0566a" : "#ffb224"} w={150} h={30} fill />
                  <div className="text-right">
                    <BarMeter value={mem} color="#56c8e8" className="w-24" />
                    <div className="font-mono text-[10.5px] text-dim mt-1">heartbeat: {s.lastSeen}</div>
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-line/70 flex items-center gap-1.5 flex-wrap">
                <Tag t={s.os.split(" ")[0].toLowerCase()} />
                <Tag t={`${s.cores} vCPU`} />
                <Tag t={`агент ${s.agent}`} />
                {s.tags.map((t) => <Tag key={t} t={t} />)}
                <div className="ml-auto flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onOpen(s.id); }}
                    className="p-2 rounded-md text-mut hover:text-amber hover:bg-amber/10 transition-colors cursor-pointer" title="Карточка сервера"><Icon n="server" size={15} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onOpen(s.id, "terminal"); }} disabled={s.status === "offline"}
                    className="p-2 rounded-md text-mut hover:text-ok hover:bg-ok/10 transition-colors cursor-pointer disabled:opacity-30" title="Терминал"><Icon n="terminal" size={15} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card p-10 text-center text-mut anim-pop">
          <Icon n="search" size={22} className="mx-auto mb-3 text-dim" />
          Ничего не найдено. Сбросьте фильтры или подключите новый агент.
        </div>
      )}

      <AddAgentModal open={modal} onClose={() => setModal(false)} onAdd={onAdd} servers={servers} />
    </div>
  );
}

function AddAgentModal({ open, onClose, onAdd, servers }: { open: boolean; onClose: () => void; onAdd: (s: Server) => void; servers: Server[] }) {
  const [ip, setIp] = useState("10.0.6.71");
  const [port, setPort] = useState("8443");
  const [token, setToken] = useState("");
  const [grp, setGrp] = useState("Production");
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<"idle" | "busy" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");
  const toast = useToast();

  const submit = () => {
    if (phase === "busy") return;
    setErrMsg("");
    if (!IP_RE.test(ip.trim())) { setPhase("err"); setErrMsg("IP-адрес в неверном формате (ожидается 10.0.6.71)"); return; }
    if (!/^\d+$/.test(port) || +port < 1024 || +port > 65535) { setPhase("err"); setErrMsg("Порт должен быть числом 1024–65535"); return; }
    if (token.trim().length < 16) { setPhase("err"); setErrMsg("Токен короче 16 символов — агент при установке выдаёт 64-символьный ключ"); return; }
    setPhase("busy");
    setTimeout(() => {
      const s: Server = {
        id: "s" + Date.now(),
        name: name.trim() || `node-${ip.split(".").slice(-2).join("-")}`,
        ip: ip.trim(), port: +port, group: grp,
        os: "Ubuntu 24.04 LTS", kernel: "6.8.0-31-generic", arch: "x86_64",
        cores: 4, ramGb: 16, agent: "1.7.2", status: "online", uptimeDays: 0.01,
        token: token.trim().slice(0, 8) + "••••••••••••••••" + token.trim().slice(-4),
        lastSeen: "только что", tags: ["fresh"], diskTotal: 240, diskUsed: 12, baseCpu: 8, baseMem: 22,
      };
      onAdd(s);
      toast(`Агент ${s.name} подключён, токен проверен (${servers.length + 1} хост в реестре)`, "ok");
      setPhase("idle"); setToken(""); setName("");
      onClose();
    }, 1300);
  };

  return (
    <Modal open={open} onClose={() => { if (phase !== "busy") { onClose(); setPhase("idle"); setErrMsg(""); } }} title="Подключение нового агента" icon="box" w={600}>
      <div className="card bg-panel/70 border-dashed p-3.5 mb-4">
        <div className="lbl mb-1.5">1 · На сервере установите агента (Go, один бинарь)</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-[12px] text-ok bg-[#0a0e15] border border-line rounded-md px-3 py-2 overflow-x-auto whitespace-nowrap">curl -fsSL https://ops.local/install.sh | bash -s -- --console 10.0.0.2:8443</code>
          <CopyBtn text="curl -fsSL https://ops.local/install.sh | bash -s -- --console 10.0.0.2:8443" />
        </div>
        <p className="text-[11.5px] text-mut mt-2">При первом запуске агент генерирует случайный <span className="text-amber font-mono">TOKEN (64 hex)</span> и печатает его в консоль. Токен — единственный ключ к агенту: без него консоль не сможет выполнять команды.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="block">
          <span className="lbl block mb-1.5">2 · IP-адрес агента</span>
          <input value={ip} onChange={(e) => setIp(e.target.value)} className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 font-mono text-[13px] focus:border-amber/60 outline-none transition-colors" />
        </label>
        <label className="block">
          <span className="lbl block mb-1.5">Порт агента</span>
          <input value={port} onChange={(e) => setPort(e.target.value)} className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 font-mono text-[13px] focus:border-amber/60 outline-none transition-colors" />
        </label>
        <label className="block sm:col-span-2">
          <span className="lbl block mb-1.5">3 · Install-токен агента</span>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="например: 7f3a9c2e44d0b18e…"
            className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 font-mono text-[13px] focus:border-amber/60 outline-none transition-colors placeholder:text-dim" />
        </label>
        <label className="block">
          <span className="lbl block mb-1.5">Группа</span>
          <select value={grp} onChange={(e) => setGrp(e.target.value)} className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-amber/60 cursor-pointer">
            {GROUPS.map((g) => <option key={g.name}>{g.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="lbl block mb-1.5">Имя (необязательно)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="app-worker-03"
            className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 font-mono text-[13px] focus:border-amber/60 outline-none transition-colors placeholder:text-dim" />
        </label>
      </div>

      {errMsg && (
        <div className="flex items-center gap-2 mt-3.5 text-[12.5px] text-bad bg-bad/8 border border-bad/25 rounded-lg px-3 py-2.5 anim-shake">
          <Icon n="alert" size={14} /> {errMsg}
        </div>
      )}

      <div className="flex items-center justify-between mt-5">
        <span className="text-[11.5px] text-dim font-mono flex items-center gap-1.5"><Icon n="shield" size={13} className="text-ok" /> токен хранится в БД консоли как SHA-256(соль+токен)</span>
        <button onClick={submit} disabled={phase === "busy"}
          className="px-5 py-2.5 rounded-lg bg-amber text-bg font-display font-bold text-[13px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer disabled:opacity-70 flex items-center gap-2.5">
          {phase === "busy" ? (<><span className="w-4 h-4 rounded-full border-2 border-bg/30 border-t-bg spin" /> РУКОПОЖАТИЕ С АГЕНТОМ…</>) : "ПРОВЕРИТЬ И ПОДКЛЮЧИТЬ"}
        </button>
      </div>
    </Modal>
  );
}
