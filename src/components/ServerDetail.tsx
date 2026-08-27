import { useMemo, useState } from "react";
import { fmtUptime, genProcesses, genServices, last, type AuditEvent, type MetricsMap, type Server, type Proc, type Svc } from "../data";
import { getFS, type FSNode } from "../terminalEngine";
import Terminal from "./Terminal";
import { AreaChart, BarMeter, CopyBtn, Gauge, GroupChip, Icon, Modal, Sparkline, StatusDot, Tag, useToast, type IconName } from "./ui";

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: "overview", label: "Обзор", icon: "grid" },
  { id: "procs", label: "Процессы", icon: "cpu" },
  { id: "services", label: "Сервисы", icon: "gear" },
  { id: "files", label: "Файлы", icon: "folder" },
  { id: "terminal", label: "Терминал", icon: "terminal" },
];

export default function ServerDetail({ server: s, metrics, tab, onTab, onBack, onDelete, logEvent }: {
  server: Server;
  metrics: MetricsMap;
  tab: string;
  onTab: (t: string) => void;
  onBack: () => void;
  onDelete: (id: string) => void;
  logEvent: (type: AuditEvent["type"], severity: AuditEvent["severity"], text: string) => void;
}) {
  const m = metrics[s.id];
  const cpu = last(m?.cpu ?? []);
  const mem = last(m?.mem ?? []);
  const diskPct = Math.round((s.diskUsed / s.diskTotal) * 100);
  const [confirmDel, setConfirmDel] = useState(false);
  const toast = useToast();

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12.5px] font-mono text-mut hover:text-amber transition-colors cursor-pointer">
        <Icon n="chevR" size={13} className="rotate-180" /> реестр агентов
      </button>

      <div className="card scanline p-5 anim-rise">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl border border-line bg-panel flex items-center justify-center text-amber"><Icon n="server" size={22} /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display font-bold text-xl tracking-wide truncate">{s.name}</h2>
                <span className="flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded-md border"
                  style={{ color: s.status === "online" ? "#3ecf8e" : s.status === "warning" ? "#ffb224" : "#f0566a", borderColor: "currentColor", background: "rgba(255,255,255,0.02)" }}>
                  <StatusDot status={s.status} pulse={false} /> {s.status === "online" ? "онлайн" : s.status === "warning" ? "под нагрузкой" : "офлайн"}
                </span>
              </div>
              <div className="font-mono text-[12px] text-mut mt-1">{s.ip}:{s.port} · {s.os} · ядро {s.kernel} · аптайм {fmtUptime(s.uptimeDays)}</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <GroupChip name={s.group} />
            <button
              onClick={() => { toast(`Команда reboot отправлена агенту ${s.name} через exec relay`, "info"); logEvent("service", "warn", `${s.name}: запрошена перезагрузка агента (оператор admin)`); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line text-[12.5px] font-mono text-mut hover:text-amber hover:border-amber/50 transition-colors cursor-pointer">
              <Icon n="refresh" size={14} /> рестарт агента
            </button>
            <button onClick={() => onTab("terminal")} disabled={s.status === "offline"}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ok text-bg font-display font-bold text-[12.5px] tracking-wide hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-40">
              <Icon n="terminal" size={14} /> BASH-КОНСОЛЬ
            </button>
            <button onClick={() => setConfirmDel(true)}
              className="p-2 rounded-lg border border-line text-mut hover:text-bad hover:border-bad/50 transition-colors cursor-pointer" title="Удалить из реестра">
              <Icon n="trash" size={15} />
            </button>
          </div>
        </div>
        {s.status === "offline" && (
          <div className="mt-4 flex items-center gap-2.5 text-[12.5px] text-bad bg-bad/8 border border-bad/25 rounded-lg px-3.5 py-2.5">
            <Icon n="alert" size={15} /> Агент не отвечает {s.lastSeen}. Телеметрия недоступна, исполнение команд заблокировано до восстановления heartbeat.
          </div>
        )}
      </div>

      <div className="flex gap-1.5 border-b border-line overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => onTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-all cursor-pointer ${tab === t.id ? "border-amber text-amber" : "border-transparent text-mut hover:text-ink"}`}>
            <Icon n={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid lg:grid-cols-3 gap-3.5">
          <div className="card p-5 anim-rise flex items-center justify-around">
            <Gauge value={s.status === "offline" ? 0 : cpu} color={cpu > 75 ? "#f0566a" : "#ffb224"} label="CPU" />
            <Gauge value={s.status === "offline" ? 0 : mem} color={mem > 85 ? "#f0566a" : "#56c8e8"} label="RAM" />
            <Gauge value={diskPct} color={diskPct > 88 ? "#ffb224" : "#3ecf8e"} label="Диск" />
          </div>
          <div className="card p-5 anim-rise" style={{ animationDelay: ".08s" }}>
            <div className="lbl mb-3">Паспорт узла</div>
            <dl className="space-y-2 text-[12.5px]">
              {([
                ["ОС", s.os], ["Ядро", s.kernel], ["Архитектура", s.arch],
                ["vCPU / RAM", `${s.cores} ядер · ${s.ramGb} ГБ`],
                ["Адрес агента", `${s.ip}:${s.port}`],
                ["Версия агента", `kontur-agent ${s.agent}`],
                ["Последний heartbeat", s.lastSeen],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line/50 pb-2 last:border-0">
                  <dt className="text-mut">{k}</dt><dd className="font-mono text-right">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 pt-1">
                <dt className="text-mut">Install-токен</dt>
                <dd className="flex items-center gap-2"><span className="font-mono text-amber">{s.token}</span><CopyBtn text={s.token} /></dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">{s.tags.map((t) => <Tag key={t} t={t} />)}<Tag t={s.group} /></div>
          </div>
          <div className="card p-5 anim-rise" style={{ animationDelay: ".16s" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="lbl">Диск</span>
              <span className="font-mono text-[12px] tnum text-mut">{s.diskUsed} / {s.diskTotal} ГБ</span>
            </div>
            <BarMeter value={diskPct} color={diskPct > 88 ? "#ffb224" : "#3ecf8e"} className="h-2.5" />
            {diskPct > 88 && <p className="mt-2 text-[11.5px] text-amber flex items-center gap-1.5"><Icon n="alert" size={12} /> превышен порог 88% — запланируйте очистку</p>}
            <div className="lbl mt-5 mb-2">Сеть (Мбит/с)</div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-ok w-8">in ↓</span>
                <Sparkline data={(m?.netIn ?? []).slice(-26)} color="#3ecf8e" w={170} h={26} fill />
                <span className="font-mono text-[12px] tnum ml-auto">{last(m?.netIn ?? []).toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-info w-8">out ↑</span>
                <Sparkline data={(m?.netOut ?? []).slice(-26)} color="#56c8e8" w={170} h={26} fill />
                <span className="font-mono text-[12px] tnum ml-auto">{last(m?.netOut ?? []).toFixed(0)}</span>
              </div>
            </div>
          </div>

          <div className="card p-4 lg:col-span-2 anim-rise" style={{ animationDelay: ".22s" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-semibold text-[14px]">CPU, %</span>
              <span className="font-mono text-[20px] font-bold text-amber tnum">{s.status === "offline" ? "—" : `${cpu.toFixed(1)}%`}</span>
            </div>
            <AreaChart data={m?.cpu ?? []} color="#ffb224" h={150} />
          </div>
          <div className="card p-4 anim-rise" style={{ animationDelay: ".28s" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-semibold text-[14px]">RAM, %</span>
              <span className="font-mono text-[20px] font-bold text-info tnum">{s.status === "offline" ? "—" : `${mem.toFixed(1)}%`}</span>
            </div>
            <AreaChart data={m?.mem ?? []} color="#56c8e8" h={150} />
          </div>
        </div>
      )}

      {tab === "procs" && <ProcsTab s={s} logEvent={logEvent} />}
      {tab === "services" && <SvcTab s={s} logEvent={logEvent} />}
      {tab === "files" && <FilesTab s={s} />}
      {tab === "terminal" && (
        s.status === "offline"
          ? <div className="card p-10 text-center text-mut anim-pop"><Icon n="wifi" size={22} className="mx-auto mb-3 text-dim" />Агент офлайн — терминал недоступен.</div>
          : <Terminal key={s.id} server={s} height={520} onCommand={(c) => c.trim() && logEvent("exec", "info", `admin → ${s.name}: ${c.slice(0, 64)}`)} />
      )}

      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Удалить агент из реестра?" icon="alert" w={460}>
        <p className="text-[13.5px] text-mut leading-relaxed">
          <span className="text-ink font-mono">{s.name}</span> будет исключён из реестра консоли: телеметрия, история команд и сохранённый хэш токена будут удалены.
          Сам бинарь агента на сервере останется — остановите его командой <code className="font-mono text-amber">systemctl stop kontur-agent</code>.
        </p>
        <div className="flex justify-end gap-2.5 mt-5">
          <button onClick={() => setConfirmDel(false)} className="px-4 py-2 rounded-lg border border-line text-[13px] text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer">Отмена</button>
          <button onClick={() => { setConfirmDel(false); onDelete(s.id); }} className="px-4 py-2 rounded-lg bg-bad text-bg font-display font-bold text-[12.5px] tracking-wide hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer flex items-center gap-2">
            <Icon n="trash" size={14} /> УДАЛИТЬ
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Процессы ───────────────────────────────────────────────────────────────
function ProcsTab({ s, logEvent }: { s: Server; logEvent: (t: AuditEvent["type"], sv: AuditEvent["severity"], x: string) => void }) {
  const [procs, setProcs] = useState<Proc[]>(() => genProcesses(s));
  const toast = useToast();
  const kill = (p: Proc) => {
    setProcs((l) => l.filter((x) => x.pid !== p.pid));
    toast(`kill -9 ${p.pid} → ${p.cmd.split(" ")[0]} (${s.name})`, "info");
    logEvent("exec", "warn", `admin → ${s.name}: kill -9 ${p.pid} (${p.cmd.slice(0, 40)})`);
  };
  return (
    <div className="card overflow-hidden anim-rise">
      <SectionHeadIn title={`Процессы — ${s.name}`} sub={`${procs.length} отсортированы по CPU · данные через GET /v1/proc агента`} />
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] font-mono">
          <thead>
            <tr className="text-left lbl border-y border-line bg-panel/60">
              <th className="px-4 py-2.5 font-medium">PID</th><th className="px-3 py-2.5 font-medium">USER</th>
              <th className="px-3 py-2.5 font-medium">%CPU</th><th className="px-3 py-2.5 font-medium">%MEM</th>
              <th className="px-3 py-2.5 font-medium hidden md:table-cell">RSS</th><th className="px-3 py-2.5 font-medium">COMMAND</th><th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {procs.map((p) => (
              <tr key={p.pid} className="border-b border-line/60 last:border-0 hover:bg-raise/50 transition-colors">
                <td className="px-4 py-2 text-mut tnum">{p.pid}</td>
                <td className="px-3 py-2 text-info">{p.user}</td>
                <td className={`px-3 py-2 tnum ${p.cpu > 20 ? "text-amber font-bold" : ""}`}>{p.cpu}</td>
                <td className="px-3 py-2 tnum">{p.mem}</td>
                <td className="px-3 py-2 text-mut hidden md:table-cell tnum">{p.rss}</td>
                <td className="px-3 py-2 text-ink/85 max-w-[340px] truncate" title={p.cmd}>{p.cmd}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => kill(p)} className="px-2 py-1 rounded border border-line text-[11px] text-mut hover:text-bad hover:border-bad/50 transition-colors cursor-pointer">kill -9</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Сервисы ────────────────────────────────────────────────────────────────
function SvcTab({ s, logEvent }: { s: Server; logEvent: (t: AuditEvent["type"], sv: AuditEvent["severity"], x: string) => void }) {
  const [svcs, setSvcs] = useState<Svc[]>(() => genServices(s));
  const [busyUnit, setBusyUnit] = useState<string | null>(null);
  const toast = useToast();
  const act = (u: Svc, action: "start" | "stop" | "restart") => {
    setBusyUnit(u.unit);
    setTimeout(() => {
      setSvcs((l) => l.map((x) => (x.unit === u.unit ? { ...x, active: action === "stop" ? false : true } : x)));
      setBusyUnit(null);
      const word = action === "start" ? "запущен" : action === "stop" ? "остановлен" : "перезапущен";
      toast(`${u.unit} ${word} на ${s.name}`, action === "stop" ? "info" : "ok");
      logEvent("service", action === "stop" ? "warn" : "ok", `admin → ${s.name}: systemctl ${action} ${u.unit}`);
    }, 700);
  };
  return (
    <div className="card overflow-hidden anim-rise">
      <SectionHeadIn title={`Systemd-юниты — ${s.name}`} sub="управление через POST /v1/service агента, каждая операция уходит в аудит" />
      <div className="divide-y divide-line/60">
        {svcs.map((u) => (
          <div key={u.unit} className="flex items-center gap-3 px-4 py-3 hover:bg-raise/40 transition-colors flex-wrap">
            <span className={`w-2 h-2 rounded-full shrink-0 ${u.active ? "bg-ok ring-pulse" : "bg-bad"}`} style={{ ["--ring-c" as string]: "#3ecf8e55" }} />
            <div className="min-w-0 w-64">
              <div className="font-mono text-[13px] truncate">{u.unit}</div>
              <div className="text-[11px] text-dim truncate">{u.desc}</div>
            </div>
            <span className={`font-mono text-[11px] px-2 py-0.5 rounded ${u.active ? "text-ok bg-ok/10 border border-ok/25" : "text-bad bg-bad/10 border border-bad/25"}`}>
              {u.active ? "active (running)" : "inactive (dead)"}
            </span>
            <span className="font-mono text-[11px] text-mut hidden md:inline">enabled</span>
            <div className="ml-auto flex gap-1.5">
              {(["start", "restart", "stop"] as const).map((a) => (
                <button key={a} onClick={() => act(u, a)} disabled={busyUnit === u.unit || s.status === "offline" || (a === "stop" && !u.active) || (a === "start" && u.active)}
                  className={`px-2.5 py-1.5 rounded-md border text-[11.5px] font-mono transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 ${a === "stop" ? "border-line text-mut hover:text-bad hover:border-bad/50" : "border-line text-mut hover:text-ok hover:border-ok/50"}`}>
                  <Icon n={a === "stop" ? "stop" : a === "start" ? "play" : "refresh"} size={12} /> {a}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Файлы ──────────────────────────────────────────────────────────────────
function FilesTab({ s }: { s: Server }) {
  const root = useMemo(() => getFS(s), [s]);
  const [path, setPath] = useState("/home/admin");
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);
  const toast = useToast();

  const node = useMemo(() => {
    let cur: FSNode = root;
    if (path !== "/") for (const seg of path.split("/").filter(Boolean)) {
      if (cur.t !== "d" || !cur.ch[seg]) return null;
      cur = cur.ch[seg];
    }
    return cur;
  }, [root, path]);

  const download = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Файл ${name} скачан через file-relay агента`, "ok");
  };

  const entries = node && node.t === "d" ? Object.entries(node.ch) : [];
  return (
    <div className="grid lg:grid-cols-5 gap-3.5 anim-rise">
      <div className="card lg:col-span-3 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line font-mono text-[12px] flex-wrap">
          <button onClick={() => setPath("/")} className="text-mut hover:text-amber cursor-pointer">/</button>
          {path.split("/").filter(Boolean).map((seg, i, arr) => (
            <span key={i} className="flex items-center gap-2">
              <Icon n="chevR" size={11} className="text-dim" />
              <button onClick={() => setPath("/" + arr.slice(0, i + 1).join("/"))}
                className={`cursor-pointer hover:text-amber transition-colors ${i === arr.length - 1 ? "text-amber" : "text-mut"}`}>{seg}</button>
            </span>
          ))}
          <span className="ml-auto text-dim text-[11px]">GET /v1/files?path={path}</span>
        </div>
        <div className="divide-y divide-line/50">
          {path !== "/" && (
            <button onClick={() => setPath("/" + path.split("/").filter(Boolean).slice(0, -1).join("/"))}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-raise/50 transition-colors cursor-pointer text-left">
              <Icon n="folder" size={15} className="text-dim" /><span className="font-mono text-[13px] text-mut">..</span>
            </button>
          )}
          {entries.map(([nm, ch]) => (
            ch.t === "d" ? (
              <button key={nm} onClick={() => setPath(path === "/" ? `/${nm}` : `${path}/${nm}`)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-raise/50 transition-colors cursor-pointer text-left group">
                <Icon n="folder" size={15} className="text-info" />
                <span className="font-mono text-[13px] group-hover:text-info transition-colors">{nm}/</span>
                <span className="ml-auto font-mono text-[10.5px] text-dim">{Object.keys(ch.ch).length} объектов</span>
              </button>
            ) : (
              <button key={nm} onClick={() => setPreview({ name: nm, content: ch.c })}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-raise/50 transition-colors cursor-pointer text-left group">
                <Icon n="file" size={15} className="text-mut group-hover:text-amber transition-colors" />
                <span className="font-mono text-[13px] group-hover:text-amber transition-colors">{nm}</span>
                <span className="ml-auto font-mono text-[10.5px] text-dim">{ch.c.length} Б</span>
              </button>
            )
          ))}
          {entries.length === 0 && <div className="px-4 py-6 text-center text-dim font-mono text-[12px]">каталог пуст</div>}
        </div>
      </div>

      <div className="card lg:col-span-2 overflow-hidden flex flex-col">
        {preview ? (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
              <Icon n="file" size={14} className="text-amber" />
              <span className="font-mono text-[12.5px] truncate">{path}/{preview.name}</span>
              <div className="ml-auto flex gap-1.5">
                <button onClick={() => download(preview.name, preview.content)} className="p-1.5 rounded-md text-mut hover:text-ok hover:bg-ok/10 transition-colors cursor-pointer" title="Скачать"><Icon n="download" size={14} /></button>
                <button onClick={() => setPreview(null)} className="p-1.5 rounded-md text-mut hover:text-ink hover:bg-raise transition-colors cursor-pointer"><Icon n="x" size={14} /></button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-4 font-mono text-[12px] leading-relaxed text-ink/85 whitespace-pre-wrap">{preview.content || "(бинарный файл — предпросмотр недоступен)"}</pre>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Icon n="eye" size={24} className="text-dim mb-3" />
            <p className="text-[13px] text-mut">Выберите файл слева — содержимое будет загружено через file-relay агента без открытия SSH.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeadIn({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-4 pt-4 pb-3">
      <h3 className="font-display font-semibold text-[15px]">{title}</h3>
      <p className="text-[11.5px] text-mut font-mono mt-0.5">{sub}</p>
    </div>
  );
}
