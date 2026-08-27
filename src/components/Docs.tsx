import type { ReactNode } from "react";
import { CopyBtn, Icon, SectionHead, type IconName } from "./ui";

const GO_CODE = `package main

import (
    "crypto/rand"
    "crypto/subtle"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os/exec"
)

// Токен генерируется ОДИН раз при установке и печатается в stdout —
// дальше его можно только ротировать. Хранится в /var/lib/kontur/token (0600).
var token = mustGen()

func mustGen() string {
    b := make([]byte, 32)              // crypto/rand, 256 бит энтропии
    if _, err := rand.Read(b); err != nil {
        log.Fatal(err)
    }
    t := hex.EncodeToString(b)
    fmt.Println("INSTALL TOKEN:", t)   // показывается оператору один раз
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

// Интерактивный bash: PTY на агенте, стрим через WebSocket
// ws://console/ws/terminal/:id  ←→  wss://agent:8443/v1/pty
app.listen({ port: 8443, host: "0.0.0.0" });`;

const COMPOSE_CODE = `# docker-compose.yml — консоль (агенты ставятся бинарём на хосты)
services:
  kontur-core:
    image: kontur/core:2.4.1
    ports: ["8443:8443"]
    environment:
      DATABASE_URL: postgres://kontur:secret@db:5432/kontur
      TOKEN_SALT: \${TOKEN_SALT}
    depends_on: [db]

  db:
    image: timescale/timescaledb-ha:pg16
    volumes: [pgdata:/home/postgres/pgdata]

volumes: { pgdata: {} }`;

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
      <span className="font-mono text-[9.5px] text-dim text-center leading-tight mt-1 max-w-[90px]">{label}</span>
    </div>
  );
}

