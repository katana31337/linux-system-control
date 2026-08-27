import type { Server } from "./data";
import { genProcesses, genServices } from "./data";

export type Cls = "out" | "err" | "ok" | "dim" | "cyan" | "warn" | "cmd";
export interface TermLine { t: string; c?: Cls; }
export interface RunResult { clear?: boolean; lines: TermLine[]; stream?: boolean; }

export type FSNode = { t: "d"; ch: Record<string, FSNode> } | { t: "f"; c: string };

const d = (ch: Record<string, FSNode>): FSNode => ({ t: "d", ch });
const f = (c: string): FSNode => ({ t: "f", c });

export function getFS(s: Server): FSNode {
  return d({
    bin: d({ bash: f(""), ls: f(""), cat: f(""), systemctl: f("") }),
    etc: d({
      hostname: f(`${s.name}\n`),
      "os-release": f(`PRETTY_NAME="${s.os}"\nNAME="${s.os.split(" ")[0]}"\nID=${s.os.toLowerCase().includes("debian") ? "debian" : "ubuntu"}\nVERSION_CODENAME=${s.os.toLowerCase().includes("debian") ? "bookworm" : "jammy"}\n`),
      hosts: f(`127.0.0.1\tlocalhost\n127.0.1.1\t${s.name}\n${s.ip}\t${s.name}.local\n`),
      nginx: d({
        "nginx.conf": f(`worker_processes auto;\nevents { worker_connections 4096; }\nhttp {\n  upstream backend { server 10.0.2.21:8080; }\n  server {\n    listen 80;\n    server_name ${s.name}.local;\n    location / { proxy_pass http://backend; }\n  }\n}\n`),
      }),
      ssh: d({
        "sshd_config": f(`Port 22\nPermitRootLogin no\nPasswordAuthentication no\nPubkeyAuthentication yes\nAllowGroups ssh-users\n`),
      }),
      kontur: d({
        "agent.toml": f(`# KONTUR OPS agent\nlisten = "0.0.0.0:${s.port}"\ntoken_file = "/var/lib/kontur/token"  # chmod 600\nheartbeat_sec = 5\nallow_exec = true\nallow_files = true\n`),
      }),
    }),
    home: d({
      admin: d({
        "notes.txt": f(`TODO:\n- обновить агент до ${s.agent} на всех хостах группы\n- проверить ротацию логов nginx\n- согласовать окно обслуживания db-postgres-01\n`),
        "deploy.sh": f(`#!/bin/bash\nset -euo pipefail\necho "deploy $(date +%F_%T)"\nrsync -a build/ /srv/www/ && systemctl reload nginx\n`),
        ".bashrc": f(`export PS1='\\u@\\h:\\w\\$ '\nalias ll='ls -la'\n`),
      }),
    }),
    var: d({
      log: d({
        syslog: f(`Feb 24 09:40:51 ${s.name} systemd[1]: Started Daily apt download activities.\nFeb 24 09:41:02 ${s.name} kontur-agent[${Math.floor(800 + Math.random() * 900)}]: heartbeat sent (18ms)\nFeb 24 09:41:07 ${s.name} kontur-agent: metrics batch uploaded (64 points)\n`),
        "auth.log": f(`Feb 24 09:12:44 ${s.name} sshd[1042]: Accepted publickey for admin from 10.0.0.7 port 52114\nFeb 24 09:12:44 ${s.name} sshd[1042]: pam_unix(sshd:session): session opened for user admin\n`),
      }),
    }),
    srv: d({ www: d({ "index.html": f("<h1>it works</h1>\n") }) }),
    opt: d({ kontur: d({ agent: f("") }) }),
    tmp: d({}),
    usr: d({ bin: d({}), lib: d({}), share: d({}) }),
  });
}

