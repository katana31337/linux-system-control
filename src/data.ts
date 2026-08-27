// ─── Типы ────────────────────────────────────────────────────────────────────
export type ServerStatus = "online" | "warning" | "offline";

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
  agent: string;
  status: ServerStatus;
  uptimeDays: number;
  token: string;
  lastSeen: string;
  tags: string[];
  diskTotal: number;
  diskUsed: number;
  baseCpu: number;
  baseMem: number;
}

export interface Group { name: string; color: string; }

export interface User {
  id: string;
  login: string;
  name: string;
  role: "admin" | "operator" | "viewer";
  status: "active" | "disabled";
  lastLogin: string;
}

export interface AuditEvent {
  id: number;
  time: string;
  type: "auth" | "exec" | "agent" | "service" | "user" | "system";
  severity: "info" | "ok" | "warn" | "crit";
  text: string;
}

export interface Series { cpu: number[]; mem: number[]; netIn: number[]; netOut: number[]; }
export type MetricsMap = Record<string, Series>;

export const POINTS = 42;

// ─── Группы ─────────────────────────────────────────────────────────────────
export const GROUPS: Group[] = [
  { name: "Production", color: "#56c8e8" },
  { name: "Databases", color: "#3ecf8e" },
  { name: "CI/CD", color: "#ffb224" },
  { name: "Infra", color: "#c792ea" },
];

export const groupColor = (g: string) => GROUPS.find((x) => x.name === g)?.color ?? "#8595ad";

const tk = (a: string, b: string) => `${a}••••••••••••••••${b}`;

// ─── Флот агентов ───────────────────────────────────────────────────────────
export const SERVERS: Server[] = [
  { id: "s1", name: "web-frontend-01", ip: "10.0.1.11", port: 8443, group: "Production", os: "Ubuntu 22.04 LTS", kernel: "5.15.0-105-generic", arch: "x86_64", cores: 8, ramGb: 16, agent: "1.7.2", status: "online", uptimeDays: 42, token: tk("7f3a9c2e", "d41b"), lastSeen: "2 сек назад", tags: ["nginx", "edge"], diskTotal: 240, diskUsed: 96, baseCpu: 34, baseMem: 52 },
  { id: "s2", name: "web-frontend-02", ip: "10.0.1.12", port: 8443, group: "Production", os: "Ubuntu 22.04 LTS", kernel: "5.15.0-105-generic", arch: "x86_64", cores: 8, ramGb: 16, agent: "1.7.2", status: "online", uptimeDays: 42, token: tk("b18e44d0", "9f7c"), lastSeen: "4 сек назад", tags: ["nginx", "edge"], diskTotal: 240, diskUsed: 88, baseCpu: 29, baseMem: 47 },
  { id: "s3", name: "api-gateway-01", ip: "10.0.2.21", port: 8443, group: "Production", os: "Debian 12", kernel: "6.1.0-18-amd64", arch: "x86_64", cores: 16, ramGb: 32, agent: "1.7.2", status: "warning", uptimeDays: 17, token: tk("44d0b18e", "7c9f"), lastSeen: "1 сек назад", tags: ["node", "haproxy"], diskTotal: 480, diskUsed: 263, baseCpu: 78, baseMem: 69 },
  { id: "s4", name: "db-postgres-01", ip: "10.0.3.31", port: 8443, group: "Databases", os: "Debian 12", kernel: "6.1.0-18-amd64", arch: "x86_64", cores: 32, ramGb: 128, agent: "1.7.1", status: "online", uptimeDays: 96, token: tk("9c2e7f3a", "1bd4"), lastSeen: "3 сек назад", tags: ["postgres", "primary"], diskTotal: 2000, diskUsed: 1214, baseCpu: 41, baseMem: 81 },
  { id: "s5", name: "db-postgres-02", ip: "10.0.3.32", port: 8443, group: "Databases", os: "Debian 12", kernel: "6.1.0-18-amd64", arch: "x86_64", cores: 32, ramGb: 128, agent: "1.7.1", status: "online", uptimeDays: 96, token: tk("e44d0b18", "f7c9"), lastSeen: "5 сек назад", tags: ["postgres", "replica"], diskTotal: 2000, diskUsed: 1187, baseCpu: 22, baseMem: 64 },
  { id: "s6", name: "cache-redis-01", ip: "10.0.3.41", port: 8443, group: "Databases", os: "Ubuntu 22.04 LTS", kernel: "5.15.0-105-generic", arch: "x86_64", cores: 8, ramGb: 64, agent: "1.7.2", status: "online", uptimeDays: 61, token: tk("2e7f3a9c", "d41b"), lastSeen: "2 сек назад", tags: ["redis"], diskTotal: 120, diskUsed: 18, baseCpu: 12, baseMem: 58 },
  { id: "s7", name: "queue-rabbit-01", ip: "10.0.3.42", port: 8443, group: "Databases", os: "Ubuntu 22.04 LTS", kernel: "5.15.0-105-generic", arch: "x86_64", cores: 8, ramGb: 32, agent: "1.7.0", status: "online", uptimeDays: 35, token: tk("c2e7f3a9", "41bd"), lastSeen: "7 сек назад", tags: ["rabbitmq"], diskTotal: 240, diskUsed: 71, baseCpu: 18, baseMem: 44 },
  { id: "s8", name: "build-runner-01", ip: "10.0.4.51", port: 8443, group: "CI/CD", os: "Ubuntu 24.04 LTS", kernel: "6.8.0-31-generic", arch: "x86_64", cores: 16, ramGb: 32, agent: "1.7.2", status: "offline", uptimeDays: 0, token: tk("f3a9c2e7", "bd41"), lastSeen: "2 ч назад", tags: ["docker", "runner"], diskTotal: 960, diskUsed: 604, baseCpu: 0, baseMem: 0 },
  { id: "s9", name: "monitoring-01", ip: "10.0.5.61", port: 8443, group: "Infra", os: "Debian 12", kernel: "6.1.0-18-amd64", arch: "x86_64", cores: 8, ramGb: 32, agent: "1.7.2", status: "online", uptimeDays: 120, token: tk("3a9c2e7f", "1bd4"), lastSeen: "1 сек назад", tags: ["prometheus", "grafana"], diskTotal: 480, diskUsed: 302, baseCpu: 26, baseMem: 55 },
  { id: "s10", name: "backup-nfs-01", ip: "10.0.5.62", port: 8443, group: "Infra", os: "Debian 12", kernel: "6.1.0-18-amd64", arch: "x86_64", cores: 4, ramGb: 16, agent: "1.6.9", status: "warning", uptimeDays: 210, token: tk("a9c2e7f3", "bd41"), lastSeen: "12 сек назад", tags: ["nfs", "backup"], diskTotal: 8000, diskUsed: 7280, baseCpu: 8, baseMem: 30 },
];

