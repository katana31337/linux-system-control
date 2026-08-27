import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INITIAL_EVENTS, LIVE_EVENT_POOL, SERVERS, USERS, nowTime, seedMetrics, stepMetrics,
  type AuditEvent, type MetricsMap, type Server, type User,
} from "./data";
import Login, { BrandMark } from "./components/Login";
import Dashboard from "./components/Dashboard";
import Servers from "./components/Servers";
import ServerDetail from "./components/ServerDetail";
import { AuditPage, SettingsPage, UsersPage } from "./components/Pages";
import Docs from "./components/Docs";
import Terminal from "./components/Terminal";
import { Icon, ToastProvider, useToast, type IconName } from "./components/ui";

type Page =
  | { name: "dashboard" } | { name: "servers" } | { name: "server"; id: string; tab: string }
  | { name: "terminal" } | { name: "users" } | { name: "audit" } | { name: "docs" } | { name: "settings" };

const PAGE_TITLE: Record<Page["name"], string> = {
  dashboard: "Обзор флота", servers: "Реестр агентов", server: "Карточка сервера",
  terminal: "Глобальный терминал", users: "Пользователи", audit: "Журнал аудита",
  docs: "Архитектура и API", settings: "Настройки",
};

let eventSeq = 1000;

function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}

function Root() {
  const [session, setSession] = useState<string | null>(() => localStorage.getItem("kontur_session"));
  if (!session) {
    return (
      <Login
        onLogin={(login, remember) => {
          if (remember) localStorage.setItem("kontur_session", login);
          setSession(login);
        }}
      />
    );
  }
  return <Shell login={session} onLogout={() => { localStorage.removeItem("kontur_session"); setSession(null); }} />;
}

