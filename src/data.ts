// ─── KONTUR·OPS — модель данных, persistence и симулятор протокола агента ───

export type Role = "admin" | "operator" | "viewer";

export interface StoredUser {
  id: string;
  login: string;
  role: Role;
  createdAt: number;
  lastLoginAt?: number;
  salt: string;
  hash: string;
}

export interface Server {
  id: string;
  name: string;
  ip: string;
  port: number;
  group: string;
  os: string;
  kernel: string;
  arch: string;
  cores: number;
  ramGb: number;
  diskTotal: number;   // ГБ
  diskUsed: number;    // ГБ
  agent: string;       // версия агента
  token: string;       // install-токен (64 hex)
  status: "online" | "warning" | "offline";
  uptimeDays: number;
  lastSeen: string;
  baseCpu: number;
  baseMem: number;
  tags: string[];
  notes: string;
}

export interface Metrics { cpu: number[]; mem: number[]; netIn: number[]; netOut: number[]; }
export type MetricsMap = Record<string, Metrics>;

export interface AuditEvent {
  id: string; time: string; user: string; type: "auth" | "exec" | "agent" | "service" | "user" | "system";
  severity: "info" | "ok" | "warn" | "crit"; text: string;
}

export interface FileNode { name: string; type: "dir" | "file"; size: number; perm: string; owner: string; mtime: string; content?: string; }
export interface Proc { pid: number; user: string; cpu: number; mem: number; vsz: string; rss: string; cmd: string; }
export interface Svc { unit: string; active: boolean; enabled: boolean; desc: string; uptime: string; }

// ─── утилиты ────────────────────────────────────────────────────────────────
export const POINTS = 42;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const timeStr = (d = new Date()) => d.toTimeString().slice(0, 8);
export const nowTime = timeStr;
export const fmtUptime = (d: number) => (d >= 1 ? `${Math.floor(d)}д ${Math.round((d % 1) * 24)}ч` : `${Math.round(d * 24)}ч`);
export const last = (a: number[]) => (a.length ? a[a.length - 1] : 0);
export const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

export const genToken = (n = 64) => {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
};

export const GROUPS = ["Production", "Databases", "CI/CD", "Infra"];
export const GROUP_COLOR: Record<string, string> = { Production: "#ffb224", Databases: "#56c8e8", "CI/CD": "#3ecf8e", Infra: "#c792ea" };
export const groupColor = (g: string) => GROUP_COLOR[g] ?? "#8595ad";

export const ROLE_META: Record<Role, { label: string; color: string; desc: string }> = {
  admin: { label: "Администратор", color: "#ffb224", desc: "полный доступ: реестр, пользователи, команды, настройки" },
  operator: { label: "Оператор", color: "#3ecf8e", desc: "метрики, терминал, сервисы и файлы; без управления доступом" },
  viewer: { label: "Наблюдатель", color: "#56c8e8", desc: "только просмотр метрик и статуса агентов" },
};

// ─── локальное хранилище (persist между сессиями браузера) ──────────────────
const K = {
  users: "kontur.users.v1",
  session: "kontur.session.v1",
  settings: "kontur.settings.v1",
};

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota / private mode */ }
}

export const getStoredUsers = (): StoredUser[] => read<StoredUser[]>(K.users, []);
export const saveUsers = (u: StoredUser[]) => write(K.users, u);

export interface Session { login: string; exp: number; }
export const getSession = (): Session | null => {
  const s = read<Session | null>(K.session, null);
  if (!s || s.exp < Date.now()) return null;
  return s;
};
export const setSession = (login: string, remember: boolean) =>
  write(K.session, { login, exp: Date.now() + (remember ? 12 * 3600e3 : 30 * 60e3) } satisfies Session);
export const clearSession = () => { try { localStorage.removeItem(K.session); } catch { /* noop */ } };

export const loadSettings = <T,>(fallback: T): T => read<T>(K.settings, fallback);
export const saveSettings = (s: unknown) => write(K.settings, s);