function DocSection({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="anim-rise">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[12px] font-bold text-bg bg-amber rounded-md px-2 py-0.5">{n}</span>
        <h3 className="font-display font-bold text-lg tracking-wide">{title}</h3>
      </div>
      {children}
    </section>
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
];

const API_CORE: [string, string, string][] = [
  ["POST", "/api/auth/login", "сессия оператора: argon2id, JWT 12 ч, 2FA для admin"],
  ["GET / POST", "/api/agents", "реестр: добавление требует ip + порт + install-токен"],
  ["POST", "/api/agents/:id/exec", "relay команды на агент (роль operator+), запись в аудит"],
  ["WS", "/ws/terminal/:id", "интерактивный bash в браузере, PTY через агент"],
  ["GET", "/api/metrics/:id", "история из TimescaleDB: range, step, агрегаты"],
  ["GET", "/api/audit", "журнал действий (admin), экспорт CSV, append-only"],
];

export default function Docs() {
  return (
    <div className="space-y-10 max-w-5xl">
      <SectionHead title="Архитектура и протокол" sub="Как устроена связка «Go-агент ↔ Node.js-консоль»: транспорт, безопасность, микросервисы и готовый код" />

      <DocSection n="01" title="Схема взаимодействия">
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
            <span className="text-amber font-semibold">Рекомендация по транспорту:</span> базовый вариант — консоль сама стучится в HTTPS-API агента (как в схеме выше),
            что идеально совпадает с вашей моделью «указать ip:порт + токен в панели». Если серверы за NAT, добавьте <span className="text-ok">обратный WS-туннель</span>:
            агент при старте сам устанавливает постоянное WSS-соединение с консолью и держит его, а команды идут по этому каналу. Токен обязателен в обоих направлениях —
            без него ни консоль, ни злоумышленник агентом управлять не сможет.
          </p>
        </div>
      </DocSection>

      <DocSection n="02" title="Модель безопасности">
        <div className="grid sm:grid-cols-2 gap-3.5">
          {([
            ["key", "Install-токен", "32 байта crypto/rand при установке, печатается один раз. Агент сравнивает в constant time. Ротация командой kontur-agent rotate-token.", "#ffb224"],
            ["lock", "Хранение в консоли", "В БД — только SHA-256(соль + токен) для проверки; рабочий ключ — в vault (AES-256-GCM) для exec relay. Утечка БД не даёт управления агентами.", "#56c8e8"],
            ["shield", "TLS и mTLS", "Самоподписанный сертификат агента с закреплённым отпечатком (pin) либо внутренний CA. Опционально mTLS: у каждого агента клиентский сертификат.", "#3ecf8e"],
            ["users", "RBAC + аудит", "admin / operator / viewer: viewer видит метрики, operator исполняет команды, admin управляет реестром и пользователями. Каждая команда — append-only запись с пользователем и временем.", "#c792ea"],
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

      <DocSection n="03" title="Микросервисная декомпозиция">
        <div className="card p-5">
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
            {([
              ["gateway", "единая точка входа: TLS, маршрутизация /api и /ws, rate-limit", "#ffb224"],
              ["auth-svc", "пользователи, сессии, роли, 2FA, ключи API", "#56c8e8"],
              ["collector", "приём и запись телеметрии в TimescaleDB, агрегаты и пороги алертов", "#3ecf8e"],
              ["exec-relay", "команды и PTY: проверка роли → агент → аудит; таймауты и блокировки", "#f0566a"],
              ["file-relay", "листинг, просмотр и скачивание файлов через агент", "#c792ea"],
              ["notifier", "Telegram / webhook-уведомления о критичных событиях", "#8595ad"],
            ] as [string, string, string][]).map(([n, d, c], i) => (
              <div key={n} className="flex gap-3 anim-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="font-mono text-[11px] font-bold px-2 py-1 rounded-md h-fit whitespace-nowrap" style={{ color: c, background: c + "12", border: `1px solid ${c}38` }}>{n}</span>
                <p className="text-[12.5px] text-mut leading-relaxed pt-0.5">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-line pt-4 flex gap-3 items-start">
            <span className="text-amber mt-0.5"><Icon n="zap" size={16} /></span>
            <p className="text-[12.5px] text-mut leading-relaxed">
              <span className="text-ink font-semibold">Прагматичный путь:</span> начинайте с <span className="text-amber">модульного монолита</span> — те же шесть модулей
              отдельными каталогами с чистыми интерфейсами, один процесс, одна БД. Когда появится нагрузка, модули выносятся в процессы без переписывания,
              а для событий между ними добавляется <span className="font-mono text-ok">NATS</span> или Redis Streams (алерты, команды, телеметрия).
              Границы сервисов уже совпадают с границами REST/WS API — это и есть «лёгкое расширение функционала».
            </p>
          </div>
        </div>
      </DocSection>

      <DocSection n="04" title="Справочник API">
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

      <DocSection n="05" title="Быстрый старт">
        <div className="grid lg:grid-cols-2 gap-3.5">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-panel">
              <span className="font-mono text-[11.5px] text-mut">установка агента на Linux-сервер</span>
              <CopyBtn text={`curl -fsSL https://ops.local/install.sh | bash -s -- --console 10.0.0.2:8443\nkontur-agent status   # напечатает INSTALL TOKEN\nkontur-agent rotate-token  # плановая ротация`} />
            </div>
            <pre className="p-4 font-mono text-[12px] leading-relaxed text-ok/90">
{`$ curl -fsSL https://ops.local/install.sh | bash -s -- \\
    --console 10.0.0.2:8443
  ↳ бинарь /usr/local/bin/kontur-agent (go, static)
  ↳ systemd-юнит kontur-agent.service
  ↳ INSTALL TOKEN: 7f3a9c2e44d0b18e…  ← вставить в консоль

$ kontur-agent status         # состояние и токен
$ kontur-agent rotate-token   # ротация (старый умирает)`}
            </pre>
          </div>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-panel">
              <span className="font-mono text-[11.5px] text-mut">установка консоли</span>
              <CopyBtn text="git clone https://ops.local/kontur-core && cd kontur-core\nnpm i && npm run migrate && npm start  # https://0.0.0.0:8443" />
            </div>
            <pre className="p-4 font-mono text-[12px] leading-relaxed text-info/90">
{`$ git clone https://ops.local/kontur-core
$ cd kontur-core && npm i
$ npm run migrate     # таблицы users/agents/audit
$ TOKEN_SALT=… npm start
  ↳ консоль на https://0.0.0.0:8443
  ↳ первый вход: admin → сгенерированный пароль`}
            </pre>
          </div>
        </div>
      </DocSection>

      <DocSection n="06" title="Исходники для старта">
        <div className="grid xl:grid-cols-2 gap-3.5">
          <Code name="agent/main.go" lang="go" code={GO_CODE} />
          <Code name="kontur-core/server.js" lang="node.js" code={NODE_CODE} />
        </div>
        <div className="mt-3.5">
          <Code name="docker-compose.yml" lang="yaml" code={COMPOSE_CODE} />
        </div>
        <p className="text-[12px] text-dim font-mono mt-3 flex items-center gap-2">
          <Icon n="book" size={13} /> Рабочие прототипы: собираются и поднимают консоль + одного агента за ~5 минут; дальше — по модулям из раздела 03.
        </p>
      </DocSection>
    </div>
  );
}
