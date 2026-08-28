import { useEffect, useRef, useState, type ReactNode } from "react";
import { CopyBtn, Icon, SectionHead, type IconName } from "./ui";

// ─── сниппеты ───────────────────────────────────────────────────────────────
const GO_CODE = `package main

import (
    "crypto/rand"
    "crypto/subtle"
    "encoding/hex"
    "encoding/json"
    "log"
    "net/http"
    "os/exec"
)

// Токен генерируется ОДИН раз при установке и печатается в stdout —
// дальше его можно только ротировать. Хранится в /var/lib/kontur-agent/token (0600).
var token = mustGen()

func mustGen() string {
    b := make([]byte, 32)              // crypto/rand, 256 бит энтропии
    if _, err := rand.Read(b); err != nil {
        log.Fatal(err)
    }
    t := hex.EncodeToString(b)
    log.Println("INSTALL TOKEN:", t)   // показывается оператору один раз
    return t
}

// Каждый запрос обязан нести заголовок X-Agent-Token.
// Сравниваем в constant time, чтобы не ловили тайминги.
func auth(h http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        got := r.Header.Get("X-Agent-Token")
        if subtle.ConstantTimeCompare([]byte(got), []byte(token)) != 1 {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }
        h(w, r)
    }
}

func metrics(w http.ResponseWriter, _ *http.Request) {
    json.NewEncoder(w).Encode(collect()) // cpu/ram/disk/net из /proc и /sys
}

func run(w http.ResponseWriter, r *http.Request) {
    var req struct{ Cmd string \`json:"cmd"\` }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "bad request", 400); return
    }
    out, err := exec.Command("bash", "-c", req.Cmd).CombinedOutput()
    if err != nil { w.WriteHeader(http.StatusInternalServerError) }
    w.Write(out)
}

func main() {
    http.HandleFunc("/v1/health",  auth(health))
    http.HandleFunc("/v1/metrics", auth(metrics))
    http.HandleFunc("/v1/exec",    auth(run))   // команды — только с токеном
    log.Fatal(http.ListenAndServeTLS(":8443", "cert.pem", "key.pem"))
}`;

const NODE_CODE = `// kontur-core (Node.js): реестр агентов + relay команд
import Fastify from "fastify";
import crypto from "node:crypto";
import { db } from "./db.js";        // PostgreSQL: users, agents, audit
import { vault } from "./vault.js";  // токены агентов в зашифрованном виде

const app = Fastify({ logger: true });
const SALT = process.env.TOKEN_SALT;

// Оператор добавляет агента: ip + порт + install-токен из вывода установки.
// Консоль сначала проверяет токен рукопожатием с самим агентом.
app.post("/api/agents", { preHandler: app.auth("admin") }, async (req) => {
  const { ip, port, token, group } = req.body;

  const probe = await fetch(\`https://\${ip}:\${port}/v1/health\`, {
    headers: { "X-Agent-Token": token },
  });
  if (!probe.ok) throw app.httpErrors.unauthorized("агент отклонил токен");

  const meta  = await probe.json();                     // имя, ОС, версии
  const hash  = crypto.createHash("sha256")
                  .update(SALT + token).digest("hex");  // в БД — только хэш
  const agent = await db.agents.insert({ ip, port, group, ...meta, tokenHash: hash });
  await vault.store(agent.id, token);                   // для exec relay
  return agent;
});

// Команда на агенте от имени оператора: проверка роли + аудит + relay.
app.post("/api/agents/:id/exec", { preHandler: app.auth("operator") }, async (req) => {
  const agent = await db.agents.get(req.params.id);
  const token = await vault.decrypt(agent.id);

  const res = await fetch(\`https://\${agent.ip}:\${agent.port}/v1/exec\`, {
    method: "POST",
    headers: { "X-Agent-Token": token },
    body: JSON.stringify({ cmd: req.body.cmd, timeout_sec: 30 }),
  });

  await db.audit.insert({              // append-only, до ответа клиенту
    user: req.user.login, agent: agent.id, cmd: req.body.cmd,
  });
  return res.text();
});

app.listen({ port: 8443, host: "0.0.0.0" });`;

