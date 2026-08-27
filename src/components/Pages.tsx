import { useMemo, useState } from "react";
import { ROLE_META, nowTime, type AuditEvent, type User } from "../data";
import { Icon, Modal, SectionHead, useToast, type IconName } from "./ui";

// ─── Пользователи ───────────────────────────────────────────────────────────
export function UsersPage({ users, onChange, logEvent, selfLogin }: {
  users: User[];
  onChange: (u: User[]) => void;
  logEvent: (t: AuditEvent["type"], sv: AuditEvent["severity"], x: string) => void;
  selfLogin: string;
}) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ login: "", name: "", role: "operator" as User["role"] });
  const [newPass, setNewPass] = useState<string | null>(null);
  const toast = useToast();

  const toggle = (u: User) => {
    const next = users.map((x) => (x.id === u.id ? { ...x, status: x.status === "active" ? "disabled" as const : "active" as const } : x));
    onChange(next);
    const on = u.status !== "active";
    toast(`Пользователь ${u.login} ${on ? "активирован" : "заблокирован"}`, on ? "ok" : "info");
    logEvent("user", on ? "ok" : "warn", `${u.login}: учётная запись ${on ? "активирована" : "заблокирована"} (admin)`);
  };

  const remove = (u: User) => {
    onChange(users.filter((x) => x.id !== u.id));
    toast(`Пользователь ${u.login} удалён`, "info");
    logEvent("user", "warn", `${u.login}: учётная запись удалена (admin)`);
  };

  const create = () => {
    if (!form.login.trim() || !form.name.trim()) { toast("Заполните логин и имя", "err"); return; }
    if (users.some((u) => u.login === form.login.trim())) { toast("Такой логин уже существует", "err"); return; }
    const p = "kt-" + Math.random().toString(36).slice(2, 10);
    onChange([...users, { id: "u" + Date.now(), login: form.login.trim(), name: form.name.trim(), role: form.role, status: "active", lastLogin: "ещё не входил" }]);
    setNewPass(p);
    logEvent("user", "ok", `создан пользователь ${form.login.trim()} (роль: ${ROLE_META[form.role].label})`);
    toast(`Пользователь ${form.login.trim()} создан`, "ok");
    setForm({ login: "", name: "", role: "operator" });
  };

  return (
    <div className="space-y-5">
      <SectionHead title="Пользователи и роли" sub="Доступ к консоли: argon2id-хэши паролей, сессии 12 ч, 2FA для администраторов"
        right={
          <button onClick={() => { setModal(true); setNewPass(null); }} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber text-bg font-display font-bold text-[12.5px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.97] transition-all cursor-pointer">
            <Icon n="plus" size={14} /> ДОБАВИТЬ
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3.5 max-w-xl">
        {([
          ["Всего учётных записей", users.length, "users", "#56c8e8"],
          ["Администраторы", users.filter((u) => u.role === "admin").length, "shield", "#ffb224"],
          ["Активные сейчас", users.filter((u) => u.status === "active").length, "check", "#3ecf8e"],
        ] as [string, number, IconName, string][]).map(([l, v, ic, c], i) => (
          <div key={l} className="card p-4 anim-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between"><span className="lbl">{l}</span><span style={{ color: c }}><Icon n={ic} size={15} /></span></div>
            <div className="mt-1.5 font-mono font-bold text-[26px] tnum" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden anim-rise" style={{ animationDelay: ".15s" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left lbl border-b border-line bg-panel/60">
              <th className="px-4 py-3 font-medium">Пользователь</th>
              <th className="px-3 py-3 font-medium">Роль</th>
              <th className="px-3 py-3 font-medium hidden md:table-cell">Последний вход</th>
              <th className="px-3 py-3 font-medium">Статус</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const rm = ROLE_META[u.role];
              return (
                <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-raise/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-lg border border-line bg-panel2 flex items-center justify-center font-display font-bold text-[13px]" style={{ color: rm.color }}>
                        {u.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </span>
                      <div>
                        <div className="font-medium">{u.name} {u.login === selfLogin && <span className="text-[10px] font-mono text-ok border border-ok/30 rounded px-1 py-0.5 ml-1">вы</span>}</div>
                        <div className="font-mono text-[11.5px] text-dim">@{u.login}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select value={u.role} disabled={u.login === selfLogin}
                      onChange={(e) => {
                        const role = e.target.value as User["role"];
                        onChange(users.map((x) => (x.id === u.id ? { ...x, role } : x)));
                        logEvent("user", "info", `${u.login}: роль изменена на «${ROLE_META[role].label}»`);
                        toast(`Роль ${u.login}: ${ROLE_META[role].label}`, "info");
                      }}
                      className="bg-panel border rounded-md px-2 py-1.5 font-mono text-[12px] outline-none cursor-pointer disabled:opacity-60"
                      style={{ color: rm.color, borderColor: rm.color + "55" }}>
                      {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k} className="text-ink">{v.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] text-mut hidden md:table-cell">{u.lastLogin}</td>
                  <td className="px-3 py-3">
                    <span className={`font-mono text-[11px] px-2 py-1 rounded-md border ${u.status === "active" ? "text-ok border-ok/30 bg-ok/8" : "text-mut border-line bg-panel"}`}>
                      {u.status === "active" ? "активен" : "заблокирован"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => toggle(u)} disabled={u.login === selfLogin}
                        className="px-2.5 py-1.5 rounded-md border border-line text-[11.5px] font-mono text-mut hover:text-amber hover:border-amber/50 transition-colors cursor-pointer disabled:opacity-30">
                        {u.status === "active" ? "заблокировать" : "активировать"}
                      </button>
                      <button onClick={() => remove(u)} disabled={u.login === selfLogin}
                        className="p-1.5 rounded-md border border-line text-mut hover:text-bad hover:border-bad/50 transition-colors cursor-pointer disabled:opacity-30"><Icon n="trash" size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Новый пользователь" icon="users" w={460}>
        {!newPass ? (
          <div className="space-y-3.5">
            {([["login", "Логин (латиница)"], ["name", "Имя и фамилия"]] as const).map(([k, l]) => (
              <label key={k} className="block">
                <span className="lbl block mb-1.5">{l}</span>
                <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 text-[13.5px] font-mono focus:border-amber/60 outline-none transition-colors" />
              </label>
            ))}
            <label className="block">
              <span className="lbl block mb-1.5">Роль</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}
                className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 text-[13.5px] outline-none focus:border-amber/60 cursor-pointer">
                {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <button onClick={create} className="w-full py-2.5 rounded-lg bg-amber text-bg font-display font-bold text-[13px] tracking-wide hover:bg-[#ffc14d] active:scale-[0.98] transition-all cursor-pointer">
              СОЗДАТЬ И СГЕНЕРИРОВАТЬ ПАРОЛЬ
            </button>
          </div>
        ) : (
          <div className="text-center">
            <span className="inline-flex w-12 h-12 rounded-full bg-ok/12 border border-ok/30 text-ok items-center justify-center mb-3"><Icon n="check" size={22} /></span>
            <p className="text-[13.5px] text-mut">Пользователь создан. Покажите ему временный пароль <b className="text-ink">один раз</b> — он потребует смены при первом входе:</p>
            <div className="mt-3 font-mono text-[20px] font-bold text-amber bg-[#0a0e15] border border-line rounded-lg py-3 select-all">{newPass}</div>
            <button onClick={() => { setModal(false); }} className="mt-4 px-5 py-2.5 rounded-lg border border-line text-[13px] text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer">Готово</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Аудит ──────────────────────────────────────────────────────────────────
const SEV_META: Record<AuditEvent["severity"], { l: string; c: string }> = {
  ok: { l: "успех", c: "#3ecf8e" }, info: { l: "инфо", c: "#56c8e8" }, warn: { l: "внимание", c: "#ffb224" }, crit: { l: "критично", c: "#f0566a" },
};

export function AuditPage({ events }: { events: AuditEvent[] }) {
  const [sev, setSev] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const toast = useToast();

  const filtered = useMemo(() => events.filter((e) => (sev === "all" || e.severity === sev) && (type === "all" || e.type === type)), [events, sev, type]);

  const exportCsv = () => {
    const rows = [["time", "type", "severity", "text"], ...filtered.map((e) => [e.time, e.type, e.severity, `"${e.text.replace(/"/g, '""')}"`])];
    const blob = new Blob(["\uFEFF" + rows.map((r) => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kontur-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Экспортировано ${filtered.length} записей в CSV`, "ok");
  };

  return (
    <div className="space-y-5">
      <SectionHead title="Журнал аудита" sub="Все действия операторов, команд агента и системные события · неизменяемый append-only лог"
        right={
          <button onClick={exportCsv} className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-line text-[12.5px] font-mono text-mut hover:text-ok hover:border-ok/50 transition-colors cursor-pointer">
            <Icon n="download" size={14} /> ЭКСПОРТ CSV
          </button>
        }
      />
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {[{ v: "all", l: "Все уровни" }, ...Object.entries(SEV_META).map(([v, m]) => ({ v, l: m.l }))].map((o) => (
            <button key={o.v} onClick={() => setSev(o.v)}
              className={`px-3 py-1.5 rounded-lg border text-[12px] font-mono transition-all cursor-pointer ${sev === o.v ? "border-amber/60 bg-amber/12 text-amber" : "border-line text-mut hover:border-line2 hover:text-ink"}`}>
              {o.l}
            </button>
          ))}
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="bg-panel border border-line rounded-lg px-3 py-1.5 text-[12px] font-mono text-mut outline-none cursor-pointer">
          <option value="all">Все типы</option>
          {["auth", "exec", "agent", "service", "user", "system"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="ml-auto font-mono text-[11.5px] text-dim self-center">{filtered.length} записей · поток live</span>
      </div>

      <div className="card overflow-hidden anim-rise">
        <div className="max-h-[62vh] overflow-y-auto divide-y divide-line/50">
          {filtered.map((e, i) => {
            const sv = SEV_META[e.severity];
            return (
              <div key={e.id} className={`flex items-center gap-3.5 px-4 py-3 hover:bg-raise/40 transition-colors ${i === 0 ? "anim-rise" : ""}`} style={{ boxShadow: `inset 3px 0 0 ${sv.c}` }}>
                <span className="font-mono text-[11.5px] text-dim tnum w-16 shrink-0">{e.time}</span>
                <span className="font-mono text-[10.5px] px-2 py-0.5 rounded border w-20 text-center shrink-0" style={{ color: sv.c, borderColor: sv.c + "44", background: sv.c + "0d" }}>{e.type}</span>
                <span className="text-[13px] text-ink/90 leading-snug">{e.text}</span>
                <span className="ml-auto font-mono text-[10.5px] shrink-0 hidden sm:block" style={{ color: sv.c }}>{sv.l}</span>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="p-10 text-center text-mut font-mono text-[12.5px]">Записей по выбранным фильтрам нет</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Настройки ──────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full border transition-all cursor-pointer relative ${on ? "bg-ok/25 border-ok/50" : "bg-panel border-line2"}`}>
      <span className={`absolute top-[3px] w-4 h-4 rounded-full transition-all ${on ? "left-[24px] bg-ok" : "left-[3px] bg-dim"}`} />
    </button>
  );
}

export function SettingsPage({ logEvent }: { logEvent: (t: AuditEvent["type"], sv: AuditEvent["severity"], x: string) => void }) {
  const toast = useToast();
  const [opt, setOpt] = useState({ twofa: true, whitelist: false, autoApprove: false, alerts: true });
  const [retention, setRetention] = useState(30);
  const [apiKey, setApiKey] = useState("kt_live_9f7c44d0b18e6a23c2e7f3a9d41b9c2e");

  const set = (k: keyof typeof opt) => (v: boolean) => {
    setOpt((o) => ({ ...o, [k]: v }));
    const names: Record<string, string> = { twofa: "2FA для администраторов", whitelist: "IP-allowlist операторов", autoApprove: "Автоподключение новых агентов", alerts: "Алерты в Telegram" };
    toast(`${names[k]}: ${v ? "включено" : "выключено"}`, "info");
    logEvent("system", "info", `настройка «${names[k]}» ${v ? "включена" : "выключена"} (admin)`);
  };

  const rotate = () => {
    const k = "kt_live_" + Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
    setApiKey(k);
    toast("API-ключ пересоздан, старый отозван немедленно", "ok");
    logEvent("auth", "warn", "ротация API-ключа консоли (admin)");
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <SectionHead title="Настройки консоли" sub="Параметры применяются к ядру kontur-core и вступают в силу без перезапуска" />

      <div className="card divide-y divide-line/60 anim-rise">
        {([
          ["twofa", "Двухфакторная аутентификация", "TOTP для роли admin, обязательна при входе с новых устройств"],
          ["whitelist", "IP-allowlist операторов", "Принимать сессии только из подсетей 10.0.0.0/8 и 192.168.10.0/24"],
          ["autoApprove", "Автоподключение агентов", "Новые агенты с валидной подписью токена попадают в реестр без подтверждения"],
          ["alerts", "Алерты в Telegram", "Критичные события журнала дублируются в канал дежурной смены"],
        ] as [keyof typeof opt, string, string][]).map(([k, t, d], i) => (
          <div key={k} className="flex items-center gap-4 px-5 py-4 anim-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex-1">
              <div className="text-[13.5px] font-medium">{t}</div>
              <div className="text-[12px] text-mut mt-0.5">{d}</div>
            </div>
            <Toggle on={opt[k]} onChange={set(k)} />
          </div>
        ))}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[13.5px] font-medium">Ретенция телеметрии</div>
              <div className="text-[12px] text-mut mt-0.5">Срок хранения детальных метрик в TimescaleDB до агрегации</div>
            </div>
            <span className="font-mono font-bold text-amber text-[16px] tnum">{retention} дн.</span>
          </div>
          <input type="range" min={7} max={90} value={retention} onChange={(e) => setRetention(+e.target.value)}
            onMouseUp={() => { toast(`Ретенция телеметрии: ${retention} дней`, "info"); logEvent("system", "info", `ретенция телеметрии изменена на ${retention} дн.`); }}
            className="w-full accent-[#ffb224] cursor-pointer" />
          <div className="flex justify-between font-mono text-[10.5px] text-dim mt-1"><span>7</span><span>90</span></div>
        </div>
      </div>

      <div className="card p-5 anim-rise" style={{ animationDelay: ".15s" }}>
        <div className="flex items-center gap-2 mb-1"><Icon n="key" size={15} className="text-amber" /><h3 className="font-display font-semibold text-[15px]">API-ключ консоли</h3></div>
        <p className="text-[12px] text-mut mb-3">Используется CI/CD и внешними интеграциями (scope: telemetry:read, exec:deny).</p>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-[240px] font-mono text-[12px] text-ok bg-[#0a0e15] border border-line rounded-lg px-3 py-2.5 truncate">{apiKey}</code>
          <button onClick={() => { navigator.clipboard?.writeText(apiKey).catch(() => {}); toast("Ключ скопирован", "info"); }}
            className="px-3 py-2.5 rounded-lg border border-line text-mut hover:text-amber hover:border-amber/50 transition-colors cursor-pointer"><Icon n="copy" size={15} /></button>
          <button onClick={rotate}
            className="px-3.5 py-2.5 rounded-lg border border-bad/40 text-bad font-mono text-[12px] hover:bg-bad/10 transition-colors cursor-pointer flex items-center gap-2">
            <Icon n="refresh" size={14} /> ротация
          </button>
        </div>
      </div>

      <div className="card p-5 anim-rise font-mono text-[12px] text-mut" style={{ animationDelay: ".25s" }}>
        <div className="lbl mb-2.5">О системе</div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          <span>kontur-core</span><span className="text-ink text-right">v2.4.1 (node 20.11)</span>
          <span>kontur-agent</span><span className="text-ink text-right">v1.7.2 (go 1.22, static)</span>
          <span>транспорт</span><span className="text-ink text-right">HTTPS + WSS, TLS 1.3</span>
          <span>БД</span><span className="text-ink text-right">PostgreSQL 16 + TimescaleDB</span>
          <span>сборка консоли</span><span className="text-ink text-right">{nowTime()}, uptime 14 д 06 ч</span>
        </div>
      </div>
    </div>
  );
}