// ─── Пользователи ───────────────────────────────────────────────────────────
export const USERS: User[] = [
  { id: "u1", login: "admin", name: "Артём Соколов", role: "admin", status: "active", lastLogin: "сегодня, 09:12" },
  { id: "u2", login: "operator", name: "Дана Крылова", role: "operator", status: "active", lastLogin: "сегодня, 08:47" },
  { id: "u3", login: "devops", name: "Игорь Ветров", role: "operator", status: "active", lastLogin: "вчера, 21:03" },
  { id: "u4", login: "auditor", name: "Мария Лапина", role: "viewer", status: "disabled", lastLogin: "12 фев, 14:20" },
];

export const ROLE_META: Record<User["role"], { label: string; color: string }> = {
  admin: { label: "Администратор", color: "#ffb224" },
  operator: { label: "Оператор", color: "#56c8e8" },
  viewer: { label: "Наблюдатель", color: "#8595ad" },
};

// ─── Аудит ──────────────────────────────────────────────────────────────────
let evId = 100;
const ev = (time: string, type: AuditEvent["type"], severity: AuditEvent["severity"], text: string): AuditEvent =>
  ({ id: evId++, time, type, severity, text });

export const INITIAL_EVENTS: AuditEvent[] = [
  ev("09:41:07", "agent", "warn", "backup-nfs-01: использование диска 91% — порог 90% превышен"),
  ev("09:40:52", "exec", "info", "operator → api-gateway-01: systemctl restart haproxy"),
  ev("09:39:18", "agent", "ok", "db-postgres-02: репликация догнала primary (lag 0.2 c)"),
  ev("09:37:44", "auth", "info", "успешный вход: admin (10.0.0.7)"),
  ev("09:35:12", "agent", "warn", "api-gateway-01: CPU 82% держится выше 75% более 10 мин"),
  ev("09:33:05", "service", "ok", "web-frontend-01: nginx перезагружен, 0 ошибок конфигурации"),
  ev("09:31:40", "agent", "crit", "build-runner-01: агент не отвечает 2 ч — 3 пропущенных heartbeat"),
  ev("09:28:27", "user", "info", "создан API-ключ для CI (scope: telemetry:read)"),
  ev("09:24:11", "exec", "info", "devops → db-postgres-01: pg_stat_activity — 43 активных сессии"),
  ev("09:21:36", "system", "ok", "ротация журналов аудита завершена (1.2 МБ → архив)"),
  ev("09:18:02", "agent", "ok", "cache-redis-01: RDB-снимок сохранён (412 МБ, 1.8 c)"),
  ev("09:12:45", "auth", "warn", "отклонён токен с неизвестного адреса 185.14.90.3 (подпись не совпала)"),
];