const SYSTEMD_AGENT = `[Unit]
Description=KONTUR·OPS agent
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/kontur-agent --config /etc/kontur-agent/agent.toml
Restart=always
RestartSec=5
User=kontur
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target`;

const SYSTEMD_CORE = `[Unit]
Description=KONTUR·OPS core console
After=network-online.target postgresql.service

[Service]
WorkingDirectory=/opt/kontur-core
ExecStart=/usr/bin/node server.js
Restart=always
EnvironmentFile=/etc/kontur-core/core.env
User=kontur

[Install]
WantedBy=multi-user.target`;

const AGENT_TOML = `# /etc/kontur-agent/agent.toml
[agent]
listen     = ":8443"                        # HTTPS-API агента
token_file = "/var/lib/kontur-agent/token"  # install-токен (chmod 600)
tls_cert   = "/etc/kontur-agent/tls/cert.pem"
tls_key    = "/etc/kontur-agent/tls/key.pem"

[telemetry]
interval = "5s"          # период отправки метрик
push_url = ""            # опц.: wss://core:8443/agent/stream (обратный туннель за NAT)

[limits]
exec_timeout = "30s"     # таймаут одной команды
max_output   = "1MiB"    # потолок вывода exec
pty_max      = 4         # одновременных PTY-сессий

[fs]
browse_root = "/"        # корень файлового браузера
deny        = ["/proc/kcore", "/dev/mem"]`;

const COMPOSE = `# docker-compose.yml — консоль (агенты ставятся бинарём на хосты)
services:
  kontur-core:
    image: kontur/core:2.4.1
    ports: ["8443:8443"]
    environment:
      DATABASE_URL: postgres://kontur:secret@db:5432/kontur
      TOKEN_SALT: \${TOKEN_SALT}
      JWT_SECRET: \${JWT_SECRET}
    depends_on: [db]
    volumes: [./tls:/etc/kontur-core/tls:ro]

  db:
    image: timescale/timescaledb-ha:pg16
    environment:
      POSTGRES_USER: kontur
      POSTGRES_PASSWORD: secret
    volumes: [pg:/home/postgres/pgdata]

volumes: { pg: {} }`;

const INSTALL_CORE = `# 1. зависимости
sudo apt install -y nodejs npm postgresql

# 2. код консоли
git clone https://ops.local/kontur-core /opt/kontur-core
cd /opt/kontur-core && npm ci --omit=dev

# 3. база и миграции
sudo -u postgres createuser kontur && sudo -u postgres createdb -O kontur kontur
DATABASE_URL=postgres://kontur@localhost/kontur npm run migrate

# 4. самоподписанный TLS (или используйте certbot для реального домена)
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \\
  -keyout tls/key.pem -out tls/cert.pem -subj "/CN=ops.local"

# 5. переменные окружения
cat > /etc/kontur-core/core.env <<EOF
DATABASE_URL=postgres://kontur@localhost/kontur
TOKEN_SALT=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
LISTEN_ADDR=0.0.0.0:8443
EOF

# 6. запуск
sudo cp deploy/kontur-core.service /etc/systemd/system/
sudo systemctl enable --now kontur-core`;

const INSTALL_AGENT = `# установка одной командой (Debian/Ubuntu/RHEL/Arch)
curl -fsSL https://ops.local/install.sh | bash -s -- \\
  --console 10.0.0.2:8443 \\
  --group Production

# что делает скрипт:
#  · скачивает статический бинарь kontur-agent (Go) в /usr/local/bin
#  · создаёт пользователя kontur и каталог /etc/kontur-agent
#  · генерирует самоподписанный TLS-сертификат агента
#  · генерирует INSTALL TOKEN (crypto/rand, 32 байта) и печатает его
#  · ставит и запускает systemd-юнит kontur-agent.service

# ручная проверка
sudo systemctl status kontur-agent
kontur-agent status          # покажет INSTALL TOKEN
sudo ufw allow 8443/tcp      # открыть порт агента`;

