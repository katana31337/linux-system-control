import { useEffect, useState } from "react";
import { Icon } from "./ui";

const BOOT: { t: string; c?: string }[] = [
  { t: "KONTUR OPS v2.4.1 — ядро консоли (node 20.11, ws 8.16)" },
  { t: "[ ok ] подключение к БД postgres://kontur@db-01:5432/kontur", c: "ok" },
  { t: "[ ok ] миграции: 34 applied, 0 pending", c: "ok" },
  { t: "[ ok ] сборщик телеметрии: ws://0.0.0.0:8443/agent/stream", c: "ok" },
  { t: "[ ok ] реестр агентов: пуст, ожидание подключений", c: "ok" },
  { t: "[ ok ] RBAC: пользователей нет — требуется первичная настройка", c: "warn" },
  { t: "[ ok ] журнал аудита: поток подключён, ротация 30 дней", c: "ok" },
  { t: "[ ok ] консоль готова. Требуется авторизация оператора." },
];

export default function Login({ mode, busy, error, onLogin, onCreate }: {
  mode: "setup" | "login";
  busy: boolean;
  error: string | null;
  onLogin: (login: string, pw: string, remember: boolean) => void;
  onCreate: (login: string, pw: string) => void;
}) {
  const [shown, setShown] = useState(0);
  const [login, setLogin] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [remember, setRemember] = useState(true);
  const [localErr, setLocalErr] = useState("");
  const [shake, setShake] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setShown((s) => (s < BOOT.length ? s + 1 : s)), 240);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (error) setShake((x) => x + 1); }, [error]);

  const strength = (() => {
    let sc = 0;
    if (pw.length >= 8) sc++;
    if (pw.length >= 12) sc++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) sc++;
    if (/\d/.test(pw)) sc++;
    if (/[^a-zA-Z0-9]/.test(pw)) sc++;
    return Math.min(4, sc);
  })();
  const strengthMeta = [
    { w: "0%", c: "#3a4a63", t: "" },
    { w: "25%", c: "#f0566a", t: "слабый" },
    { w: "50%", c: "#ffb224", t: "средний" },
    { w: "75%", c: "#56c8e8", t: "хороший" },
    { w: "100%", c: "#3ecf8e", t: "надёжный" },
  ][strength];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setLocalErr("");
    const lg = login.trim();
    if (!lg || !pw) { setLocalErr("Заполните все поля"); setShake((x) => x + 1); return; }
    if (mode === "setup") {
      if (!/^[a-z0-9._-]{3,24}$/i.test(lg)) { setLocalErr("Логин: 3–24 символа, латиница, цифры, . _ -"); setShake((x) => x + 1); return; }
      if (pw.length < 8) { setLocalErr("Пароль не короче 8 символов"); setShake((x) => x + 1); return; }
      if (pw !== pw2) { setLocalErr("Пароли не совпадают"); setShake((x) => x + 1); return; }
      onCreate(lg, pw);
    } else {
      onLogin(lg, pw, remember);
    }
  };

  const err = localErr || error;
  const fieldCls = "w-full bg-panel border border-line rounded-lg px-3.5 py-2.5 text-[14px] font-mono placeholder:text-dim focus:border-amber/60 focus:bg-panel2 transition-colors outline-none";

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
              <span className={l.c === "ok" ? "text-ok" : l.c === "warn" ? "text-amber" : l.c === "crit" ? "text-bad" : "text-ink/85"}>{l.t}</span>
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
        <div className="w-full max-w-[420px] anim-rise" style={{ animationDelay: ".15s" }}>
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <BrandMark small />
            <div className="font-display font-extrabold text-xl tracking-widest">KONTUR<span className="text-amber">·OPS</span></div>
          </div>

          <div className="lbl mb-2 flex items-center gap-2">
            <Icon n={mode === "setup" ? "shield" : "lock"} size={13} />
            {mode === "setup" ? "первичная настройка" : "авторизация оператора"}
          </div>
          <h1 className="font-display text-[26px] font-bold leading-tight mb-1">
            {mode === "setup" ? "Создание учётной записи администратора" : "Вход в консоль"}
          </h1>
          <p className="text-[13px] text-mut mb-7">
            {mode === "setup"
              ? "Первый запуск: предзаданных пользователей нет. Пароль хранится в виде хеша PBKDF2-SHA256 (150 000 итераций)."
              : "Доступ журналируется. Роли: администратор · оператор · наблюдатель."}
          </p>

          <form onSubmit={submit} key={shake} className={`space-y-4 ${shake ? "anim-shake" : ""}`}>
            <label className="block">
              <span className="lbl block mb-1.5">Логин</span>
              <input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus autoComplete="username"
                placeholder={mode === "setup" ? "например, admin" : "логин"} className={fieldCls} />
            </label>

            <label className="block">
              <span className="lbl block mb-1.5">Пароль</span>
              <input value={pw} onChange={(e) => setPw(e.target.value)} type="password"
                autoComplete={mode === "setup" ? "new-password" : "current-password"} placeholder="••••••••" className={fieldCls} />
              {mode === "setup" && pw.length > 0 && (
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="h-1 flex-1 rounded-full bg-[#1a2436] overflow-hidden">
                    <div className="h-full transition-all duration-300" style={{ width: strengthMeta.w, background: strengthMeta.c }} />
                  </div>
                  <span className="font-mono text-[10.5px]" style={{ color: strengthMeta.c }}>{strengthMeta.t}</span>
                </div>
              )}
            </label>

            {mode === "setup" && (
              <label className="block">
                <span className="lbl block mb-1.5">Повторите пароль</span>
                <input value={pw2} onChange={(e) => setPw2(e.target.value)} type="password" autoComplete="new-password"
                  placeholder="••••••••" className={fieldCls} />
              </label>
            )}

            {err && (
              <div className="flex items-center gap-2 text-[12.5px] text-bad bg-bad/8 border border-bad/25 rounded-lg px-3 py-2.5">
                <Icon n="alert" size={14} /> {err}
              </div>
            )}

            {mode === "login" && (
              <label className="flex items-center gap-2.5 text-[13px] text-mut cursor-pointer select-none">
                <button type="button" onClick={() => setRemember((r) => !r)}
                  className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-colors cursor-pointer ${remember ? "bg-amber border-amber text-bg" : "border-line2 bg-panel"}`}>
                  {remember && <Icon n="check" size={12} />}
                </button>
                Запомнить сессию (12 часов)
              </label>
            )}

            <button type="submit" disabled={busy}
              className="w-full relative overflow-hidden rounded-lg py-3 font-display font-bold text-[14px] tracking-wider text-bg bg-amber hover:bg-[#ffc14d] active:scale-[0.985] transition-all cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2.5">
              {busy
                ? (<><span className="w-4 h-4 rounded-full border-2 border-bg/30 border-t-bg spin" /> {mode === "setup" ? "ХЕШИРОВАНИЕ PBKDF2…" : "ПРОВЕРКА…"}</>)
                : (<>{mode === "setup" ? "СОЗДАТЬ АДМИНИСТРАТОРА" : <>ВОЙТИ В КОНСОЛЬ <Icon n="chevR" size={15} /></>}</>)}
            </button>
          </form>

          {mode === "setup" ? (
            <div className="mt-6 card px-4 py-3 text-[12px] text-mut leading-relaxed flex gap-2.5">
              <span className="text-amber mt-0.5 shrink-0"><Icon n="shield" size={15} /></span>
              Учётная запись сохраняется локально в этом браузере. В боевом развёртывании пользователи живут в PostgreSQL,
              а первый администратор создаётся при миграциях — см. раздел «Установка консоли» документации.
            </div>
          ) : (
            <p className="mt-6 text-center font-mono text-[10.5px] text-dim tracking-wider">TLS 1.3 · PBKDF2-SHA256 · аудит действий · v2.4.1</p>
          )}
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
