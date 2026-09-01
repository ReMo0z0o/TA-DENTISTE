// Briques d'interface communes, dimensionnées pour le pouce sur téléphone
// comme pour la souris au bureau.

export function Label({ children, hint, htmlFor }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium leading-snug text-slate-800">
        {children}
      </label>
      {hint && <div className="text-[11.5px] leading-snug text-slate-500">{hint}</div>}
    </div>
  );
}

export function Choice({ label, hint, options, value, onChange, auto }) {
  return (
    <div className="mb-4">
      {label && <Label hint={hint}>{label}</Label>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? "" : o)}
              className={
                "min-h-[42px] rounded-lg border px-3 py-2 text-[13px] transition-colors " +
                (on
                  ? "border-teal-800 bg-teal-800 font-medium text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 active:bg-slate-100")
              }
            >
              {o}
            </button>
          );
        })}
      </div>
      {auto && value && <AutoHint />}
    </div>
  );
}

export function AutoHint({ children = "Rempli automatiquement — corrige si besoin." }) {
  return <div className="mt-1 text-[11.5px] text-teal-700">↳ {children}</div>;
}

export function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  auto,
  list,
  suffix,
}) {
  return (
    <div className="mb-4">
      {label && <Label hint={hint}>{label}</Label>}
      <div className="flex items-stretch gap-2">
        <input
          type={type}
          inputMode={inputMode}
          value={value ?? ""}
          placeholder={placeholder}
          list={list}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        />
        {suffix}
      </div>
      {auto && value && <AutoHint />}
    </div>
  );
}

export function Area({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="mb-4">
      {label && <Label>{label}</Label>}
      <textarea
        rows={rows}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
      />
    </div>
  );
}

export function Select({ label, value, onChange, options, hint, compact }) {
  return (
    <div className={compact ? "" : "mb-4"}>
      {label && <Label hint={hint}>{label}</Label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-[13px] text-slate-900 focus:border-teal-700 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Block({ title, tone = "plain", children, action }) {
  const tones = {
    plain: "border-slate-200 bg-white",
    yes: "border-teal-200 bg-teal-50/70",
    no: "border-amber-200 bg-amber-50/70",
    warn: "border-red-200 bg-red-50/70",
  };
  return (
    <section className={"mb-4 rounded-xl border p-3 " + tones[tone]}>
      {(title || action) && (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          {title && <h2 className="text-[12px] font-semibold tracking-wide text-slate-600 uppercase">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Bouton({ children, onClick, variant = "primary", disabled, className = "", type = "button", title }) {
  const styles = {
    primary: "bg-teal-800 text-white active:bg-teal-900 disabled:bg-slate-300",
    ghost: "border border-slate-300 bg-white text-slate-800 active:bg-slate-100 disabled:text-slate-400",
    danger: "border border-red-300 bg-white text-red-700 active:bg-red-50",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] rounded-lg px-4 py-2.5 text-[14px] font-medium transition-colors ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Puce({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    teal: "bg-teal-100 text-teal-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function Case({ checked, onChange, children }) {
  return (
    <label className="mb-3 flex cursor-pointer items-start gap-2 text-[13px] text-slate-700">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-teal-800"
      />
      <span>{children}</span>
    </label>
  );
}

export function Vide({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-[13px] text-slate-500">
      {children}
    </div>
  );
}

export function Tiroir({ ouvert, onClose, titre, children }) {
  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky -top-4 -mx-4 mb-3 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="text-[15px] font-semibold text-teal-900">{titre}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[13px] text-slate-600 active:bg-slate-100">
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