const ROTATE = `# плановая ротация токена агента
kontur-agent rotate-token
#  → старый токен перестаёт приниматься мгновенно
#  → новый печатается в stdout
#  → в консоли: Агенты → узел → «ротировать токен» → вставить новый`;

// ─── структура документа ────────────────────────────────────────────────────
const TOC: { id: string; n: string; title: string }[] = [
  { id: "intro", n: "01", title: "О системе" },
  { id: "arch", n: "02", title: "Архитектура" },
  { id: "security", n: "03", title: "Модель безопасности" },
  { id: "install-core", n: "04", title: "Установка консоли" },
  { id: "install-agent", n: "05", title: "Установка агента" },
  { id: "connect", n: "06", title: "Подключение и токен" },
  { id: "config", n: "07", title: "Конфигурация" },
  { id: "api", n: "08", title: "Справочник API" },
  { id: "docker", n: "09", title: "Docker-развёртывание" },
  { id: "rbac", n: "10", title: "Пользователи и роли" },
  { id: "trouble", n: "11", title: "Устранение проблем" },
  { id: "source", n: "12", title: "Исходники для старта" },
];

function Code({ name, lang, code }: { name: string; lang: string; code: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-line bg-panel">
        <span className="w-2 h-2 rounded-full bg-bad/70" /><span className="w-2 h-2 rounded-full bg-amber/70" /><span className="w-2 h-2 rounded-full bg-ok/70" />
        <span className="ml-1 font-mono text-[11.5px] text-mut">{name}</span>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-line text-dim">{lang}</span>
        <div className="ml-auto"><CopyBtn text={code} label="копировать" /></div>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[11.8px] leading-[1.6] text-ink/85 max-h-[430px]">{code}</pre>
    </div>
  );
}