export const LIVE_EVENT_POOL: ((s: Server) => Omit<AuditEvent, "id" | "time">)[] = [
  (s) => ({ type: "agent", severity: "ok", text: `${s.name}: heartbeat OK, задержка 18 мс` }),
  (s) => ({ type: "agent", severity: "info", text: `${s.name}: телеметрия доставлена (cpu/mem/net/disk)` }),
  (s) => ({ type: "exec", severity: "info", text: `operator → ${s.name}: tail -n 50 /var/log/syslog` }),
  (s) => ({ type: "service", severity: "ok", text: `${s.name}: kontur-agent v${s.agent} — самопроверка пройдена` }),
  (s) => ({ type: "system", severity: "info", text: `${s.name}: снимок метрик записан в timescale (batch 64)` }),
  (s) => ({ type: "agent", severity: "warn", text: `${s.name}: высокая задержка диска (await 38 мс)` }),
];

// ─── Телеметрия ─────────────────────────────────────────────────────────────
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function walk(prev: number, base: number, spread: number, lo = 1, hi = 99): number {
  if (base <= 0) return 0;
  return clamp(prev + rnd(-spread, spread) + (base - prev) * 0.18, lo, hi);
}

function seedSeries(s: Server): Series {
  const cpu: number[] = []; const mem: number[] = []; const netIn: number[] = []; const netOut: number[] = [];
  let c = s.baseCpu, m = s.baseMem;
  for (let i = 0; i < POINTS; i++) {
    c = walk(c, s.baseCpu, 6); m = walk(m, s.baseMem, 3);
    cpu.push(c); mem.push(m);
    netIn.push(s.status === "offline" ? 0 : rnd(4, 30) + c * 0.6);
    netOut.push(s.status === "offline" ? 0 : rnd(2, 18) + c * 0.35);
  }
  return { cpu, mem, netIn, netOut };
}

export function seedMetrics(servers: Server[]): MetricsMap {
  const m: MetricsMap = {};
  servers.forEach((s) => {
    m[s.id] = s.status === "offline"
      ? { cpu: Array(POINTS).fill(0), mem: Array(POINTS).fill(0), netIn: Array(POINTS).fill(0), netOut: Array(POINTS).fill(0) }
      : seedSeries(s);
  });
  return m;
}

export function stepMetrics(prev: MetricsMap, servers: Server[]): MetricsMap {
  const next: MetricsMap = {};
  for (const s of servers) {
    const p = prev[s.id];
    if (!p || s.status === "offline") { next[s.id] = p ?? { cpu: [], mem: [], netIn: [], netOut: [] }; continue; }
    const push = (arr: number[], base: number, spread: number) => [...arr.slice(1), walk(arr[arr.length - 1] ?? base, base, spread)];
    next[s.id] = {
      cpu: push(p.cpu, s.baseCpu, 6),
      mem: push(p.mem, s.baseMem, 2.4),
      netIn: [...p.netIn.slice(1), clamp(rnd(4, 30) + s.baseCpu * 0.6 + rnd(-6, 6), 0, 120)],
      netOut: [...p.netOut.slice(1), clamp(rnd(2, 18) + s.baseCpu * 0.35 + rnd(-4, 4), 0, 90)],
    };
  }
  return next;
}

export const last = (a: number[]) => a[a.length - 1] ?? 0;
export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// ─── Процессы и сервисы (генераторы) ────────────────────────────────────────
export interface Proc { pid: number; user: string; cpu: number; mem: number; vsz: string; rss: string; cmd: string; }

const PROC_BASE: [string, string][] = [
  ["root", "/sbin/init"],
  ["root", "[kthreadd]"],
  ["root", "/usr/sbin/sshd -D"],
  ["root", "/usr/sbin/cron -f"],
  ["root", "/lib/systemd/systemd-journald"],
  ["syslog", "/usr/sbin/rsyslogd -n"],
  ["kontur", "/opt/kontur/agent --config /etc/kontur/agent.toml"],
  ["kontur", "node_exporter --web.listen-address=127.0.0.1:9100"],
];

