import { useEffect, useRef, useState } from "react";
import { Icon, useToast } from "./ui";

const BOOT: { t: string; c?: string }[] = [
  { t: "KONTUR OPS v2.4.1 — ядро консоли (node 20.11, ws 8.16)" },
  { t: "[ ok ] подключение к БД postgres://kontur@db-01:5432/kontur", c: "ok" },
  { t: "[ ok ] миграции: 34 applied, 0 pending", c: "ok" },
  { t: "[ ok ] сборщик телеметрии: ws://0.0.0.0:8443/agent/stream", c: "ok" },
  { t: "[ ok ] реестр агентов: 10 хостов, 8 онлайн, 1 под нагрузкой", c: "ok" },
  { t: "[ ok ] проверка токенов агентов: 10/10 подписей валидны", c: "ok" },
  { t: "[ ok ] RBAC: 4 пользователя, 3 роли, 2 активных сессии", c: "ok" },
  { t: "[ ok ] журнал аудита: поток подключён, ротация 30 дней", c: "ok" },
  { t: "[warn] backup-nfs-01: диск 91% — порог 90% превышен", c: "warn" },
  { t: "[crit] build-runner-01: нет heartbeat 2 ч — агент офлайн", c: "crit" },
  { t: "[ ok ] консоль готова. Требуется авторизация оператора." },
];