function resolve(cwd: string, raw: string): string {
  let p = raw === "~" || raw.startsWith("~/") ? "/home/admin" + raw.slice(1) : raw;
  if (!p.startsWith("/")) p = `${cwd === "/" ? "" : cwd}/${p}`;
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

function nodeAt(root: FSNode, path: string): FSNode | null {
  if (path === "/") return root;
  let cur: FSNode = root;
  for (const seg of path.split("/").filter(Boolean)) {
    if (cur.t !== "d" || !cur.ch[seg]) return null;
    cur = cur.ch[seg];
  }
  return cur;
}

const K_ART = [
  "█  █",
  "█ █ ",
  "██  ",
  "█ █ ",
  "█  █",
];

export class ShellSession {
  cwd = "/home/admin";
  hist: string[] = [];

  run(raw: string, s: Server): RunResult {
    const trimmed = raw.trim();
    if (!trimmed) return { lines: [] };
    this.hist.push(trimmed);
    const [cmd, ...args] = trimmed.split(/\s+/);
    const flag = (n: string) => args.includes(n);
    const root = getFS(s);
    const L = (t: string, c?: Cls): TermLine => ({ t, c });

    switch (cmd) {
      case "help":
        return { lines: [
          L("Доступные команды (эмуляция bash через агент kontur):", "dim"),
          L("  ls [-la] [path]   cat <file>   cd <dir>   pwd"),
          L("  ps aux   top   free -h   df -h   uptime   date"),
          L("  ping <host>   ip addr   uname -a   whoami   id   hostname"),
          L("  systemctl [list-units | status|restart|start|stop <unit>]"),
          L("  kontur status   neofetch   history   echo ...   clear"),
        ]};
      case "clear":
        return { clear: true, lines: [] };
      case "whoami": return { lines: [L("admin")] };
      case "id": return { lines: [L("uid=1000(admin) gid=1000(admin) groups=1000(admin),27(sudo),998(kontur)")] };
      case "hostname": return { lines: [L(s.name)] };
      case "date": return { lines: [L(new Date().toString())] };
      case "uname":
        return { lines: [L(flag("-a") ? `Linux ${s.name} ${s.kernel} #1 SMP ${s.arch} GNU/Linux` : "Linux")] };
      case "uptime": {
        const d = s.uptimeDays;
        return { lines: [L(` ${new Date().toLocaleTimeString("ru-RU", { hour12: false })} up ${Math.floor(d)} days, ${Math.floor((d % 1) * 24)}:${String(Math.floor(Math.random() * 59)).padStart(2, "0")}, 1 user, load average: ${(s.baseCpu / 28).toFixed(2)}, ${(s.baseCpu / 34).toFixed(2)}, ${(s.baseCpu / 40).toFixed(2)}`)] };
      }
      case "pwd": return { lines: [L(this.cwd)] };
      case "echo": return { lines: [L(args.join(" "))] };
      case "history":
        return { lines: this.hist.slice(0, -1).map((h, i) => L(`  ${String(i + 1).padStart(4)}  ${h}`, "dim")) };
      case "sudo":
        return { lines: [
          L("Мы доверяем всем. Пожалуйста, введите пароль для admin:", "warn"),
          L("admin отсутствует в файле sudoers. Об инциденте будет доложено.", "err"),
        ]};
      case "exit": return { lines: [L("logout", "dim"), L("(демо-сессия: соединение с агентом сохраняется)", "dim")] };
      case "cd": {
        const target = resolve(this.cwd, args[0] ?? "~");
        const n = nodeAt(root, target);
        if (!n) return { lines: [L(`bash: cd: ${args[0]}: Нет такого файла или каталога`, "err")] };
        if (n.t !== "d") return { lines: [L(`bash: cd: ${args[0]}: Это не каталог`, "err")] };
        this.cwd = target;
        return { lines: [] };
      }
      case "ls": {
        const pathArg = args.find((a) => !a.startsWith("-")) ?? ".";
        const target = resolve(this.cwd, pathArg);
        const n = nodeAt(root, target);
        if (!n) return { lines: [L(`ls: невозможно получить доступ к '${pathArg}': Нет такого файла или каталога`, "err")] };
        if (n.t === "f") return { lines: [L(pathArg)] };
        const names = Object.keys(n.ch);
        if (names.length === 0) return { lines: [L("(пусто)", "dim")] };
        if (flag("-l") || flag("-la") || flag("-al")) {
          const rows = names.map((nm) => {
            const ch = n.t === "d" ? n.ch[nm] : null;
            const isDir = ch?.t === "d";
            const size = isDir ? 4096 : (ch?.t === "f" ? ch.c.length : 0);
            return L(`-rw${isDir ? "d" : "-" + ""}r--r-- 1 ${isDir ? "root" : "admin"} ${isDir ? "root" : "admin"} ${String(size).padStart(7)} фев 24 09:30 ${nm}${isDir ? "/" : ""}`, isDir ? "cyan" : "out");
          });
          return { lines: [L(`итого ${names.length * 4}`, "dim"), ...rows] };
        }
        return { lines: names.map((nm) => L(nm + (n.t === "d" && n.ch[nm].t === "d" ? "/" : ""), n.t === "d" && n.ch[nm].t === "d" ? "cyan" : "out")) };
      }
      case "cat": {
        if (!args[0]) return { lines: [L("cat: отсутствует операнд файла", "err")] };
        const target = resolve(this.cwd, args[0]);
        const n = nodeAt(root, target);
        if (!n) return { lines: [L(`cat: ${args[0]}: Нет такого файла или каталога`, "err")] };
        if (n.t === "d") return { lines: [L(`cat: ${args[0]}: Это каталог`, "err")] };
        return { lines: n.c.split("\n").filter((x) => x !== "" || true).slice(0, -1).map((x) => L(x)) };
      }
      case "df": {
        const pct = Math.round((s.diskUsed / s.diskTotal) * 100);
        return { lines: [
          L("Filesystem      Size  Used Avail Use% Mounted on"),
          L(`/dev/sda1       ${s.diskTotal}G  ${s.diskUsed}G  ${s.diskTotal - s.diskUsed}G  ${pct}% /`, pct > 88 ? "warn" : "out"),
          L(`tmpfs           ${s.ramGb / 2}G     0  ${s.ramGb / 2}G   0% /dev/shm`, "dim"),
        ]};
      }
      case "free": {
        const used = Math.round((s.baseMem / 100) * s.ramGb * 10) / 10;
        return { lines: [
          L("               total        used        free      shared  buff/cache   available"),
          L(`Mem:      ${String(s.ramGb * 1024 * 1024).padStart(11)}${String(Math.round(used * 1024 * 1024)).padStart(12)}${String(Math.round((s.ramGb - used) * 0.4 * 1024 * 1024)).padStart(12)}${String(Math.round(s.ramGb * 0.02 * 1024 * 1024)).padStart(12)}${String(Math.round((s.ramGb - used) * 0.6 * 1024 * 1024)).padStart(12)}${String(Math.round((s.ramGb - used) * 1024 * 1024)).padStart(12)}`),
          L(`Swap:      ${String(Math.round(s.ramGb * 0.5 * 1024 * 1024)).padStart(10)}           0 ${String(Math.round(s.ramGb * 0.5 * 1024 * 1024)).padStart(11)}`),
        ]};
      }
      case "ps":
      case "top": {
        const procs = genProcesses(s).slice(0, cmd === "ps" ? 14 : 9);
        const head = L("  PID USER       %CPU  %MEM    VSZ     RSS  COMMAND", "dim");
        const rows = procs.map((p) => L(`${String(p.pid).padStart(5)} ${p.user.padEnd(9)} ${String(p.cpu).padStart(5)} ${String(p.mem).padStart(5)} ${p.vsz.padStart(7)} ${p.rss.padStart(7)}  ${p.cmd}`, p.cpu > 20 ? "warn" : "out"));
        if (cmd === "top") {
          return { lines: [
            L(`top - ${new Date().toLocaleTimeString("ru-RU", { hour12: false })} up ${Math.floor(s.uptimeDays)} days,  load average: ${(s.baseCpu / 30).toFixed(2)}, ${(s.baseCpu / 36).toFixed(2)}, ${(s.baseCpu / 42).toFixed(2)}`, "cyan"),
            L(`Tasks: ${procs.length + 96} total, 1 running, ${procs.length + 95} sleeping`, "dim"),
            L(`%Cpu(s): ${s.baseCpu.toFixed(1)} us, 3.2 sy, 0.0 ni, ${(96 - s.baseCpu).toFixed(1)} id`, "dim"),
            L(""), head, ...rows,
            L("(демо: нажмите q в настоящем top)", "dim"),
          ]};
        }
        return { lines: [head, ...rows] };
      }
      case "ping": {
        const host = args[0] ?? "8.8.8.8";
        const lines: TermLine[] = [L(`PING ${host} (${host}) 56(84) bytes of data.`, "dim")];
        let sum = 0;
        for (let i = 1; i <= 4; i++) {
          const t = Math.round((12 + Math.random() * 26) * 10) / 10;
          sum += t;
          lines.push(L(`64 bytes from ${host}: icmp_seq=${i} ttl=57 time=${t} ms`));
        }
        lines.push(L(""), L(`--- ${host} ping statistics ---`), L(`4 packets transmitted, 4 received, 0% packet loss, time 3004ms`, "ok"), L(`rtt min/avg/max = ${(sum / 4 - 6).toFixed(1)}/${(sum / 4).toFixed(1)}/${(sum / 4 + 9).toFixed(1)} ms`, "dim"));
        return { lines, stream: true };
      }
      case "ip": {
        if (args[0] === "addr" || args[0] === "a") {
          return { lines: [
            L("1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN"),
            L("    inet 127.0.0.1/8 scope host lo", "cyan"),
            L(`2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP qlen 1000`),
            L(`    inet ${s.ip}/24 brd 10.0.255.255 scope global eth0`, "cyan"),
            L(`    ether 3a:7c:${s.id.charCodeAt(1).toString(16)}:d4:1b:9c brd ff:ff:ff:ff:ff:ff`, "dim"),
          ]};
        }
        return { lines: [L("Usage: ip [ addr | route | link ]", "dim")] };
      }
      case "systemctl": {
        const sub = args[0] ?? "list-units";
        const units = genServices(s);
        if (sub === "list-units" || flag("--type=service")) {
          return { lines: [
            L("  UNIT                              LOAD   ACTIVE SUB     DESCRIPTION", "dim"),
            ...units.map((u) => L(`  ${u.unit.padEnd(33)} loaded ${u.active ? "active running" : "failed failed"} ${u.desc.slice(0, 38)}`, u.active ? "out" : "err")),
            L(`${units.length} loaded units listed.`, "dim"),
          ]};
        }
        if (["status", "restart", "start", "stop"].includes(sub)) {
          const unit = args[1];
          const u = units.find((x) => x.unit === unit || x.unit === unit + ".service");
          if (!unit) return { lines: [L(`systemctl: требуется имя юнита`, "err")] };
          if (!u) return { lines: [L(`Unit ${unit}.service could not be found.`, "err")] };
          if (sub === "status") {
            return { lines: [
              L(`● ${u.unit} - ${u.desc}`, "cyan"),
              L(`     Loaded: loaded (/etc/systemd/system/${u.unit}; enabled)`, "dim"),
              L(`     Active: ${u.active ? "active (running)" : "failed (Result: exit-code)"}`, u.active ? "ok" : "err"),
              L(`   Main PID: ${Math.floor(800 + Math.random() * 2000)} (${u.unit.split(".")[0]})`, "dim"),
              L(`      Tasks: ${Math.floor(2 + Math.random() * 14)} (limit: 4915)`, "dim"),
            ]};
          }
          const verb = sub === "restart" ? "перезапущен" : sub === "start" ? "запущен" : "остановлен";
          return { lines: [L(`OK: ${u.unit} ${verb} через агент kontur (exec relay, 240 мс)`, "ok")], stream: true };
        }
        return { lines: [L("systemctl [list-units | status | start | stop | restart] <unit>", "dim")] };
      }
      case "kontur": {
        return { lines: [
          L("KONTUR OPS agent", "cyan"),
          L(`  версия      : ${s.agent}`, "dim"),
          L(`  слушает     : 0.0.0.0:${s.port} (TLS, самоподписанный сертификат)`, "dim"),
          L(`  токен       : ${s.token} (хранится в /var/lib/kontur/token, mode 600)`, "dim"),
          L(`  heartbeat   : каждые 5 c → консоль 10.0.0.2:8443`, "dim"),
          L(`  статус      : ${s.status === "online" ? "connected" : s.status === "warning" ? "connected (есть предупреждения)" : "disconnected"}`, s.status === "offline" ? "err" : "ok"),
          L(`  исполнено   : 1 248 команд за 30 дней (все — через аудит консоли)`, "dim"),
        ]};
      }
      case "neofetch": {
        const info = [
          ["admin", `@${s.name}`],
          ["OS", `${s.os} ${s.arch}`],
          ["Kernel", s.kernel],
          ["Uptime", `${Math.floor(s.uptimeDays)} days`],
          ["CPU", `${s.arch === "x86_64" ? "Intel Xeon" : "ARM"} (${s.cores}) @ 2.60GHz`],
          ["Memory", `${Math.round((s.baseMem / 100) * s.ramGb)}GiB / ${s.ramGb}GiB`],
          ["Agent", `kontur ${s.agent}`],
        ];
        const lines: TermLine[] = [];
        for (let i = 0; i < Math.max(K_ART.length, info.length); i++) {
          const art = K_ART[i] ?? "    ";
          const inf = info[i];
          lines.push(L(art.padEnd(8) + (inf ? (i === 0 ? `${inf[0]}${inf[1]}` : `${inf[0]}: ${inf[1]}`) : ""), i === 0 ? "warn" : i ? "out" : "warn"));
        }
        return { lines };
      }
      default:
        return { lines: [L(`bash: ${cmd}: команда не найдена`, "err")] };
    }
  }
}