function Shell({ login, onLogout }: { login: string; onLogout: () => void }) {
  const toast = useToast();
  const [page, setPage] = useState<Page>({ name: "dashboard" });
  const [servers, setServers] = useState<Server[]>(SERVERS);
  const [users, setUsers] = useState<User[]>(USERS);
  const [events, setEvents] = useState<AuditEvent[]>(INITIAL_EVENTS);
  const [metrics, setMetrics] = useState<MetricsMap>(() => seedMetrics(SERVERS));
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sideOpen, setSideOpen] = useState(false);
  const [termServer, setTermServer] = useState<string>("s3");
  const serversRef = useRef(servers);
  serversRef.current = servers;

  const logEvent = useCallback((type: AuditEvent["type"], severity: AuditEvent["severity"], text: string) => {
    setEvents((e) => [{ id: eventSeq++, time: nowTime(), type, severity, text }, ...e].slice(0, 90));
  }, []);

  // телеметрия: шаг каждые 2 с
  useEffect(() => {
    const t = setInterval(() => setMetrics((m) => stepMetrics(m, serversRef.current)), 2000);
    return () => clearInterval(t);
  }, []);

  // live-поток событий аудита
  useEffect(() => {
    const t = setInterval(() => {
      const pool = serversRef.current.filter((s) => s.status !== "offline");
      if (!pool.length) return;
      const s = pool[Math.floor(Math.random() * pool.length)];
      const gen = LIVE_EVENT_POOL[Math.floor(Math.random() * LIVE_EVENT_POOL.length)];
      const e = gen(s);
      setEvents((ev) => [{ id: eventSeq++, time: nowTime(), ...e }, ...ev].slice(0, 90));
    }, 6500);
    return () => clearInterval(t);
  }, []);

  const openServer = useCallback((id: string, tab = "overview") => setPage({ name: "server", id, tab }), []);

  const addServer = useCallback((s: Server) => {
    setServers((prev) => [...prev, s]);
    setMetrics((m) => ({ ...m, ...seedMetrics([s]) }));
    logEvent("agent", "ok", `новый агент ${s.name} (${s.ip}:${s.port}) добавлен в реестр, токен валидирован`);
  }, [logEvent]);

  const deleteServer = useCallback((id: string) => {
    const s = serversRef.current.find((x) => x.id === id);
    setServers((prev) => prev.filter((x) => x.id !== id));
    setPage({ name: "servers" });
    if (s) {
      toast(`Агент ${s.name} удалён из реестра`, "info");
      logEvent("agent", "warn", `агент ${s.name} удалён из реестра (admin), хэш токена уничтожен`);
    }
  }, [toast, logEvent]);

  const nav = useMemo(() => {
    const alerts = servers.filter((s) => s.status !== "online").length;
    return ([
      ["dashboard", "Обзор", "grid", null],
      ["servers", "Серверы", "server", servers.length],
      ["terminal", "Терминал", "terminal", null],
      ["users", "Пользователи", "users", users.length],
      ["audit", "Аудит", "scroll", alerts || null],
      ["docs", "Архитектура", "book", null],
      ["settings", "Настройки", "gear", null],
    ] as [Page["name"], string, IconName, number | null][]);
  }, [servers, users]);

  const current = servers.find((s) => page.name === "server" && s.id === page.id);
  const onlineForTerm = servers.filter((s) => s.status !== "offline");
  const activeTerm = onlineForTerm.find((s) => s.id === termServer) ?? onlineForTerm[0];

  return (
    <div className="min-h-screen flex">
      {/* ── сайдбар ── */}
      {sideOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSideOpen(false)} />}
      <aside className={`fixed lg:sticky top-0 h-screen z-50 w-[228px] shrink-0 border-r border-line bg-panel/95 backdrop-blur-sm flex flex-col transition-transform duration-300 ${sideOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-line">
          <BrandMark small />
          <div>
            <div className="font-display font-extrabold text-[15px] tracking-[0.14em] leading-none">KONTUR<span className="text-amber">·OPS</span></div>
            <div className="font-mono text-[9px] text-dim tracking-[0.2em] mt-1">FLEET CONTROL v2.4</div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2.5 space-y-1 overflow-y-auto">
          <div className="lbl px-3 pb-2">управление</div>
          {nav.slice(0, 3).map(([id, label, ic, badge]) => (
            <NavItem key={id} active={page.name === id || (page.name === "server" && id === "servers")} label={label} icon={ic} badge={badge}
              onClick={() => { setPage({ name: id } as Page); setSideOpen(false); }} />
          ))}
          <div className="lbl px-3 pt-4 pb-2">система</div>
          {nav.slice(3).map(([id, label, ic, badge]) => (
            <NavItem key={id} active={page.name === id} label={label} icon={ic} badge={badge} badgeColor={id === "audit" ? "#ffb224" : undefined}
              onClick={() => { setPage({ name: id } as Page); setSideOpen(false); }} />
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          <div className="card bg-panel2/70 p-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-amber/15 border border-amber/40 text-amber flex items-center justify-center font-display font-bold text-[12px]">
                {login.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[12px] truncate">@{login}</div>
                <div className="font-mono text-[10px] text-ok flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-ok" /> admin · 2FA</div>
              </div>
              <button onClick={() => { toast("Сессия завершена, токен отозван", "info"); onLogout(); }}
                className="ml-auto p-1.5 rounded-md text-mut hover:text-bad hover:bg-bad/10 transition-colors cursor-pointer" title="Выйти">
                <Icon n="out" size={15} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── основная область ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 border-b border-line bg-bg/85 backdrop-blur-md flex items-center gap-3 px-4 lg:px-6">
          <button onClick={() => setSideOpen(true)} className="lg:hidden p-2 -ml-1 rounded-md text-mut hover:text-ink hover:bg-raise transition-colors cursor-pointer"><Icon n="menu" size={18} /></button>
          <div className="min-w-0">
            <div className="font-display font-bold text-[15px] tracking-wide truncate">{PAGE_TITLE[page.name]}</div>
            <div className="font-mono text-[10px] text-dim tracking-wider hidden sm:block">kontur-core · {servers.filter((s) => s.status !== "offline").length}/{servers.length} агентов в сети</div>
          </div>

          <form
            className="ml-auto relative hidden md:block"
            onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage({ name: "servers" }); }}
          >
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim"><Icon n="search" size={14} /></span>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="поиск по реестру…"
              className="w-56 bg-panel border border-line rounded-lg pl-8 pr-3 py-2 text-[12.5px] font-mono focus:border-amber/60 focus:w-72 outline-none transition-all placeholder:text-dim"
            />
          </form>

          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <span className="hidden sm:flex items-center gap-1.5 font-mono text-[10.5px] text-ok border border-ok/25 bg-ok/6 rounded-md px-2 py-1.5">
              <Icon n="wifi" size={12} /> ws connected
            </span>
            <Clock />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1560px] w-full mx-auto">
          {page.name === "dashboard" && (
            <Dashboard servers={servers} metrics={metrics} events={events} onOpen={openServer} onServers={() => setPage({ name: "servers" })} />
          )}
          {page.name === "servers" && (
            <Servers servers={servers} metrics={metrics} onOpen={openServer} onAdd={addServer} query={query} />
          )}
          {page.name === "server" && current && (
            <ServerDetail
              server={current} metrics={metrics} tab={page.tab}
              onTab={(t) => setPage({ name: "server", id: current.id, tab: t })}
              onBack={() => setPage({ name: "servers" })}
              onDelete={deleteServer} logEvent={logEvent}
            />
          )}
          {page.name === "server" && !current && (
            <div className="card p-10 text-center text-mut">Сервер удалён из реестра. <button onClick={() => setPage({ name: "servers" })} className="text-amber cursor-pointer">Вернуться к реестру</button></div>
          )}
          {page.name === "terminal" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="anim-rise">
                  <h2 className="font-display text-xl font-bold tracking-wide">Глобальный терминал</h2>
                  <p className="text-[13px] text-mut mt-0.5">Интерактивный bash без прямого SSH — PTY открывается на агенте, поток идёт через exec-relay консоли</p>
                </div>
                <select
                  value={activeTerm?.id ?? ""}
                  onChange={(e) => setTermServer(e.target.value)}
                  className="ml-auto bg-panel border border-line rounded-lg px-3 py-2.5 font-mono text-[13px] outline-none focus:border-amber/60 cursor-pointer"
                >
                  {onlineForTerm.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.ip}</option>)}
                </select>
              </div>
              {activeTerm ? (
                <Terminal key={activeTerm.id} server={activeTerm} height={560}
                  onCommand={(c) => c.trim() && logEvent("exec", "info", `admin → ${activeTerm.name}: ${c.slice(0, 64)}`)} />
              ) : (
                <div className="card p-10 text-center text-mut">Нет агентов онлайн</div>
              )}
              <div className="grid sm:grid-cols-3 gap-3">
                {([
                  ["PTY, а не построчный exec", "терминал отдаёт настоящий PTY: vim, top, htop работают как по SSH"],
                  ["каждая команда — в аудит", "кто, когда, на каком хосте и что исполнил: append-only журнал"],
                  ["ролевой доступ", "viewer видит только метрики, operator — команды, admin — всё"],
                ] as [string, string][]).map(([t, d], i) => (
                  <div key={t} className="card p-4 anim-rise" style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="flex items-center gap-2 text-ok mb-1.5"><Icon n="terminal" size={14} /><span className="font-display font-semibold text-[13px]">{t}</span></div>
                    <p className="text-[12px] text-mut leading-relaxed">{d}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {page.name === "users" && <UsersPage users={users} onChange={setUsers} logEvent={logEvent} selfLogin={login} />}
          {page.name === "audit" && <AuditPage events={events} />}
          {page.name === "docs" && <Docs />}
          {page.name === "settings" && <SettingsPage logEvent={logEvent} />}
        </main>

        <footer className="border-t border-line px-4 lg:px-6 py-3 flex items-center gap-4 font-mono text-[10.5px] text-dim flex-wrap">
          <span>KONTUR OPS v2.4.1</span>
          <span className="hidden sm:inline">агенты: go 1.22 · консоль: node 20 · БД: postgres 16 + timescale</span>
          <span className="ml-auto flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-ok ring-pulse" style={{ ["--ring-c" as string]: "#3ecf8e66" }} /> телеметрия: поток активен, шаг 2 c</span>
        </footer>
      </div>
    </div>
  );
}

function NavItem({ active, label, icon, badge, badgeColor, onClick }: {
  active: boolean; label: string; icon: IconName; badge?: number | null; badgeColor?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all cursor-pointer relative ${active ? "bg-raise text-ink" : "text-mut hover:text-ink hover:bg-raise/50"}`}>
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-amber" />}
      <Icon n={icon} size={16} className={active ? "text-amber" : ""} />
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-auto font-mono text-[10.5px] px-1.5 py-0.5 rounded-md border" style={{ color: badgeColor ?? "#8595ad", borderColor: (badgeColor ?? "#8595ad") + "55", background: (badgeColor ?? "#8595ad") + "12" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-[14px] font-bold tnum">{now.toLocaleTimeString("ru-RU", { hour12: false })}</div>
      <div className="font-mono text-[9.5px] text-dim tracking-wider">{now.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }).toUpperCase()}</div>
    </div>
  );
}

export default App;
