import { useEffect, useMemo, useState } from "react";
import { fmtUptime, groupColor, last, type MetricsMap, type Server } from "../data";
import { GroupChip, Icon, SectionHead, Sparkline, StatusDot } from "./ui";

const STATUS_FILTERS: { v: string; label: string }[] = [
  { v: "all", label: "все статусы" },
  { v: "online", label: "онлайн" },
  { v: "warning", label: "нагрузка" },
  { v: "offline", label: "офлайн" },
];

export default function Servers({ servers, metrics, query, onOpen, onAdd }: {
  servers: Server[];
  metrics: MetricsMap;
  query: string;
  onOpen: (id: string, tab?: string) => void;
  onAdd: () => void;
}) {
  const [q, setQ] = useState(query);
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => setQ(query), [query]);

  const groups = useMemo(() => Array.from(new Set(servers.map((s) => s.group))), [servers]);

  const filtered = useMemo(() => servers.filter((s) => {
    const qq = q.trim().toLowerCase();
    const okQ = !qq || s.name.toLowerCase().includes(qq) || s.ip.includes(qq) || s.os.toLowerCase().includes(qq);
    const okG = group === "all" || s.group === group;
    const okS = status === "all" || s.status === status;
    return okQ && okG && okS;
  }), [servers, q, group, status]);

  if (servers.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHead title="Реестр агентов" sub="Список пуст: консоль ждёт первое подключение" />
        <div className="card scanline p-8 md:p-10 max-w-3xl anim-rise">
          <div className="flex items-center gap-3 mb-5">
            <span className="p-2.5 rounded-xl bg-amber/12 border border-amber/35 text-amber"><Icon n="box" size={22} /></span>
            <div>
              <h2 className="font-display font-bold text-xl">Пока ни одного агента</h2>
              <p className="text-[13px] text-mut">Предзаполненных узлов нет — реестр наполняется только реальными подключениями.</p>
            </div>
          </div>
          <ol className="space-y-3.5 mb-7">
            {([
              ["1", "Установите агент на Linux-сервер", "$ curl -fsSL https://ops.local/install.sh | bash -s -- --console 10.0.0.2:8443"],
              ["2", "Скопируйте INSTALL TOKEN из вывода", "$ kontur-agent status   # напечатает 64 hex-символа"],
              ["3", "Подключите узел здесь", "IP + порт + токен → рукопожатие → узел в реестре"],
            ] as [string, string, string][]).map(([n, t, d]) => (
              <li key={n} className="flex gap-3.5">
                <span className="w-7 h-7 shrink-0 rounded-lg bg-panel2 border border-line2 flex items-center justify-center font-mono text-[12px] font-bold text-amber">{n}</span>
                <div>
                  <div className="text-[13.5px] font-medium">{t}</div>
                  <div className="font-mono text-[11.5px] text-mut mt-0.5">{d}</div>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            <button onClick={onAdd}
              className="px-5 py-3 rounded-lg bg-amber text-bg font-display font-bold text-[13.5px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer flex items-center gap-2.5">
              <Icon n="plus" size={15} /> ПОДКЛЮЧИТЬ АГЕНТА
            </button>
            <span className="px-4 py-3 text-[12px] text-mut font-mono self-center">полный мануал — раздел «Установка» в документации</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHead
        title="Реестр агентов"
        sub={`${servers.length} узлов · ${servers.filter((s) => s.status === "online").length} онлайн · соединение по token-over-TLS`}
        right={
          <button onClick={onAdd}
            className="px-3.5 py-2 rounded-lg bg-amber text-bg font-display font-bold text-[12.5px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer flex items-center gap-2">
            <Icon n="plus" size={14} /> ПОДКЛЮЧИТЬ
          </button>
        }
      />

      {/* фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setGroup("all")}
          className={`px-3 py-1.5 rounded-md text-[12px] font-mono border transition-colors cursor-pointer ${group === "all" ? "border-line2 text-ink bg-raise" : "border-line text-mut hover:border-line2"}`}>
          все группы · {servers.length}
        </button>
        {groups.map((g) => (
          <button key={g} onClick={() => setGroup(g === group ? "all" : g)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-mono border transition-colors cursor-pointer flex items-center gap-2 ${group === g ? "" : "border-line text-mut hover:border-line2"}`}
            style={group === g ? { borderColor: groupColor(g), color: groupColor(g), background: groupColor(g) + "12" } : undefined}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: groupColor(g) }} />
            {g} · {servers.filter((s) => s.group === g).length}
          </button>
        ))}
        <span className="w-px h-5 bg-line mx-1" />
        {STATUS_FILTERS.map((f) => (
          <button key={f.v} onClick={() => setStatus(f.v)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-mono border transition-colors cursor-pointer ${status === f.v ? "border-line2 text-ink bg-raise" : "border-line text-mut hover:border-line2"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center anim-pop">
          <Icon n="search" size={26} className="text-dim mx-auto mb-3" />
          <div className="font-display font-semibold text-[15px] mb-1">Ничего не найдено</div>
          <p className="text-[12.5px] text-mut mb-4">По текущим фильтрам нет ни одного узла.</p>
          <button onClick={() => { setQ(""); setGroup("all"); setStatus("all"); }}
            className="px-4 py-2 rounded-lg border border-line text-[12.5px] text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer">
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filtered.map((s, i) => {
            const m = metrics[s.id];
            const cpu = last(m?.cpu ?? []);
            const mem = last(m?.mem ?? []);
            const disk = Math.round((s.diskUsed / s.diskTotal) * 100);
            const off = s.status === "offline";
            return (
              <div key={s.id} onClick={() => onOpen(s.id)}
                className="card card-h p-4 cursor-pointer anim-rise group" style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StatusDot status={s.status} />
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-[14.5px] truncate group-hover:text-amber transition-colors">{s.name}</div>
                      <div className="font-mono text-[11px] text-dim truncate">{s.ip}:{s.port}</div>
                    </div>
                  </div>
                  <GroupChip name={s.group} />
                </div>

                <div className="mt-3 font-mono text-[11px] text-mut truncate">{s.os} · {s.arch} · {s.cores} vCPU · {s.ramGb} ГБ</div>

                <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                  <div>
                    <div className="flex justify-between font-mono text-[10.5px] text-dim mb-1"><span>CPU</span><span className={off ? "" : cpu > 75 ? "text-bad" : "text-amber"}>{off ? "—" : `${cpu.toFixed(0)}%`}</span></div>
                    {off ? <div className="h-[20px] flex items-center text-[10.5px] font-mono text-dim">нет данных — агент офлайн</div>
                      : <Sparkline data={(m?.cpu ?? []).slice(-26)} color={cpu > 75 ? "#f0566a" : "#ffb224"} w={150} h={20} fill />}
                  </div>
                  <div className="w-20">
                    <div className="flex justify-between font-mono text-[10.5px] text-dim mb-1"><span>RAM</span><span className="text-info">{off ? "—" : `${mem.toFixed(0)}%`}</span></div>
                    <div className="h-[6px] rounded-full bg-[#1a2436] overflow-hidden">
                      {!off && <div className="h-full barfill" style={{ width: `${mem}%`, background: mem > 80 ? "#f0566a" : "#56c8e8" }} />}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-line/60 flex items-center justify-between">
                  <div className="flex items-center gap-3 font-mono text-[10.5px] text-dim">
                    <span className="flex items-center gap-1"><Icon n="db" size={11} /> диск {disk}%</span>
                    <span className="flex items-center gap-1"><Icon n="clock" size={11} /> {fmtUptime(s.uptimeDays)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpen(s.id, "terminal"); }}
                      disabled={off}
                      title="Терминал"
                      className="p-1.5 rounded-md text-mut hover:text-ok hover:bg-ok/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                      <Icon n="terminal" size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpen(s.id); }}
                      title="Открыть карточку"
                      className="p-1.5 rounded-md text-mut hover:text-amber hover:bg-amber/10 transition-colors cursor-pointer">
                      <Icon n="chevR" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