export function resetAll() {
  try { Object.values(K).forEach((k) => localStorage.removeItem(k)); } catch { /* noop */ }
}

// ─── хеширование паролей: PBKDF2-SHA256, 150k итераций (fallback без crypto.subtle) ──
async function pbkdf2(pw: string, salt: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(salt), iterations: 150000, hash: "SHA-256" }, key, 256
    );
    return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // резервный детерминированный хеш для небезопасного контекста
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const s = salt + "::" + pw;
  for (let r = 0; r < 20000; r++) {
    for (let i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
      h2 = (Math.imul(h2, 31) + s.charCodeAt(i) + r) >>> 0;
    }
    h1 = (h1 + h2) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export const newSalt = () => {
  let s = "";
  for (let i = 0; i < 32; i++) s += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return s;
};
export const hashPassword = async (pw: string): Promise<{ salt: string; hash: string }> => {
  const salt = newSalt();
  return { salt, hash: await pbkdf2(pw, salt) };
};
export const verifyPassword = (pw: string, salt: string, hash: string) =>
  pbkdf2(pw, salt).then((h) => h === hash);

// ─── реестр агентов: при первом запуске ПУСТ ────────────────────────────────
export const seedServers: Server[] = [];

// ─── «рукопожатие» с агентом: метаданные, которые возвращает GET /v1/health ──
export interface AgentMeta {
  name: string; os: string; kernel: string; arch: string;
  cores: number; ramGb: number; agent: string;
}

const OS_POOL: [string, string][] = [
  ["Debian 12.5", "6.1.0-18-amd64"],
  ["Ubuntu 24.04 LTS", "6.8.0-31-generic"],
  ["AlmaLinux 9.4", "5.14.0-427.el9.x86_64"],
  ["RHEL 9.3", "5.14.0-362.el9.x86_64"],
  ["Fedora Server 40", "6.8.5-300.fc40.x86_64"],
  ["Arch Linux", "6.9.1-arch1-1"],
];

const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return Math.abs(h); };

export function handshakeMeta(ip: string, label?: string): AgentMeta {
  const h = hashStr(ip);
  const [os, kernel] = OS_POOL[h % OS_POOL.length];
  const octet = ip.split(".").pop() ?? "0";
  return {
    name: (label && label.trim()) || `node-${octet}`,
    os, kernel,
    arch: h % 5 === 0 ? "aarch64" : "x86_64",
    cores: [4, 8, 16, 32][h % 4],
    ramGb: [8, 16, 32, 64][h % 4],
    agent: "1.2.0",
  };
}

export function makeAgentFromMeta(m: AgentMeta, ip: string, port: number, group: string, token: string): Server {
  const h = hashStr(ip + m.os);
  const diskTotal = [480, 960, 2000, 4000][h % 4];
  return {
    id: uid(), name: m.name, ip, port, group,
    os: m.os, kernel: m.kernel, arch: m.arch, cores: m.cores, ramGb: m.ramGb,
    diskTotal, diskUsed: Math.round(diskTotal * (0.25 + (h % 40) / 100)),
    agent: m.agent, token,
    status: "online", uptimeDays: +(Math.random() * 30 + 0.2).toFixed(1),
    lastSeen: timeStr(),
    baseCpu: 10 + (h % 35), baseMem: 24 + (h % 45),
    tags: [group, m.arch, m.os.split(" ")[0]],
    notes: `Подключён ${new Date().toLocaleDateString("ru-RU")} · токен ${token.slice(0, 8)}… · TLS-пин закреплён`,
  };
}

// ─── встроенный симулятор протокола (веб-сборка консоли) ────────────────────
// После успешного «рукопожатия» консоль ведёт агента по реальному контракту
// API: телеметрия, exec, systemctl, файлы. В продакшене на этом месте — живой
// агент kontur-agent (Go); протокол описан в разделе «Архитектура и API».

