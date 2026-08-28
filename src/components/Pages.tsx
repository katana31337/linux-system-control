import { useEffect, useMemo, useState } from "react";
import { ROLE_META, genToken, loadSettings, saveSettings, type AuditEvent, type Role, type StoredUser } from "../data";
import { CopyBtn, Icon, Modal, SectionHead, useToast, type IconName } from "./ui";

// ─── Пользователи ───────────────────────────────────────────────────────────
export function UsersPage({ users, me, onAdd, onRole, onRemove }: {
  users: StoredUser[];
  me: string;
  onAdd: (login: string, pw: string, role: Role) => Promise<string | null>;
  onRole: (id: string, role: Role) => void;
  onRemove: (id: string) => void;
}) {
  const [modal, setModal] = useState(false);
  const [confirmDel, setConfirmDel] = useState<StoredUser | null>(null);
  const [form, setForm] = useState({ login: "", pw: "", role: "operator" as Role });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const create = async () => {
    setErr("");
    const lg = form.login.trim();
    if (!/^[a-z0-9._-]{3,24}$/i.test(lg)) { setErr("Логин: 3–24 символа, латиница, цифры, . _ -"); return; }
    if (form.pw.length < 8) { setErr("Пароль не короче 8 символов"); return; }
    setBusy(true);
    const res = await onAdd(lg, form.pw, form.role);
    setBusy(false);
    if (res) { setErr(res); return; }
    toast(`Пользователь «${lg}» создан`, "ok");
    setForm({ login: "", pw: "", role: "operator" });
    setModal(false);
  };

  const tryRemove = (u: StoredUser) => {
    if (u.login === me) { toast("Нельзя удалить собственную учётную запись", "err"); return; }
    if (u.role === "admin" && users.filter((x) => x.role === "admin").length <= 1) {
      toast("В системе должен остаться хотя бы один администратор", "err"); return;
    }
    setConfirmDel(u);
  };

  const fieldCls = "w-full bg-panel border border-line rounded-lg px-3.5 py-2.5 text-[13.5px] font-mono placeholder:text-dim focus:border-amber/60 focus:bg-panel2 transition-colors outline-none";

  return (
    <div className="space-y-5 max-w-5xl">
      <SectionHead title="Пользователи" sub="Учётные записи операторов консоли · пароли хранятся как хеши PBKDF2-SHA256"
        right={
          <button onClick={() => { setModal(true); setErr(""); }}
            className="px-3.5 py-2 rounded-lg bg-amber text-bg font-display font-bold text-[12.5px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer flex items-center gap-2">
            <Icon n="plus" size={14} /> ДОБАВИТЬ
          </button>
        } />

      <div className="card overflow-hidden anim-rise">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left lbl border-b border-line bg-panel/60">
              <th className="px-4 py-3 font-medium">Логин</th>
              <th className="px-3 py-3 font-medium">Роль</th>
              <th className="px-3 py-3 font-medium hidden md:table-cell">Права</th>
              <th className="px-3 py-3 font-medium hidden lg:table-cell">Создан</th>
              <th className="px-3 py-3 font-medium hidden lg:table-cell">Последний вход</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-raise/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-[13px] uppercase"
                      style={{ color: ROLE_META[u.role].color, background: ROLE_META[u.role].color + "14", border: `1px solid ${ROLE_META[u.role].color}40` }}>
                      {u.login.slice(0, 2)}
                    </span>
                    <div>
                      <div className="font-mono font-medium">{u.login}</div>
                      {u.login === me && <div className="font-mono text-[10px] text-amber">это вы</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <select value={u.role} disabled={u.login === me}
                    onChange={(e) => { onRole(u.id, e.target.value as Role); toast(`Роль «${u.login}» → ${ROLE_META[e.target.value as Role].label}`, "info"); }}
                    className="bg-panel border border-line rounded-md px-2 py-1.5 font-mono text-[11.5px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:border-amber/60"
                    style={{ color: ROLE_META[u.role].color }}>
                    {(Object.keys(ROLE_META) as Role[]).map((r) => (
                      <option key={r} value={r}>{ROLE_META[r].label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3 text-[12px] text-mut hidden md:table-cell max-w-[260px]">{ROLE_META[u.role].desc}</td>
                <td className="px-3 py-3 font-mono text-[11.5px] text-mut hidden lg:table-cell">{new Date(u.createdAt).toLocaleDateString("ru-RU")}</td>
                <td className="px-3 py-3 font-mono text-[11.5px] text-mut hidden lg:table-cell">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "ещё не входил"}
                </td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => tryRemove(u)}
                    className="p-1.5 rounded-md text-mut hover:text-bad hover:bg-bad/10 transition-colors cursor-pointer" title="Удалить">
                    <Icon n="x" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 1 && (
          <div className="px-4 py-3 border-t border-line bg-panel/50 text-[11.5px] text-dim font-mono">
            Единственный администратор: защита от случайной блокировки консоли включена.
          </div>
        )}
      </div>

      {/* ролевая матрица */}
      <div className="card p-4 anim-rise" style={{ animationDelay: ".1s" }}>
        <div className="lbl mb-3">Матрица доступа</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] font-mono min-w-[520px]">
            <thead>
              <tr className="text-dim">
                <th className="text-left font-medium pb-2">Возможность</th>
                {(Object.keys(ROLE_META) as Role[]).map((r) => (
                  <th key={r} className="pb-2 px-2 font-medium" style={{ color: ROLE_META[r].color }}>{ROLE_META[r].label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                ["Метрики и статусы агентов", true, true, true],
                ["Терминал и команды (exec)", true, true, false],
                ["Сервисы и файлы", true, true, false],
                ["Подключение и удаление агентов", true, false, false],
                ["Пользователи и настройки", true, false, false],
              ] as [string, boolean, boolean, boolean][]).map(([f, a, o, v]) => (
                <tr key={f} className="border-t border-line/50">
                  <td className="py-2 text-mut">{f}</td>
                  {[a, o, v].map((x, i) => (
                    <td key={i} className="py-2 px-2 text-center">
                      {x ? <Icon n="check" size={13} className="text-ok inline" /> : <span className="text-dim">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Новый пользователь" w={440}>
        <div className="space-y-4">
          <label className="block">
            <span className="lbl block mb-1.5">Логин</span>
            <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="operator-1" className={fieldCls} autoFocus />
          </label>
          <label className="block">
            <span className="lbl block mb-1.5">Пароль (мин. 8 символов)</span>
            <div className="flex gap-2">
              <input value={form.pw} onChange={(e) => setForm({ ...form, pw: e.target.value })} type="text" placeholder="••••••••" className={fieldCls} />
              <button onClick={() => setForm({ ...form, pw: genToken(16) })} title="Сгенерировать"
                className="px-3 rounded-lg border border-line text-mut hover:text-amber hover:border-amber/50 transition-colors cursor-pointer">
                <Icon n="refresh" size={15} />
              </button>
            </div>
          </label>
          <div>
            <span className="lbl block mb-1.5">Роль</span>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROLE_META) as Role[]).map((r) => (
                <button key={r} onClick={() => setForm({ ...form, role: r })}
                  className={`px-2 py-2.5 rounded-lg border text-[11.5px] font-mono transition-all cursor-pointer ${form.role === r ? "" : "border-line text-mut hover:border-line2"}`}
                  style={form.role === r ? { borderColor: ROLE_META[r].color, color: ROLE_META[r].color, background: ROLE_META[r].color + "12" } : undefined}>
                  {ROLE_META[r].label}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-dim mt-2">{ROLE_META[form.role].desc}</p>
          </div>
          {err && <div className="flex items-center gap-2 text-[12.5px] text-bad bg-bad/8 border border-bad/25 rounded-lg px-3 py-2.5"><Icon n="alert" size={14} /> {err}</div>}
          <div className="flex justify-end gap-2.5 pt-1">
            <button onClick={() => setModal(false)} className="px-4 py-2.5 rounded-lg border border-line text-[13px] text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer">Отмена</button>
            <button onClick={create} disabled={busy}
              className="px-5 py-2.5 rounded-lg bg-amber text-bg font-display font-bold text-[13px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2">
              {busy && <span className="w-3.5 h-3.5 rounded-full border-2 border-bg/30 border-t-bg spin" />} СОЗДАТЬ
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Удаление пользователя" w={420} icon="alert">
        {confirmDel && (
          <div className="space-y-4">
            <p className="text-[13.5px] text-mut leading-relaxed">
              Удалить учётную запись <span className="font-mono text-ink">{confirmDel.login}</span>?
              Активные сессии пользователя будут закрыты, действие попадёт в аудит.
            </p>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2.5 rounded-lg border border-line text-[13px] text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer">Отмена</button>
              <button onClick={() => { onRemove(confirmDel.id); toast(`Пользователь «${confirmDel.login}» удалён`, "info"); setConfirmDel(null); }}
                className="px-5 py-2.5 rounded-lg bg-bad text-bg font-display font-bold text-[13px] tracking-wide hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer">
                УДАЛИТЬ
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Аудит ──────────────────────────────────────────────────────────────────
const SEV: Record<AuditEvent["severity"], { label: string; c: string }> = {
  ok: { label: "ok", c: "#3ecf8e" }, info: { label: "info", c: "#56c8e8" },
  warn: { label: "warn", c: "#ffb224" }, crit: { label: "crit", c: "#f0566a" },
};
const EV_ICON: Record<AuditEvent["type"], IconName> = { auth: "lock", exec: "terminal", agent: "box", service: "gear", user: "users", system: "activity" };

export function AuditPage({ events }: { events: AuditEvent[] }) {
  const [sev, setSev] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const toast = useToast();

  const filtered = useMemo(
    () => events.filter((e) => (sev === "all" || e.severity === sev) && (type === "all" || e.type === type)),
    [events, sev, type]
  );

  const exportCsv = () => {
    const rows = [["time", "user", "type", "severity", "text"], ...filtered.map((e) => [e.time, e.user, e.type, e.severity, `"${e.text.replace(/"/g, '""')}"`].join(","))];
    const blob = new Blob(["\uFEFF" + rows.map((r, i) => (i === 0 ? r : r)).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kontur-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Экспортировано ${filtered.length} записей`, "ok");
  };

  const chip = (v: string, label: string, cur: string, set: (x: string) => void) => (
    <button key={v} onClick={() => set(v)}
      className={`px-2.5 py-1.5 rounded-md text-[11.5px] font-mono border transition-colors cursor-pointer ${cur === v ? "border-line2 text-ink bg-raise" : "border-line text-mut hover:border-line2"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <SectionHead title="Журнал аудита" sub="Append-only: каждое действие оператора, агента и системы · ротация 30 дней"
        right={
          <button onClick={exportCsv} disabled={!filtered.length}
            className="px-3.5 py-2 rounded-lg border border-line text-[12.5px] font-mono text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-2">
            <Icon n="download" size={14} /> CSV · {filtered.length}
          </button>
        } />

      <div className="flex flex-wrap items-center gap-2">
        <span className="lbl mr-1">уровень:</span>
        {chip("all", "все", sev, setSev)}
        {(["ok", "info", "warn", "crit"] as const).map((s) => chip(s, SEV[s].label, sev, setSev))}
        <span className="w-px h-5 bg-line mx-1" />
        <span className="lbl mr-1">тип:</span>
        {chip("all", "все", type, setType)}
        {(["auth", "exec", "agent", "service", "user", "system"] as const).map((t) => chip(t, t, type, setType))}
      </div>

      <div className="card overflow-hidden anim-rise">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Icon n="shield" size={26} className="text-dim mx-auto mb-3" />
            <div className="font-display font-semibold text-[15px] mb-1">Записей нет</div>
            <p className="text-[12.5px] text-mut">Журнал наполняется реальными действиями: входами, командами, подключениями агентов.</p>
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left lbl border-b border-line bg-panel/60">
                <th className="px-4 py-2.5 font-medium w-24">Время</th>
                <th className="px-3 py-2.5 font-medium w-28">Кто</th>
                <th className="px-3 py-2.5 font-medium w-24">Тип</th>
                <th className="px-3 py-2.5 font-medium">Событие</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-line/50 last:border-0 hover:bg-raise/40 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[11.5px] text-mut whitespace-nowrap">{e.time}</td>
                  <td className="px-3 py-2.5 font-mono text-[11.5px]">{e.user}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] px-1.5 py-0.5 rounded border"
                      style={{ color: SEV[e.severity].c, borderColor: SEV[e.severity].c + "44", background: SEV[e.severity].c + "10" }}>
                      <Icon n={EV_ICON[e.type]} size={11} /> {e.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink/85">{e.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Настройки ──────────────────────────────────────────────────────────────
interface Settings { twofa: boolean; whitelist: boolean; alerts: boolean; retention: number; apiKey: string; }

export function SettingsPage({ me, counts, onChangePassword, onReset }: {
  me: string;
  counts: { agents: number; users: number; audit: number };
  onChangePassword: (cur: string, next: string) => Promise<string | null>;
  onReset: () => void;
}) {
  const toast = useToast();
  const [opt, setOpt] = useState<Settings>(() => loadSettings<Settings>({
    twofa: false, whitelist: false, alerts: true, retention: 30, apiKey: genToken(24),
  }));
  const [pwForm, setPwForm] = useState({ cur: "", next: "" });
  const [pwErr, setPwErr] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => { saveSettings(opt); }, [opt]);

  const toggle = (k: keyof Settings) => {
    const v = !opt[k];
    setOpt({ ...opt, [k]: v });
    toast(`${k === "twofa" ? "Двухфакторная аутентификация" : k === "whitelist" ? "IP-allowlist" : "Алерты"}: ${v ? "включено" : "выключено"}`, v ? "ok" : "info");
  };

  const changePw = async () => {
    setPwErr("");
    if (pwForm.next.length < 8) { setPwErr("Новый пароль не короче 8 символов"); return; }
    setPwBusy(true);
    const res = await onChangePassword(pwForm.cur, pwForm.next);
    setPwBusy(false);
    if (res) { setPwErr(res); return; }
    setPwForm({ cur: "", next: "" });
    toast("Пароль изменён", "ok");
  };

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick}
      className={`w-10 h-[22px] rounded-full p-[3px] transition-colors cursor-pointer ${on ? "bg-ok/80" : "bg-[#26314a]"}`}>
      <span className={`block w-4 h-4 rounded-full bg-ink transition-transform ${on ? "translate-x-[18px]" : ""}`} />
    </button>
  );

  const Row = ({ title, sub, right }: { title: string; sub: string; right: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-line/60 last:border-0">
      <div>
        <div className="text-[13.5px] font-medium">{title}</div>
        <div className="text-[11.5px] text-mut mt-0.5">{sub}</div>
      </div>
      {right}
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <SectionHead title="Настройки" sub="Профиль, безопасность консоли и данные веб-сборки" />

      <div className="grid md:grid-cols-3 gap-3.5">
        {([
          ["server", "Агентов в реестре", String(counts.agents), "#3ecf8e"],
          ["users", "Пользователей", String(counts.users), "#ffb224"],
          ["shield", "Записей аудита", String(counts.audit), "#56c8e8"],
        ] as [IconName, string, string, string][]).map(([ic, l, v, c], i) => (
          <div key={l} className="card p-4 anim-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-md" style={{ color: c, background: c + "14", border: `1px solid ${c}38` }}><Icon n={ic} size={14} /></span>
              <span className="lbl">{l}</span>
            </div>
            <div className="mt-2 font-mono font-bold text-[26px] tnum" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* профиль */}
      <div className="card p-5 anim-rise" style={{ animationDelay: ".12s" }}>
        <div className="lbl mb-3 flex items-center gap-2"><Icon n="lock" size={13} /> профиль · {me}</div>
        <div className="grid md:grid-cols-2 gap-4 max-w-xl">
          <label className="block">
            <span className="lbl block mb-1.5">Текущий пароль</span>
            <input type="password" value={pwForm.cur} onChange={(e) => setPwForm({ ...pwForm, cur: e.target.value })}
              placeholder="••••••••" className="w-full bg-panel border border-line rounded-lg px-3.5 py-2.5 text-[13.5px] font-mono placeholder:text-dim focus:border-amber/60 outline-none" />
          </label>
          <label className="block">
            <span className="lbl block mb-1.5">Новый пароль (мин. 8)</span>
            <input type="password" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
              placeholder="••••••••" className="w-full bg-panel border border-line rounded-lg px-3.5 py-2.5 text-[13.5px] font-mono placeholder:text-dim focus:border-amber/60 outline-none" />
          </label>
        </div>
        {pwErr && <div className="mt-3 flex items-center gap-2 text-[12.5px] text-bad bg-bad/8 border border-bad/25 rounded-lg px-3 py-2.5 max-w-xl"><Icon n="alert" size={14} /> {pwErr}</div>}
        <button onClick={changePw} disabled={pwBusy || !pwForm.cur || !pwForm.next}
          className="mt-4 px-4 py-2.5 rounded-lg bg-amber text-bg font-display font-bold text-[12.5px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          {pwBusy && <span className="w-3.5 h-3.5 rounded-full border-2 border-bg/30 border-t-bg spin" />} СМЕНИТЬ ПАРОЛЬ
        </button>
      </div>

      {/* безопасность консоли */}
      <div className="card p-5 anim-rise" style={{ animationDelay: ".18s" }}>
        <div className="lbl mb-1 flex items-center gap-2"><Icon n="shield" size={13} /> безопасность консоли</div>
        <Row title="Двухфакторная аутентификация" sub="TOTP-код при входе для всех ролей" right={<Toggle on={opt.twofa} onClick={() => toggle("twofa")} />} />
        <Row title="IP-allowlist для входа" sub="Принимать сессии только из корпоративной сети" right={<Toggle on={opt.whitelist} onClick={() => toggle("whitelist")} />} />
        <Row title="Алерты в Telegram" sub="Критичные события: офлайн агента, диск > 90%, перебор паролей" right={<Toggle on={opt.alerts} onClick={() => toggle("alerts")} />} />
        <Row title="Ротация API-ключа" sub="Ключ для внешних интеграций (webhook, CI)"
          right={
            <div className="flex items-center gap-2">
              <code className="font-mono text-[11px] text-mut bg-panel border border-line rounded px-2 py-1 hidden sm:block">{opt.apiKey.slice(0, 8)}…</code>
              <CopyBtn text={opt.apiKey} />
              <button onClick={() => { setOpt({ ...opt, apiKey: genToken(24) }); toast("API-ключ пересоздан, старый отозван", "ok"); }}
                className="px-2.5 py-1.5 rounded-md border border-line text-[11.5px] font-mono text-mut hover:text-amber hover:border-amber/50 transition-colors cursor-pointer">
                ротировать
              </button>
            </div>
          } />
      </div>

      {/* данные */}
      <div className="card p-5 anim-rise border-bad/25" style={{ animationDelay: ".24s" }}>
        <div className="lbl mb-1 flex items-center gap-2 text-bad"><Icon n="alert" size={13} /> опасная зона</div>
        <Row title="Сбросить консоль"
          sub="Удалить пользователей, сессию и настройки этого браузера. Реестр агентов в боевой системе живёт в PostgreSQL и не затрагивается."
          right={
            <button onClick={() => setConfirmReset(true)}
              className="px-3.5 py-2 rounded-lg border border-bad/40 text-[12.5px] font-mono text-bad hover:bg-bad/10 transition-colors cursor-pointer">
              сбросить
            </button>
          } />
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Полный сброс" w={420} icon="alert">
        <div className="space-y-4">
          <p className="text-[13.5px] text-mut leading-relaxed">
            Будут удалены все пользователи (включая <span className="font-mono text-ink">{me}</span>), сессия и настройки.
            После сброса консоль вернётся к экрану первичной настройки. Продолжить?
          </p>
          <div className="flex justify-end gap-2.5">
            <button onClick={() => setConfirmReset(false)} className="px-4 py-2.5 rounded-lg border border-line text-[13px] text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer">Отмена</button>
            <button onClick={() => { setConfirmReset(false); onReset(); }}
              className="px-5 py-2.5 rounded-lg bg-bad text-bg font-display font-bold text-[13px] tracking-wide hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer">
              ДА, СБРОСИТЬ
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