export default function Login({ onLogin }: { onLogin: (login: string, remember: boolean) => void }) {
  const [shown, setShown] = useState(0);
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(0);
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const t = setInterval(() => setShown((s) => (s < BOOT.length ? s + 1 : s)), 240);
    return () => clearInterval(t);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    if (!login.trim() || !pass) { setErr("Заполните логин и пароль"); setShake((x) => x + 1); return; }
    setBusy(true);
    setTimeout(() => {
      if (login.trim().toLowerCase() === "admin" && pass === "kontur") {
        toast(`Добро пожаловать, ${login}. Сессия защищена TLS 1.3`, "ok");
        onLogin(login.trim(), remember);
      } else {
        setBusy(false);
        setErr("Неверные учётные данные. Попытка записана в аудит.");
        setShake((x) => x + 1);
      }
    }, 900);
  };

  return (
    <div className="min-h-screen flex items-stretch">
      {/* левая панель: boot log */}
      <div className="hidden lg:flex flex-col w-[54%] p-10 xl:p-14 border-r border-line relative overflow-hidden">
        <div className="scanline absolute inset-0 pointer-events-none" />
        <div className="relative flex items-center gap-3 mb-10">
          <BrandMark />
          <div>
            <div className="font-display font-extrabold text-2xl tracking-widest leading-none">KONTUR<span className="text-amber">·OPS</span></div>
            <div className="font-mono text-[11px] text-mut tracking-[0.22em] mt-1.5">ЦЕНТР УПРАВЛЕНИЯ LINUX-СЕРВЕРАМИ</div>
          </div>
        </div>

        <div className="card flex-1 p-5 font-mono text-[12.5px] leading-relaxed overflow-hidden relative">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-line text-dim">
            <span className="w-2.5 h-2.5 rounded-full bg-bad/70" /><span className="w-2.5 h-2.5 rounded-full bg-amber/70" /><span className="w-2.5 h-2.5 rounded-full bg-ok/70" />
            <span className="ml-2 text-[11px] tracking-wider">kontur-core — загрузка служб</span>
          </div>
          {BOOT.slice(0, shown).map((l, i) => (
            <div key={i} className="anim-rise whitespace-pre-wrap">
              <span className="text-dim mr-2 select-none">{String(i).padStart(2, "0")}</span>
              <span className={l.c === "ok" ? "text-ok" : l.c === "warn" ? "text-amber" : l.c === "crit" ? "text-bad" : "text-ink/85"}>
                {l.c ? l.t.slice(0, 6) : ""}<span className={l.c ? "" : ""}>{l.c ? l.t.slice(7) : l.t}</span>
              </span>
            </div>
          ))}
          <span className="caret inline-block w-2 h-4 bg-amber align-middle ml-1" />
        </div>

        <div className="relative mt-8 grid grid-cols-3 gap-3 text-[12px] text-mut font-mono">
          <div className="flex items-center gap-2"><Icon n="box" size={15} className="text-amber" /> агенты на Go, 1 бинарь</div>
          <div className="flex items-center gap-2"><Icon n="key" size={15} className="text-info" /> токен при установке</div>
          <div className="flex items-center gap-2"><Icon n="terminal" size={15} className="text-ok" /> bash прямо из браузера</div>
        </div>
      </div>

      {/* правая панель: форма */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] anim-rise" style={{ animationDelay: ".15s" }}>
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <BrandMark small />
            <div className="font-display font-extrabold text-xl tracking-widest">KONTUR<span className="text-amber">·OPS</span></div>
          </div>

          <div className="lbl mb-2 flex items-center gap-2"><Icon n="lock" size={13} /> авторизация оператора</div>
          <h1 className="font-display text-[26px] font-bold leading-tight mb-1">Вход в консоль</h1>
          <p className="text-[13px] text-mut mb-7">Доступ журналируется. Роли: администратор · оператор · наблюдатель.</p>

          <form ref={formRef} onSubmit={submit} key={shake} className={`space-y-4 ${shake ? "anim-shake" : ""}`}>
            <label className="block">
              <span className="lbl block mb-1.5">Логин</span>
              <input
                value={login} onChange={(e) => setLogin(e.target.value)} autoFocus autoComplete="username"
                placeholder="admin"
                className="w-full bg-panel border border-line rounded-lg px-3.5 py-2.5 text-[14px] font-mono placeholder:text-dim focus:border-amber/60 focus:bg-panel2 transition-colors outline-none"
              />
            </label>
            <label className="block">
              <span className="lbl block mb-1.5">Пароль</span>
              <input
                value={pass} onChange={(e) => setPass(e.target.value)} type="password" autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-panel border border-line rounded-lg px-3.5 py-2.5 text-[14px] font-mono placeholder:text-dim focus:border-amber/60 focus:bg-panel2 transition-colors outline-none"
              />
            </label>

            {err && (
              <div className="flex items-center gap-2 text-[12.5px] text-bad bg-bad/8 border border-bad/25 rounded-lg px-3 py-2.5">
                <Icon n="alert" size={14} /> {err}
              </div>
            )}

            <label className="flex items-center gap-2.5 text-[13px] text-mut cursor-pointer select-none">
              <button type="button" onClick={() => setRemember((r) => !r)}
                className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded border flex items-center justify-center transition-colors cursor-pointer ${remember ? "bg-amber border-amber text-bg" : "border-line2 bg-panel"}`}>
                {remember && <Icon n="check" size={12} />}
              </button>
              Запомнить сессию на этом устройстве
            </label>

            <button
              type="submit" disabled={busy}
              className="w-full relative overflow-hidden rounded-lg py-3 font-display font-bold text-[14px] tracking-wider text-bg bg-amber hover:bg-[#ffc14d] active:scale-[0.985] transition-all cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2.5"
            >
              {busy ? (<><span className="w-4 h-4 rounded-full border-2 border-bg/30 border-t-bg spin" /> ПРОВЕРКА ТОКЕНА СЕССИИ…</>) : (<>ВОЙТИ В КОНСОЛЬ <Icon n="chevR" size={15} /></>)}
            </button>
          </form>

          <div className="mt-6 card px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-[12px] text-mut">Демо-доступ:<br /><span className="font-mono text-ink">admin / kontur</span></div>
            <button
              onClick={() => { setLogin("admin"); setPass("kontur"); setErr(""); toast("Учётные данные подставлены", "info"); }}
              className="px-3 py-1.5 rounded-md border border-line text-[12px] font-mono text-info hover:border-info/50 hover:bg-info/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              подставить
            </button>
          </div>

          <p className="mt-6 text-center font-mono text-[10.5px] text-dim tracking-wider">TLS 1.3 · argon2id · аудит действий · v2.4.1</p>
        </div>
      </div>
    </div>
  );
}

export function BrandMark({ small = false }: { small?: boolean }) {
  const s = small ? 34 : 46;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" className="shrink-0 floaty">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffb224" /><stop offset="100%" stopColor="#ff7849" />
        </linearGradient>
      </defs>
      <path d="M24 2 43 13v22L24 46 5 35V13Z" fill="#10161f" stroke="url(#bm)" strokeWidth="2.4" />
      <path d="M17 14v20M17 24l11-10M17 24l12 10" stroke="url(#bm)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