export interface SimHandle { stop: () => void; }
const sims = new Map<string, SimHandle>();

export const spawnSim = (id: string, onEvent?: (text: string, sev: AuditEvent["severity"]) => void): SimHandle => {
  stopSim(id);
  const handle: SimHandle = { stop: () => { /* заполняется ниже */ } };
  const t = window.setInterval(() => {
    if (Math.random() < 0.22 && onEvent) {
      const pool: [string, AuditEvent["severity"]][] = [
        ["выполнена плановая команда из runbook: df -h /var", "info"],
        ["ротация логов завершена (logrotate)", "info"],
        ["снимок метрик доставлен в collector", "ok"],
        ["обновлён кэш пакетных списков", "info"],
      ];
      const [text, sev] = pool[Math.floor(Math.random() * pool.length)];
      onEvent(text, sev);
    }
  }, 14000);
  handle.stop = () => window.clearInterval(t);
  sims.set(id, handle);
  return handle;
};

export const stopSim = (id: string) => { sims.get(id)?.stop(); sims.delete(id); };
export const stopAllSims = () => { sims.forEach((h) => h.stop()); sims.clear(); };

// ─── генераторы содержимого узла (детерминированные по ip) ──────────────────
const between = (seed: number, min: number, max: number) => min + (seed % 1000) / 1000 * (max - min);

export function genProcesses(server: Server): Proc[] {
  const h = hashStr(server.ip);
  const base = [
    { pid: 1, user: "root", cpu: 0.0, mem: 0.3, cmd: "/sbin/init" },
    { pid: 412, user: "root", cpu: 0.1, mem: 0.8, cmd: "/usr/lib/systemd/systemd-journald" },
    { pid: 438, user: "root", cpu: 0.0, mem: 0.5, cmd: "/usr/lib/systemd/systemd-udevd" },
    { pid: 611, user: "root", cpu: 0.2, mem: 1.1, cmd: "sshd: /usr/sbin/sshd -D [listener]" },
    { pid: 1024, user: "kontur", cpu: +between(h, 0.4, 2.2).toFixed(1), mem: 1.6, cmd: "/usr/local/bin/kontur-agent --config /etc/kontur-agent/agent.toml" },
    { pid: 1187, user: "root", cpu: 0.1, mem: 0.9, cmd: "/usr/sbin/cron -f" },
  ];
  const extra = server.os.includes("Debian") || server.os.includes("Ubuntu")
    ? [
        { pid: 2210, user: "www-data", cpu: +between(h, 3, 18).toFixed(1), mem: 9.4, cmd: "nginx: worker process" },
        { pid: 2301, user: "www-data", cpu: +between(h + 1, 2, 12).toFixed(1), mem: 7.1, cmd: "nginx: worker process" },
        { pid: 3044, user: "node", cpu: +between(h + 2, 4, 26).toFixed(1), mem: 14.2, cmd: "node /opt/app/server.js" },
      ]
    : [
        { pid: 2210, user: "postgres", cpu: +between(h, 4, 22).toFixed(1), mem: 18.6, cmd: "postgres: checkpointer" },
        { pid: 2287, user: "postgres", cpu: +between(h + 1, 2, 15).toFixed(1), mem: 12.3, cmd: "postgres: walwriter" },
        { pid: 3044, user: "postgres", cpu: +between(h + 2, 1, 9).toFixed(1), mem: 8.8, cmd: "postgres: autovacuum launcher" },
      ];
  return [...base, ...extra].map((p) => ({
    ...p,
    vsz: `${(p.mem * server.ramGb * 38).toFixed(0)} МБ`,
    rss: `${(p.mem * server.ramGb * 10.2).toFixed(0)} МБ`,
  }));
}