const PROC_ROLE: Record<string, [string, string][]> = {
  nginx: [["root", "nginx: master process /usr/sbin/nginx -g daemon on;"], ["www-data", "nginx: worker process"], ["www-data", "nginx: worker process"]],
  node: [["app", "node /srv/gateway/dist/main.js"], ["app", "node /srv/gateway/dist/worker.js"], ["root", "/usr/sbin/haproxy -f /etc/haproxy/haproxy.cfg"]],
  postgres: [["postgres", "/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main"], ["postgres", "postgres: checkpointer"], ["postgres", "postgres: walwriter"], ["postgres", "postgres: autovacuum launcher"], ["postgres", "postgres: logical replication worker"]],
  redis: [["redis", "/usr/bin/redis-server *:6379"], ["redis", "redis:bio_close_file"]],
  rabbitmq: [["rabbitmq", "/usr/lib/erlang/erts-14.2/bin/beam.smp -Bdh -- -root /usr/lib/rabbitmq"], ["rabbitmq", "epmd -daemon"]],
  docker: [["root", "/usr/bin/dockerd -H fd://"], ["root", "containerd --config /etc/containerd/config.toml"], ["root", "gitlab-runner run --working-directory /home/gitlab-runner"]],
  prometheus: [["prom", "/opt/prometheus/prometheus --config.file=/etc/prometheus/prometheus.yml"], ["grafana", "/usr/share/grafana/bin/grafana server --homepath=/usr/share/grafana"]],
  nfs: [["root", "[nfsd]"], ["root", "/usr/sbin/rpc.mountd"]],
};

export function genProcesses(s: Server): Proc[] {
  const roleKey = s.tags[0];
  const rows: [string, string][] = [...PROC_BASE, ...(PROC_ROLE[roleKey] ?? [])];
  let pid = 1;
  return rows.map(([user, cmd], i) => {
    pid += i === 0 ? 0 : Math.floor(rnd(40, 900));
    const heavy = s.tags.includes("postgres") && cmd.includes("postgres -D");
    return {
      pid,
      user,
      cpu: +(rnd(0, heavy ? 34 : 6)).toFixed(1),
      mem: +(rnd(0.1, heavy ? 42 : 8)).toFixed(1),
      vsz: `${Math.floor(rnd(12, 900))}k`,
      rss: `${Math.floor(rnd(2, heavy ? 4_200_000 : 180_000))}k`,
      cmd,
    };
  }).sort((a, b) => b.cpu - a.cpu);
}

export interface Svc { unit: string; desc: string; active: boolean; enabled: boolean; }

const SVC_BASE: [string, string][] = [
  ["kontur-agent.service", "KONTUR OPS agent"],
  ["sshd.service", "OpenBSD Secure Shell server"],
  ["cron.service", "Regular background program processing daemon"],
  ["systemd-timesyncd.service", "Network Time Synchronization"],
  ["ufw.service", "Uncomplicated firewall"],
];

const SVC_ROLE: Record<string, [string, string][]> = {
  nginx: [["nginx.service", "A high performance web server"], ["php8.1-fpm.service", "The PHP FastCGI Process Manager"]],
  node: [["haproxy.service", "Fast and reliable load balancing reverse proxy"], ["gateway-api.service", "Internal API gateway (systemd unit)"]],
  postgres: [["postgresql.service", "PostgreSQL RDBMS"], ["pgbackrest.service", "Backup/restore service"]],
  redis: [["redis-server.service", "Advanced key-value store"]],
  rabbitmq: [["rabbitmq-server.service", "RabbitMQ messaging server"]],
  docker: [["docker.service", "Docker Application Container Engine"], ["containerd.service", "containerd container runtime"], ["gitlab-runner.service", "GitLab Runner"]],
  prometheus: [["prometheus.service", "Monitoring system and time series database"], ["grafana-server.service", "Grafana instance"]],
  nfs: [["nfs-server.service", "NFS server and services"], ["rpcbind.service", "RPC bind portmap service"]],
};

export function genServices(s: Server): Svc[] {
  const roleKey = s.tags[0];
  return [...SVC_BASE, ...(SVC_ROLE[roleKey] ?? [])].map(([unit, desc], i) => ({
    unit, desc, active: !(i === SVC_BASE.length - 1 && s.id === "s10"), enabled: true,
  }));
}

// ─── Утилиты ────────────────────────────────────────────────────────────────
export const nowTime = () => new Date().toLocaleTimeString("ru-RU", { hour12: false });

export const fmtUptime = (d: number) => {
  if (d <= 0) return "—";
  if (d < 1) return `${Math.round(d * 24)} ч`;
  return `${Math.floor(d)} д ${Math.round((d % 1) * 24)} ч`;
};

export const STATUS_META: Record<ServerStatus, { label: string; color: string }> = {
  online: { label: "онлайн", color: "#3ecf8e" },
  warning: { label: "нагрузка", color: "#ffb224" },
  offline: { label: "офлайн", color: "#f0566a" },
};
