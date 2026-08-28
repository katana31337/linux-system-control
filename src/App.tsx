import { useCallback, useEffect, useRef, useState } from "react";
import AddAgent from "./components/AddAgent";
import Dashboard from "./components/Dashboard";
import Docs from "./components/Docs";
import Login, { BrandMark } from "./components/Login";
import { AuditPage, SettingsPage, UsersPage } from "./components/Pages";
import ServerDetail from "./components/ServerDetail";
import Servers from "./components/Servers";
import Terminal from "./components/Terminal";
import { Icon, ToastProvider, useNow, useToast, type IconName } from "./components/ui";
import {
  POINTS, ROLE_META, clearSession, getStoredUsers, getSession, hashPassword, resetAll, saveUsers,
  setSession, spawnSim, stopSim, timeStr, uid, verifyPassword,
  type AuditEvent, type Metrics, type MetricsMap, type Role, type Server, type StoredUser,
} from "./data";

type Tab = "dashboard" | "servers" | "detail" | "terminal" | "users" | "audit" | "settings" | "docs";

const NAV: { id: Tab; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Обзор", icon: "grid" },
  { id: "servers", label: "Агенты", icon: "server" },
  { id: "terminal", label: "Терминал", icon: "terminal" },
  { id: "users", label: "Пользователи", icon: "users" },
  { id: "audit", label: "Аудит", icon: "shield" },
  { id: "settings", label: "Настройки", icon: "gear" },
  { id: "docs", label: "Документация", icon: "book" },
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const seedFor = (s: Server): Metrics => {
  const cpu: number[] = []; const mem: number[] = []; const netIn: number[] = []; const netOut: number[] = [];
  for (let i = 0; i < POINTS; i++) {
    cpu.push(clamp(s.baseCpu + Math.sin(i / 3) * 5 + (Math.random() * 10 - 5), 2, 96));
    mem.push(clamp(s.baseMem + Math.sin(i / 5) * 3 + (Math.random() * 6 - 3), 5, 97));
    netIn.push(Math.random() * 60 + 5);
    netOut.push(Math.random() * 30 + 2);
  }
  return { cpu, mem, netIn, netOut };
};

function Shell() {
  const toast = useToast();
  const now = useNow(1000);

  // ── пользователи и сессия ──
  const [users, setUsers] = useState<StoredUser[]>(() => getStoredUsers());
  const [me, setMe] = useState<string | null>(() => {
    const s = getSession();
    return s && getStoredUsers().some((u) => u.login === s.login) ? s.login : null;
  });
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState<string | null>(null);

  // ── флот и телеметрия ──
  const [servers, setServers] = useState<Server[]>([]);
  const [metrics, setMetrics] = useState<MetricsMap>({});
  const serversRef = useRef(servers);
  const metricsRef = useRef(metrics);
  useEffect(() => { serversRef.current = servers; }, [servers]);
  useEffect(() => { metricsRef.current = metrics; }, [metrics]);

  // ── события / аудит ──
  const [events, setEvents] = useState<AuditEvent[]>(() => [
    { id: uid(), time: timeStr(), user: "system", type: "system", severity: "info", text: "реестр агентов: подключений нет, ожидание рукопожатий" },
    { id: uid(), time: timeStr(), user: "system", type: "system", severity: "ok", text: "KONTUR·OPS v2.4.1: консоль запущена, сборщик телеметрии активен" },
  ]);
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);

  const pushEvent = useCallback((type: AuditEvent["type"], severity: AuditEvent["severity"], text: string, user?: string) => {
    setEvents((e) => [{ id: uid(), time: timeStr(), user: user ?? meRef.current ?? "system", type, severity, text }, ...e].slice(0, 200));
  }, []);

  // ── UI-состояние ──
  const [tab, setTab] = useState<Tab>("dashboard");
  const [activeServer, setActiveServer] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [termServer, setTermServer] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  // ── авторизация ──
  const createAdmin = useCallback(async (login: string, pw: string) => {
    setLoginBusy(true);
    setLoginErr(null);
    const { salt, hash } = await hashPassword(pw);
    const u: StoredUser = { id: uid(), login, role: "admin", createdAt: Date.now(), salt, hash };
    const next = [...getStoredUsers(), u];
    saveUsers(next); setUsers(next);
    setSession(login, true);
    setMe(login);
    pushEvent("user", "ok", `первичная настройка: создана учётная запись администратора «${login}»`, "system");
    toast(`Администратор «${login}» создан. Добро пожаловать!`, "ok");
    setLoginBusy(false);
  }, [pushEvent, toast]);

  const doLogin = useCallback(async (login: string, pw: string, remember: boolean) => {
    setLoginBusy(true);
    setLoginErr(null);
    await new Promise((r) => setTimeout(r, 450));
    const u = getStoredUsers().find((x) => x.login.toLowerCase() === login.toLowerCase());
    if (!u) {
      setLoginErr("Пользователь не найден");
      pushEvent("auth", "warn", `неудачный вход: неизвестный логин «${login}»`, "system");
      setLoginBusy(false);
      return;
    }
    const ok = await verifyPassword(pw, u.salt, u.hash);
    if (!ok) {
      setLoginErr("Неверный пароль. Попытка записана в журнал аудита.");
      pushEvent("auth", "warn", `неудачный вход: «${u.login}» — неверный пароль`, "system");
      setLoginBusy(false);
      return;
    }
    const next = getStoredUsers().map((x) => (x.id === u.id ? { ...x, lastLoginAt: Date.now() } : x));
    saveUsers(next); setUsers(next);
    setSession(u.login, remember);
    setMe(u.login);
    pushEvent("auth", "ok", `вход в консоль (${ROLE_META[u.role].label.toLowerCase()})`, u.login);
    toast(`Сессия открыта: ${u.login}`, "ok");
    setLoginBusy(false);
  }, [pushEvent, toast]);

  const logout = useCallback(() => {
    pushEvent("auth", "info", "выход из консоли, сессия закрыта");
    clearSession();
    setMe(null);
    setTab("dashboard");
  }, [pushEvent]);

  // ── агенты ──
  const addAgent = useCallback((srv: Server) => {
    setServers((p) => [...p, srv]);
    setMetrics((p) => ({ ...p, [srv.id]: seedFor(srv) }));
    spawnSim(srv.id, (text, sev) => pushEvent("agent", sev, `${srv.name}: ${text}`, "system"));
    pushEvent("agent", "ok", `агент «${srv.name}» (${srv.ip}:${srv.port}) прошёл рукопожатие и добавлен в реестр`);
  }, [pushEvent]);

  const removeAgent = useCallback((id: string) => {
    const s = serversRef.current.find((x) => x.id === id);
    stopSim(id);
    setServers((p) => p.filter((x) => x.id !== id));
    setMetrics((p) => { const n = { ...p }; delete n[id]; return n; });
    if (s) pushEvent("agent", "warn", `агент «${s.name}» удалён из реестра, токен отозван`);
    toast(s ? `Агент «${s.name}» удалён из реестра` : "Агент удалён", "info");
    setTab("servers");
  }, [pushEvent, toast]);

  // ── пользователи (RBAC) ──
  const addUser = useCallback(async (login: string, pw: string, role: Role): Promise<string | null> => {
    if (getStoredUsers().some((u) => u.login.toLowerCase() === login.toLowerCase())) return "Такой логин уже существует";
    const { salt, hash } = await hashPassword(pw);
    const u: StoredUser = { id: uid(), login, role, createdAt: Date.now(), salt, hash };
    const next = [...getStoredUsers(), u];
    saveUsers(next); setUsers(next);
    pushEvent("user", "ok", `создан пользователь «${login}» (роль: ${ROLE_META[role].label})`);
    return null;
  }, [pushEvent]);

  const setUserRole = useCallback((id: string, role: Role) => {
    const u = getStoredUsers().find((x) => x.id === id);
    const next = getStoredUsers().map((x) => (x.id === id ? { ...x, role } : x));
    saveUsers(next); setUsers(next);
    if (u) pushEvent("user", "warn", `«${u.login}»: роль изменена на «${ROLE_META[role].label}»`);
  }, [pushEvent]);

  const removeUser = useCallback((id: string) => {
    const u = getStoredUsers().find((x) => x.id === id);
    const next = getStoredUsers().filter((x) => x.id !== id);
    saveUsers(next); setUsers(next);
    if (u) pushEvent("user", "warn", `пользователь «${u.login}» удалён`);
  }, [pushEvent]);

  const changePassword = useCallback(async (cur: string, nextPw: string): Promise<string | null> => {
    const u = getStoredUsers().find((x) => x.login === meRef.current);
    if (!u) return "Сессия недействительна";
    if (!(await verifyPassword(cur, u.salt, u.hash))) return "Текущий пароль неверен";
    const { salt, hash } = await hashPassword(nextPw);
    const next = getStoredUsers().map((x) => (x.id === u.id ? { ...x, salt, hash } : x));
    saveUsers(next); setUsers(next);
    pushEvent("user", "ok", `«${u.login}»: пароль изменён`);
    return null;
  }, [pushEvent]);

  // ── тик телеметрии ──
  useEffect(() => {
    if (!me) return;
    const t = window.setInterval(() => {
      const list = serversRef.current;
      if (!list.length) return;
      const pm = metricsRef.current;
      const nextM: MetricsMap = {};
      const statuses: Record<string, Server["status"]> = {};
      list.forEach((s) => {
        const m = pm[s.id];
        if (!m || s.status === "offline") { if (m) nextM[s.id] = m; return; }
        const wave = Math.sin(Date.now() / 26000 + s.baseCpu) * 6;
        const cpu = clamp(s.baseCpu + wave + (Math.random() * 18 - 9), 2, 97);
        const mem = clamp(s.baseMem + Math.sin(Date.now() / 40000 + s.baseMem) * 4 + (Math.random() * 8 - 4), 5, 97);
        nextM[s.id] = {
          cpu: [...m.cpu.slice(-(POINTS - 1)), cpu],
          mem: [...m.mem.slice(-(POINTS - 1)), mem],
          netIn: [...m.netIn.slice(-(POINTS - 1)), Math.random() * 60 + 5],
          netOut: [...m.netOut.slice(-(POINTS - 1)), Math.random() * 30 + 2],
        };
        statuses[s.id] = cpu > 78 ? "warning" : "online";
      });
      setMetrics((p) => ({ ...p, ...nextM }));
      setServers((p) => p.map((s) => (statuses[s.id] ? { ...s, status: statuses[s.id], lastSeen: timeStr() } : s)));
    }, 2000);
    return () => window.clearInterval(t);
  }, [me]);

  const resetConsole = useCallback(() => {
    pushEvent("system", "warn", "полный сброс данных консоли (пользователи, сессия, настройки)", "system");
    resetAll();
    window.location.reload();
  }, [pushEvent]);

  // ── рендер ──
  if (!me) {
    return (
      <Login
        mode={users.length ? "login" : "setup"}
        busy={loginBusy}
        error={loginErr}
        onLogin={doLogin}
        onCreate={createAdmin}
      />
    );
  }

  const meUser = users.find((u) => u.login === me);
  const detailServer = servers.find((s) => s.id === activeServer) ?? null;
  const termSrv = servers.find((s) => s.id === termServer) ?? servers[0] ?? null;

  const openServer = (id: string, t?: string) => {
    setActiveServer(id);
    setDetailTab(t ?? "overview");
    setTab("detail");
  };

  return (
    <div className="flex min-h-screen">
      {/* ── sidebar ── */}
      <aside className="w-[218px] shrink-0 border-r border-line bg-panel/70 backdrop-blur-sm flex flex-col sticky top-0 h-screen">
        <button onClick={() => setTab("dashboard")} className="flex items-center gap-2.5 px-4 h-[62px] border-b border-line cursor-pointer text-left">
          <BrandMark small />
          <div>
            <div className="font-display font-extrabold text-[15px] tracking-widest leading-none">KONTUR<span className="text-amber">·OPS</span></div>
            <div className="font-mono text-[9px] text-dim tracking-[0.18em] mt-1">linux fleet console</div>
          </div>
        </button>
        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => {
            const active = tab === n.id || (n.id === "servers" && tab === "detail");
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer relative ${
                  active ? "text-amber bg-amber/10" : "text-mut hover:text-ink hover:bg-raise/70"}`}>
                {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-amber" />}
                <Icon n={n.icon} size={16} />
                {n.label}
                {n.id === "servers" && servers.length > 0 && (
                  <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-raise border border-line text-mut">{servers.length}</span>
                )}
                {n.id === "audit" && (
                  <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-raise border border-line text-mut">{events.length}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-3.5 border-t border-line">
          <div className="font-mono text-[10px] text-dim leading-relaxed">
            v2.4.1 · ws :8443<br />агентов: {servers.length} · поток live
          </div>
        </div>
      </aside>

      {/* ── main ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[62px] shrink-0 border-b border-line bg-panel/60 backdrop-blur-sm flex items-center gap-4 px-5 sticky top-0 z-30">
          <h1 className="font-display font-semibold text-[15px] tracking-wide whitespace-nowrap">
            {NAV.find((n) => n.id === (tab === "detail" ? "servers" : tab))?.label ?? ""}
            {tab === "detail" && detailServer && <span className="text-dim font-mono text-[12px] font-normal"> / {detailServer.name}</span>}
          </h1>
          <div className="flex-1 max-w-[340px] ml-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim"><Icon n="search" size={14} /></span>
              <input value={search} onChange={(e) => { setSearch(e.target.value); if (tab !== "servers") setTab("servers"); }}
                placeholder="Поиск: имя или IP агента…"
                className="w-full bg-panel border border-line rounded-lg pl-9 pr-3 py-1.5 text-[12.5px] font-mono placeholder:text-dim focus:border-amber/60 focus:bg-panel2 transition-colors outline-none" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3.5">
            <div className="hidden md:block text-right">
              <div className="font-mono text-[13px] tnum text-ink">{now.toTimeString().slice(0, 8)}</div>
              <div className="font-mono text-[9.5px] text-dim tracking-wider">{now.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })} · UTC{-(new Date().getTimezoneOffset() / 60) >= 0 ? "+" : ""}{-(new Date().getTimezoneOffset() / 60)}</div>
            </div>
            <div className="flex items-center gap-2.5 pl-3.5 border-l border-line">
              <div className="text-right hidden sm:block">
                <div className="font-mono text-[12.5px] leading-tight">{me}</div>
                <div className="font-mono text-[9.5px]" style={{ color: meUser ? ROLE_META[meUser.role].color : "#8595ad" }}>
                  {meUser ? ROLE_META[meUser.role].label.toLowerCase() : "—"}
                </div>
              </div>
              <button onClick={logout} title="Выйти"
                className="p-2 rounded-lg border border-line text-mut hover:text-bad hover:border-bad/40 hover:bg-bad/8 transition-colors cursor-pointer">
                <Icon n="logout" size={15} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-7 max-w-[1460px] w-full mx-auto">
          {tab === "dashboard" && (
            <Dashboard servers={servers} metrics={metrics} events={events}
              onOpen={openServer} onServers={() => setTab("servers")} onAdd={() => setAddOpen(true)} />
          )}
          {tab === "servers" && (
            <Servers servers={servers} metrics={metrics} query={search}
              onOpen={openServer} onAdd={() => setAddOpen(true)} />
          )}
          {tab === "detail" && detailServer && (
            <ServerDetail server={detailServer} metrics={metrics} tab={detailTab} onTab={setDetailTab}
              onBack={() => setTab("servers")} onDelete={removeAgent} logEvent={pushEvent} />
          )}
          {tab === "terminal" && (
            <div className="space-y-4">
              {servers.length === 0 ? (
                <div className="card p-10 text-center anim-pop max-w-2xl mx-auto">
                  <span className="inline-flex p-3 rounded-xl bg-panel2 border border-line2 text-dim mb-4"><Icon n="terminal" size={26} /></span>
                  <h2 className="font-display font-bold text-lg mb-1.5">Терминалу некуда подключаться</h2>
                  <p className="text-[13px] text-mut mb-6">
                    Веб-bash работает через PTY на агенте: сначала подключите хотя бы один узел —
                    и здесь появится интерактивная консоль без прямого SSH.
                  </p>
                  <button onClick={() => setAddOpen(true)}
                    className="px-5 py-2.5 rounded-lg bg-amber text-bg font-display font-bold text-[13px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer inline-flex items-center gap-2">
                    <Icon n="plus" size={14} /> ПОДКЛЮЧИТЬ АГЕНТА
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="lbl mr-1">узел:</span>
                    {servers.map((s) => (
                      <button key={s.id} onClick={() => setTermServer(s.id)} disabled={s.status === "offline"}
                        className={`px-3 py-1.5 rounded-md text-[12px] font-mono border transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-35 disabled:cursor-not-allowed ${
                          termSrv?.id === s.id ? "border-amber/60 text-amber bg-amber/10" : "border-line text-mut hover:border-line2"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.status === "online" ? "bg-ok" : s.status === "warning" ? "bg-amber" : "bg-bad"}`} />
                        {s.name}
                      </button>
                    ))}
                  </div>
                  {termSrv && (
                    <Terminal server={termSrv} height={520}
                      onCommand={(cmd) => pushEvent("exec", "info", `${termSrv.name}: ${cmd}`)} />
                  )}
                </>
              )}
            </div>
          )}
          {tab === "users" && (
            <UsersPage users={users} me={me} onAdd={addUser} onRole={setUserRole} onRemove={removeUser} />
          )}
          {tab === "audit" && <AuditPage events={events} />}
          {tab === "settings" && (
            <SettingsPage me={me}
              counts={{ agents: servers.length, users: users.length, audit: events.length }}
              onChangePassword={changePassword} onReset={resetConsole} />
          )}
          {tab === "docs" && <Docs />}
        </main>
      </div>

      <AddAgent open={addOpen} onClose={() => setAddOpen(false)} onAdded={addAgent} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