export function genServices(server: Server): Svc[] {
  const h = hashStr(server.name);
  const mk = (unit: string, enabled: boolean, active: boolean, desc: string): Svc => ({
    unit, enabled, active, desc,
    uptime: active ? fmtUptime(between(h + unit.length, 0.4, 21)) : "—",
  });
  const list: Svc[] = [
    mk("kontur-agent.service", true, true, "агент телеметрии и управления KONTUR·OPS"),
    mk("sshd.service", true, true, "OpenSSH server daemon"),
    mk("systemd-journald.service", true, true, "журнал systemd"),
    mk("cron.service", true, true, "планировщик заданий"),
  ];
  if (server.group === "Databases") {
    list.push(mk("postgresql.service", true, true, "PostgreSQL 16 database server"));
    list.push(mk("pgbouncer.service", true, true, "лёгкий пулер соединений"));
  } else {
    list.push(mk("nginx.service", true, true, "веб-сервер / обратный прокси"));
    list.push(mk("app.service", true, true, "приложение (node runtime)"));
  }
  list.push(mk("docker.service", true, h % 3 !== 0, "контейнерный рантайм"));
  list.push(mk("fail2ban.service", true, true, "защита от подбора паролей"));
  list.push(mk("nfs-server.service", false, false, "NFS-сервер (не используется)"));
  return list;
}

export function genFiles(server: Server): FileNode[] {
  const dir = (name: string, perm = "drwxr-xr-x"): FileNode =>
    ({ name, type: "dir", size: 4096, perm, owner: "root", mtime: "12 мая 03:41" });
  const file = (name: string, size: number, perm = "-rw-r--r--", owner = "root", content?: string): FileNode =>
    ({ name, type: "file", size, perm, owner, mtime: "09 июн 14:02", content });

  const ntp = `# /etc/ntp.conf — синхронизация времени\ndriftfile /var/lib/ntp/ntp.drift\nserver 0.ru.pool.ntp.org iburst\nserver 1.ru.pool.ntp.org iburst\nrestrict default nomodify notrap nopeer noquery\nrestrict 127.0.0.1\n`;
  const hosts = `127.0.0.1   localhost\n::1         localhost ip6-localhost\n10.0.0.2    ops-core\n${server.ip}    ${server.name}\n`;
  const unit = `[Unit]\nDescription=KONTUR·OPS agent\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nExecStart=/usr/local/bin/kontur-agent --config /etc/kontur-agent/agent.toml\nRestart=always\nRestartSec=5\nUser=kontur\nLimitNOFILE=65536\n\n[Install]\nWantedBy=multi-user.target\n`;
  const toml = `[agent]\nlisten = ":8443"\ntoken_file = "/var/lib/kontur-agent/token"\ntls_cert = "/etc/kontur-agent/tls/cert.pem"\ntls_key  = "/etc/kontur-agent/tls/key.pem"\n\n[telemetry]\ninterval = "5s"\n\n[limits]\nexec_timeout = "30s"\nmax_output   = "1MiB"\n`;

  return [
    dir("bin"), dir("boot"), dir("dev"), dir("etc"), dir("home"), dir("opt"), dir("proc", "dr-xr-xr-x"),
    dir("root", "drwx------"), dir("run"), dir("srv"), dir("sys", "dr-xr-xr-x"), dir("tmp", "drwxrwxrwt"),
    dir("usr"), dir("var"),
    file("etc/hostname", 14, "-rw-r--r--", "root", `${server.name}\n`),
    file("etc/hosts", hosts.length, "-rw-r--r--", "root", hosts),
    file("etc/ntp.conf", ntp.length, "-rw-r--r--", "root", ntp),
    file("etc/kontur-agent/agent.toml", toml.length, "-rw-------", "kontur", toml),
    file("lib/systemd/system/kontur-agent.service", unit.length, "-rw-r--r--", "root", unit),
    file("var/log/syslog", 48_211_334, "-rw-r-----", "syslog"),
  ];
}

export const fmtBytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)} ГБ` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} МБ` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} КБ` : `${n} Б`;