function FlowBox({ title, sub, items, color, icon }: { title: string; sub: string; items: string[]; color: string; icon: IconName }) {
  return (
    <div className="card p-4 flex-1 min-w-[210px]" style={{ borderColor: color + "44" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="p-1.5 rounded-md" style={{ color, background: color + "14", border: `1px solid ${color}44` }}><Icon n={icon} size={15} /></span>
        <div>
          <div className="font-display font-bold text-[13.5px] tracking-wide">{title}</div>
          <div className="font-mono text-[10.5px] text-dim">{sub}</div>
        </div>
      </div>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i} className="flex items-center gap-2 font-mono text-[11.5px] text-mut">
            <span className="w-1 h-1 rounded-full" style={{ background: color }} />{i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 self-stretch py-3">
      <svg width="86" height="22" viewBox="0 0 86 22" className="hidden md:block">
        <line x1="2" y1="8" x2="74" y2="8" stroke="#ffb224" strokeWidth="1.6" className="dashline" />
        <path d="M74 3l9 5-9 5" fill="none" stroke="#ffb224" strokeWidth="1.6" />
        <line x1="12" y1="16" x2="84" y2="16" stroke="#3ecf8e" strokeWidth="1.6" className="dashline" />
        <path d="M12 11l-9 5 9 5" fill="none" stroke="#3ecf8e" strokeWidth="1.6" />
      </svg>
      <span className="font-mono text-[9.5px] text-dim text-center leading-tight mt-1 max-w-[92px]">{label}</span>
    </div>
  );
}

function DocSection({ id, n, title, children }: { id: string; n: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 anim-rise">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[12px] font-bold text-bg bg-amber rounded-md px-2 py-0.5">{n}</span>
        <h3 className="font-display font-bold text-lg tracking-wide">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EnvTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left lbl border-b border-line bg-panel/60">
            <th className="px-4 py-2.5 font-medium">Переменная</th>
            <th className="px-3 py-2.5 font-medium">Описание</th>
            <th className="px-3 py-2.5 font-medium hidden md:table-cell">По умолчанию</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, d, def]) => (
            <tr key={k} className="border-b border-line/50 last:border-0 hover:bg-raise/40 transition-colors">
              <td className="px-4 py-2.5 font-mono text-[11.5px] text-amber whitespace-nowrap">{k}</td>
              <td className="px-3 py-2.5 text-mut">{d}</td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-dim hidden md:table-cell">{def}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const API_AGENT: [string, string, string][] = [
  ["GET", "/v1/health", "доступность, версия агента, hostname — проверка токена при подключении"],
  ["GET", "/v1/metrics", "снимок cpu / ram / disk / net / load (из /proc, без внешних зависимостей)"],
  ["WS", "/v1/stream", "стрим телеметрии в консоль каждые N секунд"],
  ["POST", "/v1/exec", "выполнить команду (bash -c) с таймаутом; ответ — combined output"],
  ["WS", "/v1/pty", "интерактивный PTY для веб-терминала (вместо прямого SSH)"],
  ["GET", "/v1/files?path=", "листинг каталога · GET /v1/file?path= — скачивание"],
  ["POST", "/v1/service", "start / stop / restart systemd-юнита"],
  ["POST", "/v1/token/rotate", "ротация install-токена (только с текущим токеном)"],
];

const API_CORE: [string, string, string][] = [
  ["POST", "/api/auth/login", "сессия оператора: PBKDF2/argon2id, JWT 12 ч, опц. 2FA"],
  ["GET / POST", "/api/agents", "реестр: добавление требует ip + порт + install-токен и рукопожатие"],
  ["POST", "/api/agents/:id/exec", "relay команды на агент (роль operator+), запись в аудит"],
  ["WS", "/ws/terminal/:id", "интерактивный bash в браузере, PTY через агент"],
  ["GET", "/api/metrics/:id", "история из TimescaleDB: range, step, агрегаты"],
  ["GET / POST", "/api/users", "пользователи и роли (только admin)"],
  ["GET", "/api/audit", "журнал действий, экспорт CSV, append-only"],
];

const TROUBLE: [string, string, string][] = [
  ["401 Unauthorized при подключении", "токен не совпадает: опечатка, лишние пробелы или токен уже ротирован", "перепроверьте вывод kontur-agent status; при ротации вставьте новый токен"],
  ["connection refused / таймаут", "агент не запущен или порт закрыт файрволом", "systemctl status kontur-agent · sudo ufw allow 8443/tcp"],
  ["TLS handshake error", "сертификат агента истёк или не совпадает закреплённый пин", "перевыпустите сертификат и обновите пин в карточке узла"],
  ["агент онлайн, но метрик нет", "collector не может читать /proc (seccomp/контейнер без прав)", "запускайте агента с --host-pid или добавьтеCAP_SYS_PTRACE"],
  ["команда висит и отваливается", "достигнут exec_timeout (по умолчанию 30 с)", "поднимите [limits] exec_timeout или разбейте команду"],
  ["веб-терминал закрывается (1008)", "истекла сессия оператора или PTY-лимит агента", "перелогиньтесь; проверьте [limits] pty_max"],
  ["диск показывает >100%", "df учитывает резерв ext4 (5%)", "норма; порог алерта считайте от доступных блоков"],
  ["консоль не видит агента за NAT", "агент недоступен снаружи для входящих запросов", "включите [telemetry] push_url — обратный WSS-туннель"],
];

const RBAC_ROWS: [string, boolean, boolean, boolean][] = [
  ["Метрики и статусы агентов", true, true, true],
  ["Просмотр процессов, сервисов, файлов", true, true, true],
  ["Терминал и команды (exec)", true, true, false],
  ["Управление сервисами (start/stop)", true, true, false],
  ["Подключение и удаление агентов", true, false, false],
  ["Пользователи, роли, настройки", true, false, false],
  ["Журнал аудита", true, true, false],
];

export default function Docs() {
  const [active, setActive] = useState("intro");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    TOC.forEach((t) => { const el = document.getElementById(t.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="max-w-6xl">
      <SectionHead title="Документация" sub="Полное руководство: установка консоли и агентов, протокол, конфигурация, безопасность, траблшутинг" />

      <div className="flex gap-8" ref={wrapRef}>
        {/* оглавление */}
        <aside className="hidden lg:block w-[210px] shrink-0">
          <div className="sticky top-[86px] space-y-0.5 border-l border-line pl-4">
            {TOC.map((t) => (
              <button key={t.id} onClick={() => go(t.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] font-mono transition-colors cursor-pointer flex items-center gap-2 ${
                  active === t.id ? "text-amber bg-amber/8 -ml-px border-l-2 border-amber" : "text-mut hover:text-ink"}`}>
                <span className="text-[10px] text-dim w-4">{t.n}</span>{t.title}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-12 pb-10">
          {/* 01 */}
          <DocSection id="intro" n="01" title="О системе">
            <div className="card p-5 space-y-3.5">
              <p className="text-[13.5px] text-ink/85 leading-relaxed">
                <span className="text-amber font-semibold">KONTUR·OPS</span> — центр управления парком Linux-серверов: лёгкая альтернатива
                MeshCentral для инфраструктурных команд. Состоит из двух частей:
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="border border-line rounded-lg p-3.5">
                  <div className="font-mono text-[12px] text-ok mb-1.5 flex items-center gap-2"><Icon n="box" size={13} /> kontur-agent (Go)</div>
                  <p className="text-[12px] text-mut leading-relaxed">Один статический бинарь без зависимостей. Ставится на каждый сервер, слушает HTTPS-API,
                  отдаёт метрики из /proc, исполняет команды, держит PTY и файловый браузер. Доступ — только по install-токену.</p>
                </div>
                <div className="border border-line rounded-lg p-3.5">
                  <div className="font-mono text-[12px] text-amber mb-1.5 flex items-center gap-2"><Icon n="server" size={13} /> kontur-core (Node.js)</div>
                  <p className="text-[12px] text-mut leading-relaxed">Веб-консоль: реестр агентов, группы, дашборды, веб-терминал, RBAC и аудит.
                  Хранит данные в PostgreSQL (метрики — TimescaleDB), токены — только в зашифрованном vault.</p>
                </div>
              </div>
              <div className="flex gap-2.5 items-start border-t border-line pt-3.5">
                <span className="text-info mt-0.5"><Icon n="book" size={15} /></span>
                <p className="text-[12px] text-mut leading-relaxed">
                  <span className="text-ink font-medium">Про эту веб-сборку:</span> интерфейс полностью рабочий, а роль живых агентов играет встроенный
                  симулятор протокола — подключённые узлы отвечают по реальному контракту API (рукопожатие, телеметрия, exec, PTY).
                  Для боевой эксплуатации разверните kontur-core и агенты по разделам 04–05: протокол идентичен.
                </p>
              </div>
            </div>
          </DocSection>

          {/* 02 */}
          <DocSection id="arch" n="02" title="Архитектура">
            <div className="card p-5">
              <div className="flex flex-col md:flex-row items-stretch gap-2">
                <FlowBox title="Агенты · Go" sub="10.0.x.x : 8443" color="#3ecf8e" icon="box"
                  items={["один статический бинарь", "токен: crypto/rand 32B", "HTTPS-сервер + WSS", "метрики из /proc", "PTY для терминала"]} />
                <Arrow label="запросы и команды с X-Agent-Token" />
                <FlowBox title="kontur-core · Node.js" sub="консоль : 8443" color="#ffb224" icon="server"
                  items={["REST API + WebSocket", "реестр агентов и групп", "RBAC: 3 роли", "exec/PTY relay", "аудит всех действий"]} />
                <Arrow label="SQL: пользователи, агенты, аудит" />
                <FlowBox title="Хранилища" sub="PostgreSQL 16" color="#56c8e8" icon="db"
                  items={["users / agents / audit", "TimescaleDB — метрики", "vault — токены (AES-GCM)", "хэши: SHA-256(соль+токен)"]} />
              </div>
              <p className="mt-4 text-[12.5px] text-mut leading-relaxed border-t border-line pt-4">
                <span className="text-amber font-semibold">Транспорт:</span> базовый вариант — консоль сама обращается к HTTPS-API агента по ip:порту из реестра.
                Если серверы за NAT, включите <span className="text-ok">обратный WS-туннель</span> (<code className="font-mono text-info">[telemetry] push_url</code>):
                агент при старте сам устанавливает постоянное WSS-соединение с консолью, команды идут по нему. Токен обязателен в обоих направлениях.
              </p>
              <div className="mt-4 border-t border-line pt-4">
                <div className="lbl mb-3">Микросервисная декомпозиция (для роста)</div>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
                  {([
                    ["gateway", "единая точка входа: TLS, маршрутизация /api и /ws, rate-limit", "#ffb224"],
                    ["auth-svc", "пользователи, сессии, роли, 2FA, ключи API", "#56c8e8"],
                    ["collector", "приём телеметрии в TimescaleDB, агрегаты, пороги алертов", "#3ecf8e"],
                    ["exec-relay", "команды и PTY: роль → агент → аудит; таймауты", "#f0566a"],
                    ["file-relay", "листинг, просмотр и скачивание файлов через агент", "#c792ea"],
                    ["notifier", "Telegram / webhook-уведомления о критичных событиях", "#8595ad"],
                  ] as [string, string, string][]).map(([n, d, c]) => (
                    <div key={n} className="flex gap-3">
                      <span className="font-mono text-[11px] font-bold px-2 py-1 rounded-md h-fit whitespace-nowrap" style={{ color: c, background: c + "12", border: `1px solid ${c}38` }}>{n}</span>
                      <p className="text-[12px] text-mut leading-relaxed pt-0.5">{d}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-mut leading-relaxed mt-4">
                  Начните с <span className="text-amber">модульного монолита</span>: те же шесть модулей отдельными каталогами с чистыми интерфейсами.
                  При росте они выносятся в процессы без переписывания, шиной событий служит NATS или Redis Streams.
                  Границы модулей совпадают с REST/WS API — это и есть лёгкое расширение функционала.
                </p>
              </div>
            </div>
          </DocSection>

          {/* 03 */}
          <DocSection id="security" n="03" title="Модель безопасности">
            <div className="grid sm:grid-cols-2 gap-3.5">
              {([
                ["key", "Install-токен", "32 байта crypto/rand при установке, печатается один раз. Агент сравнивает в constant time. Ротация — kontur-agent rotate-token, старый ключ умирает мгновенно.", "#ffb224"],
                ["lock", "Хранение в консоли", "В БД — только SHA-256(соль + токен) для проверки; рабочий ключ — в vault (AES-256-GCM) для exec relay. Утечка БД не даёт управления агентами.", "#56c8e8"],
                ["shield", "TLS и mTLS", "Самоподписанный сертификат агента с закреплённым отпечатком (pin) либо внутренний CA. Опционально mTLS: у каждого агента клиентский сертификат.", "#3ecf8e"],
                ["users", "RBAC + аудит", "admin / operator / viewer. Каждая команда — append-only запись с пользователем, временем и выводом. Неудачные входы тоже журналируются.", "#c792ea"],
              ] as [IconName, string, string, string][]).map(([ic, t, d, c], i) => (
                <div key={t} className="card card-h p-4 anim-rise" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="p-1.5 rounded-md" style={{ color: c, background: c + "14", border: `1px solid ${c}40` }}><Icon n={ic} size={15} /></span>
                    <span className="font-display font-semibold text-[14px]">{t}</span>
                  </div>
                  <p className="text-[12.5px] text-mut leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </DocSection>

          {/* 04 */}
          <DocSection id="install-core" n="04" title="Установка консоли (Node.js)">
            <div className="space-y-3.5">
              <p className="text-[12.5px] text-mut leading-relaxed">
                Требования: <span className="font-mono text-ink">Node.js ≥ 20</span>, <span className="font-mono text-ink">PostgreSQL ≥ 15</span>
                (с расширением timescaledb для метрик), Linux-хост или Docker.
              </p>
              <Code name="bash — установка на хост" lang="shell" code={INSTALL_CORE} />
              <div>
                <div className="lbl mb-2">Переменные окружения kontur-core</div>
                <EnvTable rows={[
                  ["DATABASE_URL", "строка подключения PostgreSQL", "—"],
                  ["TOKEN_SALT", "соль для хэшей токенов агентов (openssl rand -hex 32)", "—"],
                  ["JWT_SECRET", "секрет подписи сессий операторов", "—"],
                  ["LISTEN_ADDR", "адрес и порт веб-интерфейса", "0.0.0.0:8443"],
                  ["TLS_CERT / TLS_KEY", "пути к сертификату консоли", "tls/cert.pem"],
                  ["SESSION_TTL", "время жизни сессии", "12h"],
                  ["AUDIT_RETENTION", "хранение журнала аудита", "30d"],
                  ["AGENT_TLS_VERIFY", "проверка сертификатов агентов (strict | pin | off)", "pin"],
                ]} />
              </div>
              <p className="text-[12px] text-mut leading-relaxed">
                При первом запуске консоль покажет экран первичной настройки — создаётся первый администратор
                (пароль хешируется PBKDF2-SHA256, 150 000 итераций). Предзаданных учётных записей нет.
              </p>
            </div>
          </DocSection>

          {/* 05 */}
          <DocSection id="install-agent" n="05" title="Установка агента (Go)">
            <div className="space-y-3.5">
              <Code name="bash — установка на сервер" lang="shell" code={INSTALL_AGENT} />
              <div className="grid md:grid-cols-2 gap-3.5">
                <Code name="/etc/systemd/system/kontur-agent.service" lang="systemd" code={SYSTEMD_AGENT} />
                <Code name="/etc/kontur-agent/agent.toml" lang="toml" code={AGENT_TOML} />
              </div>
              <p className="text-[12px] text-mut leading-relaxed">
                Бинарь собирается одной командой <code className="font-mono text-info">CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"</code> —
                статический, ~9 МБ, работает на любом systemd-дистрибутиве (amd64/arm64). Обновление: заменить бинарь и
                <code className="font-mono text-info"> systemctl restart kontur-agent</code>, токен сохраняется.
              </p>
            </div>
          </DocSection>

          {/* 06 */}
          <DocSection id="connect" n="06" title="Подключение агента и жизненный цикл токена">
            <div className="card p-5 space-y-4">
              <ol className="space-y-2.5">
                {([
                  "В консоли: Агенты → «Подключить» → ввести IP, порт (по умолчанию 8443), группу и INSTALL TOKEN.",
                  "Консоль делает рукопожатие: TCP → TLS (пин сертификата) → GET /v1/health с заголовком X-Agent-Token.",
                  "При 200 OK узел добавляется в реестр: метаданные из health, токен — в vault, хэш — в БД.",
                  "Открывается поток телеметрии (каждые 5 с) и становятся доступны exec, PTY, сервисы и файлы.",
                ]).map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-md bg-panel2 border border-line2 flex items-center justify-center font-mono text-[11px] font-bold text-amber mt-0.5">{i + 1}</span>
                    <span className="text-[12.5px] text-mut leading-relaxed pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
              <div className="border-t border-line pt-4">
                <div className="lbl mb-2">Ротация токена</div>
                <Code name="bash — ротация" lang="shell" code={ROTATE} />
              </div>
              <p className="text-[12px] text-mut leading-relaxed">
                Если токен скомпрометирован: ротация на агенте мгновенно инвалидирует старый ключ во всей системе —
                консоль получает 401 и помечает узел как требующий переподключения.
              </p>
            </div>
          </DocSection>

          {/* 07 */}
          <DocSection id="config" n="07" title="Конфигурация">
            <div className="space-y-3.5">
              <p className="text-[12.5px] text-mut">Полный файл конфигурации агента с комментариями — выше, в разделе 05. Ключевые пороги:</p>
              <EnvTable rows={[
                ["[telemetry] interval", "период снимков метрик; чаще 2s не рекомендуется", "5s"],
                ["[limits] exec_timeout", "жёсткий таймаут команды, после — SIGKILL", "30s"],
                ["[limits] max_output", "обрезка вывода exec свыше лимита", "1MiB"],
                ["[limits] pty_max", "параллельные веб-терминалы на узел", "4"],
                ["[fs] deny", "запрещённые пути файлового браузера", "/proc/kcore…"],
              ]} />
            </div>
          </DocSection>

          {/* 08 */}
          <DocSection id="api" n="08" title="Справочник API">
            <div className="grid lg:grid-cols-2 gap-3.5">
              {([["API агента (Go, на каждом сервере)", API_AGENT, "#3ecf8e"], ["API консоли (Node.js)", API_CORE, "#ffb224"]] as [string, [string, string, string][], string][]).map(([title, rows, c]) => (
                <div key={title} className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-line font-display font-semibold text-[13.5px] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: c }} /> {title}
                  </div>
                  <div className="divide-y divide-line/50">
                    {rows.map(([m, p, d]) => (
                      <div key={p} className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded w-20 text-center" style={{ color: c, background: c + "12", border: `1px solid ${c}38` }}>{m}</span>
                          <code className="font-mono text-[12px] text-ink">{p}</code>
                        </div>
                        <p className="text-[11.5px] text-mut mt-1 pl-1">{d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DocSection>

          {/* 09 */}
          <DocSection id="docker" n="09" title="Docker-развёртывание">
            <div className="space-y-3.5">
              <Code name="docker-compose.yml" lang="yaml" code={COMPOSE} />
              <p className="text-[12px] text-mut leading-relaxed">
                Агенты в контейнеры не прячутся: им нужен доступ к /proc, systemd и файловой системе хоста — только бинарь + юнит.
                Для обновления консоли: <code className="font-mono text-info">docker compose pull && docker compose up -d kontur-core</code> — миграции накатываются автоматически.
              </p>
            </div>
          </DocSection>

          {/* 10 */}
          <DocSection id="rbac" n="10" title="Пользователи и роли">
            <div className="card overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left lbl border-b border-line bg-panel/60">
                    <th className="px-4 py-2.5 font-medium">Возможность</th>
                    <th className="px-3 py-2.5 font-medium text-center" style={{ color: "#ffb224" }}>Админ</th>
                    <th className="px-3 py-2.5 font-medium text-center" style={{ color: "#3ecf8e" }}>Оператор</th>
                    <th className="px-3 py-2.5 font-medium text-center" style={{ color: "#56c8e8" }}>Наблюдатель</th>
                  </tr>
                </thead>
                <tbody>
                  {RBAC_ROWS.map(([f, a, o, v]) => (
                    <tr key={f} className="border-b border-line/50 last:border-0 hover:bg-raise/40 transition-colors">
                      <td className="px-4 py-2.5 text-mut">{f}</td>
                      {[a, o, v].map((x, i) => (
                        <td key={i} className="px-3 py-2.5 text-center font-mono">
                          {x ? <Icon n="check" size={13} className="text-ok inline" /> : <span className="text-dim">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* 11 */}
          <DocSection id="trouble" n="11" title="Устранение проблем">
            <div className="card overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left lbl border-b border-line bg-panel/60">
                    <th className="px-4 py-2.5 font-medium">Симптом</th>
                    <th className="px-3 py-2.5 font-medium">Причина</th>
                    <th className="px-3 py-2.5 font-medium">Решение</th>
                  </tr>
                </thead>
                <tbody>
                  {TROUBLE.map(([s, c, f]) => (
                    <tr key={s} className="border-b border-line/50 last:border-0 hover:bg-raise/40 transition-colors align-top">
                      <td className="px-4 py-3 font-mono text-[11.5px] text-amber">{s}</td>
                      <td className="px-3 py-3 text-mut">{c}</td>
                      <td className="px-3 py-3 text-ink/80">{f}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* 12 */}
          <DocSection id="source" n="12" title="Исходники для старта">
            <div className="grid xl:grid-cols-2 gap-3.5">
              <Code name="agent/main.go" lang="go" code={GO_CODE} />
              <Code name="kontur-core/server.js" lang="node.js" code={NODE_CODE} />
            </div>
            <div className="mt-3.5">
              <Code name="deploy/kontur-core.service" lang="systemd" code={SYSTEMD_CORE} />
            </div>
            <p className="text-[12px] text-dim font-mono mt-3 flex items-center gap-2">
              <Icon n="book" size={13} /> Рабочие прототипы: поднимают консоль + одного агента за ~5 минут; дальше — по модулям из раздела 02.
            </p>
          </DocSection>
        </div>
      </div>
    </div>
  );
}
