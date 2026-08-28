import { useMemo } from "react";
import { POINTS, fmtUptime, groupColor, last, type AuditEvent, type MetricsMap, type Server } from "../data";
import { AreaChart, BarMeter, CopyBtn, GroupChip, Icon, SectionHead, Sparkline, StatusDot, type IconName } from "./ui";

const SEV: Record<AuditEvent["severity"], string> = { ok: "#3ecf8e", info: "#56c8e8", warn: "#ffb224", crit: "#f0566a" };
const EV_ICON: Record<AuditEvent["type"], IconName> = { auth: "lock", exec: "terminal", agent: "box", service: "gear", user: "users", system: "activity" };

function EmptyFleet({ onAdd }: { onAdd: () => void }) {
  const cmd = "curl -fsSL https://ops.local/install.sh | bash -s -- --console 10.0.0.2:8443";
  return (
    <div className="card scanline overflow-hidden anim-rise">
      <div className="grid lg:grid-cols-[1.25fr_1fr]">
        <div className="p-7 md:p-9">
          <div className="lbl mb-3 flex items-center gap-2 text-amber"><Icon n="radar" size={13} /> первое подключение</div>
          <h2 className="font-display font-bold text-[24px] leading-tight mb-2.5">
            Флот пуст. Подключите первый сервер —<br className="hidden md:block" /> и панель оживёт.
          </h2>
          <p className="text-[13.5px] text-mut leading-relaxed mb-6 max-w-xl">
            Никаких демо-узлов: реестр наполняется только через реальную процедуру подключения —
            установка Go-агента на сервер, получение install-токена, рукопожатие с проверкой токена.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 shrink-0 rounded-md bg-panel2 border border-line2 flex items-center justify-center font-mono text-[11px] font-bold text-amber mt-0.5">1</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium mb-1">Установите агент на Linux-сервер</div>
                <div className="bg-bg border border-line rounded-lg px-3 py-2 font-mono text-[11.5px] text-ok/90 overflow-x-auto whitespace-nowrap flex items-center justify-between gap-3">
                  <span>$ {cmd}</span><CopyBtn text={cmd} />
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 shrink-0 rounded-md bg-panel2 border border-line2 flex items-center justify-center font-mono text-[11px] font-bold text-amber mt-0.5">2</span>
              <div>
                <div className="text-[13px] font-medium">Скопируйте INSTALL TOKEN <span className="text-dim font-normal">(64 hex-символа из вывода установки)</span></div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 shrink-0 rounded-md bg-panel2 border border-line2 flex items-center justify-center font-mono text-[11px] font-bold text-amber mt-0.5">3</span>
              <div>
                <div className="text-[13px] font-medium">Укажите IP:порт и токен — консоль проверит их рукопожатием</div>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t lg:border-t-0 lg:border-l border-line bg-panel/60 p-7 md:p-9 flex flex-col justify-center gap-4">
          <button onClick={onAdd}
            className="w-full py-3.5 rounded-lg bg-amber text-bg font-display font-bold text-[14px] tracking-wider hover:bg-[#ffc14d] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2.5">
            <Icon n="plus" size={16} /> ПОДКЛЮЧИТЬ АГЕНТА
          </button>
          <div className="space-y-2 text-[12px] text-mut">
            <div className="flex items-center gap-2.5"><Icon n="shield" size={14} className="text-ok shrink-0" /> без токена агент не пустит никого — включая консоль</div>
            <div className="flex items-center gap-2.5"><Icon n="key" size={14} className="text-info shrink-0" /> токен хранится в vault, в БД — только хэш</div>
            <div className="flex items-center gap-2.5"><Icon n="book" size={14} className="text-amber shrink-0" /> пошагово: раздел «Установка агента» в документации</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ servers, metrics, events, onOpen, onServers, onAdd }: {
  servers: Server[];
  metrics: MetricsMap;
  events: AuditEvent[];
  onOpen: (id: string, tab?: string) => void;
  onServers: () => void;
  onAdd: () => void;
}) {
  const online = servers.filter((s) => s.status !== "offline");
  const alerts = servers.filter((s) => s.status === "warning").length;
  const hasFleet = servers.length > 0;

  const fleet = useMemo(() => {
    const cpu: number[] = []; const mem: number[] = [];
    for (let i = 0; i < POINTS; i++) {
      let c = 0, m = 0;
      online.forEach((s) => { c += metrics[s.id]?.cpu[i] ?? 0; m += metrics[s.id]?.mem[i] ?? 0; });
      cpu.push(online.length ? c / online.length : 0);
      mem.push(online.length ? m / online.length : 0);
    }
    return { cpu, mem };
  }, [servers, metrics]); // eslint-disable-line react-hooks/exhaustive-deps

  const avgUp = online.length ? online.reduce((a, s) => a + s.uptimeDays, 0) / online.length : 0;

  const tiles: { lbl: string; val: string; unit?: string; sub: string; icon: IconName; color: string; spark?: number[] }[] = [
    { lbl: "Агентов онлайн", val: `${online.length}/${servers.length}`, sub: alerts ? `${alerts} под нагрузкой` : hasFleet ? "флот в норме" : "реестр пуст", icon: "server", color: "#3ecf8e" },
    { lbl: "CPU флота (сред.)", val: online.length ? last(fleet.cpu).toFixed(0) : "—", unit: online.length ? "%" : "", sub: "окно 84 сек", icon: "cpu", color: "#ffb224", spark: online.length ? fleet.cpu.slice(-24) : undefined },
    { lbl: "RAM флота (сред.)", val: online.length ? last(fleet.mem).toFixed(0) : "—", unit: online.length ? "%" : "", sub: "по онлайн-агентам", icon: "ram", color: "#56c8e8", spark: online.length ? fleet.mem.slice(-24) : undefined },
    { lbl: "Открытые алерты", val: String(alerts), sub: alerts ? "пороги CPU/RAM" : "пороги не превышены", icon: "alert", color: alerts ? "#f0566a" : "#8595ad" },
    { lbl: "Средний аптайм", val: online.length ? fmtUptime(avgUp) : "—", sub: "без перезагрузок", icon: "clock", color: "#c792ea" },
  ];

  return (
    <div className="space-y-5">
      <SectionHead
        title="Обзор флота"
        sub={hasFleet ? "Телеметрия собирается агентами каждые 5 секунд и агрегируется консолью" : "Телеметрия появится после первого подключённого агента"}
        right={
          <div className="flex items-center gap-2.5">
            <span className={`flex items-center gap-1.5 font-mono text-[11px] border rounded-md px-2.5 py-1 ${online.length ? "text-ok border-ok/30 bg-ok/8" : "text-dim border-line bg-panel"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${online.length ? "bg-ok ring-pulse" : "bg-line2"}`} style={online.length ? { ["--ring-c" as string]: "#3ecf8e66" } : undefined} />
              {online.length ? "LIVE" : "IDLE"}
            </span>
            <button onClick={onAdd} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber text-bg font-display font-bold text-[12.5px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer">
              <Icon n="plus" size={14} /> ДОБАВИТЬ АГЕНТА
            </button>
          </div>
        }
      />

      {!hasFleet && <EmptyFleet onAdd={onAdd} />}

      {/* статистика */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {tiles.map((t, i) => (
          <div key={t.lbl} className="card card-h p-4 anim-rise relative overflow-hidden" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex items-start justify-between">
              <span className="lbl">{t.lbl}</span>
              <span className="p-1.5 rounded-md" style={{ color: t.color, background: t.color + "14", border: `1px solid ${t.color}33` }}>
                <Icon n={t.icon} size={14} />
              </span>
            </div>
            <div className="mt-2 font-mono font-bold text-[30px] leading-none tnum" style={{ color: hasFleet || i === 0 ? t.color : "#5a6a83" }}>
              {t.val}<span className="text-[15px] text-mut font-medium">{t.unit ?? ""}</span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-[11.5px] text-mut">{t.sub}</span>
              {t.spark
                ? <Sparkline data={t.spark} color={t.color} w={72} h={22} fill />
                : <svg width="72" height="22" viewBox="0 0 72 22" className="opacity-40"><path d="M1 11h70" stroke="#3a4a63" strokeWidth="1.5" strokeDasharray="3 4" /></svg>}
            </div>
          </div>
        ))}
      </div>

      {/* графики флота */}
      {hasFleet && (
        <div className="grid lg:grid-cols-5 gap-3.5">
          <div className="card p-4 lg:col-span-3 anim-rise" style={{ animationDelay: ".18s" }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-display font-semibold text-[14.5px]">CPU флота — среднее по онлайн-агентам</div>
                <div className="text-[11.5px] text-mut font-mono">шаг 2 c · ретенция 84 c в реальном времени · история в timescale</div>
              </div>
              <div className="font-mono text-[22px] font-bold text-amber tnum">{last(fleet.cpu).toFixed(1)}%</div>
            </div>
            <AreaChart data={fleet.cpu} color="#ffb224" h={168} />
          </div>
          <div className="card p-4 lg:col-span-2 anim-rise" style={{ animationDelay: ".26s" }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-display font-semibold text-[14.5px]">RAM флота</div>
                <div className="text-[11.5px] text-mut font-mono">среднее по онлайн-агентам</div>
              </div>
              <div className="font-mono text-[22px] font-bold text-info tnum">{last(fleet.mem).toFixed(1)}%</div>
            </div>
            <AreaChart data={fleet.mem} color="#56c8e8" h={168} />
          </div>
        </div>
      )}

      {/* таблица агентов + события */}
      <div className="grid lg:grid-cols-3 gap-3.5">
        <div className="card lg:col-span-2 overflow-hidden anim-rise" style={{ animationDelay: ".32s" }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <h3 className="font-display font-semibold text-[15px]">Агенты</h3>
            <button onClick={onServers} className="text-[12px] font-mono text-info hover:text-ink transition-colors cursor-pointer flex items-center gap-1">реестр <Icon n="chevR" size={13} /></button>
          </div>
          {servers.length === 0 ? (
            <div className="px-4 pb-6 pt-2">
              <div className="border border-dashed border-line2 rounded-lg p-6 text-center">
                <div className="font-mono text-[12px] text-dim mb-2">SELECT * FROM agents; → 0 rows</div>
                <button onClick={onServers} className="text-[12.5px] font-mono text-amber hover:text-[#ffc14d] transition-colors cursor-pointer">перейти к подключению →</button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left lbl border-y border-line bg-panel/60">
                    <th className="px-4 py-2.5 font-medium">Узел</th>
                    <th className="px-3 py-2.5 font-medium">Группа</th>
                    <th className="px-3 py-2.5 font-medium">CPU</th>
                    <th className="px-3 py-2.5 font-medium hidden md:table-cell">RAM</th>
                    <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Диск</th>
                    <th className="px-3 py-2.5 font-medium hidden xl:table-cell">Аптайм</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {servers.map((s) => {
                    const m = metrics[s.id];
                    const cpu = last(m?.cpu ?? []);
                    const mem = last(m?.mem ?? []);
                    const disk = Math.round((s.diskUsed / s.diskTotal) * 100);
                    return (
                      <tr key={s.id} onClick={() => onOpen(s.id)}
                        className="border-b border-line/60 last:border-0 hover:bg-raise/50 transition-colors cursor-pointer group">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <StatusDot status={s.status} />
                            <div>
                              <div className="font-mono font-medium text-[13px] group-hover:text-amber transition-colors">{s.name}</div>
                              <div className="text-[11px] text-dim font-mono">{s.ip}:{s.port} · {s.os}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><GroupChip name={s.group} /></td>
                        <td className="px-3 py-2.5">
                          {s.status === "offline" ? <span className="text-dim font-mono text-[11.5px]">нет данных</span> : (
                            <div className="flex items-center gap-2">
                              <Sparkline data={(m?.cpu ?? []).slice(-20)} color={cpu > 75 ? "#f0566a" : "#ffb224"} w={70} h={20} />
                              <span className="font-mono text-[12px] tnum w-9">{cpu.toFixed(0)}%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell w-32">
                          {s.status === "offline" ? <span className="text-dim font-mono text-[11.5px]">—</span> : (
                            <div>
                              <div className="flex justify-between font-mono text-[11px] mb-1"><span className="text-mut">mem</span><span className="tnum">{mem.toFixed(0)}%</span></div>
                              <BarMeter value={mem} color={mem > 80 ? "#f0566a" : "#56c8e8"} />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell font-mono text-[12px] tnum">
                          <span className={disk > 88 ? "text-amber" : "text-mut"}>{disk}%</span>
                          <span className="text-dim text-[11px]"> / {s.diskTotal >= 1000 ? `${(s.diskTotal / 1000).toFixed(0)}ТБ` : `${s.diskTotal}ГБ`}</span>
                        </td>
                        <td className="px-3 py-2.5 hidden xl:table-cell font-mono text-[12px] text-mut tnum">{fmtUptime(s.uptimeDays)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpen(s.id, "terminal"); }}
                            disabled={s.status === "offline"}
                            className="p-1.5 rounded-md text-mut hover:text-ok hover:bg-ok/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Открыть терминал">
                            <Icon n="terminal" size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card overflow-hidden anim-rise flex flex-col" style={{ animationDelay: ".4s" }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <h3 className="font-display font-semibold text-[15px]">Поток событий</h3>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-ok"><span className="w-1.5 h-1.5 rounded-full bg-ok ring-pulse" style={{ ["--ring-c" as string]: "#3ecf8e66" }} /> live</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[430px] px-4 pb-4 space-y-1">
            {events.length === 0 && <div className="text-[12px] text-dim font-mono py-6 text-center">событий пока нет</div>}
            {events.slice(0, 14).map((e, i) => (
              <div key={e.id} className={`flex gap-2.5 py-2 border-b border-line/50 last:border-0 ${i === 0 ? "anim-rise" : ""}`} style={{ borderLeft: `2px solid ${SEV[e.severity]}55`, paddingLeft: 10 }}>
                <span className="mt-0.5" style={{ color: SEV[e.severity] }}><Icon n={EV_ICON[e.type]} size={13} /></span>
                <div className="min-w-0">
                  <div className="text-[12px] leading-snug text-ink/85">{e.text}</div>
                  <div className="font-mono text-[10.5px] text-dim mt-0.5">{e.time} · {e.user} · {e.type}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-line bg-panel/60 flex items-center justify-between">
            {servers.length === 0
              ? <span className="font-mono text-[10.5px] text-dim">журнал аудита — только реальные действия</span>
              : servers.slice(0, 4).map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5 font-mono text-[10.5px] text-mut"><span className="w-1.5 h-1.5 rounded-sm" style={{ background: groupColor(s.group) }} />{s.group}</span>
                ))}
          </div>
        </div>
      </div>

      {/* сводка по группам */}
      {hasFleet && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {Array.from(new Set(servers.map((s) => s.group))).map((g, i) => {
            const gs = servers.filter((s) => s.group === g);
            const on = gs.filter((s) => s.status === "online").length;
            const c = groupColor(g);
            const gcpu = gs.filter((s) => s.status !== "offline").reduce((a, s) => a + last(metrics[s.id]?.cpu ?? [0]), 0) / Math.max(1, gs.filter((s) => s.status !== "offline").length);
            return (
              <button key={g} onClick={onServers} className="card card-h p-4 text-left anim-rise cursor-pointer group" style={{ animationDelay: `${0.45 + i * 0.06}s` }}>
                <div className="flex items-center justify-between mb-3">
                  <GroupChip name={g} />
                  <span className="font-mono text-[11px] text-mut">{on}/{gs.length} онлайн</span>
                </div>
                <div className="font-mono text-[22px] font-bold tnum" style={{ color: c }}>{gcpu.toFixed(0)}<span className="text-[13px] text-mut"> % CPU</span></div>
                <div className="mt-2 h-1 rounded-full bg-[#1a2436] overflow-hidden">
                  <div className="h-full barfill group-hover:opacity-80 transition-opacity" style={{ width: `${Math.min(100, gcpu)}%`, background: c }} />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {gs.map((s) => (
                    <span key={s.id} title={s.name} className="w-2 h-2 rounded-[3px]" style={{ background: s.status === "online" ? c : s.status === "warning" ? "#ffb224" : "#3a4a63" }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
