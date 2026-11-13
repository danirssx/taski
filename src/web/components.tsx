import { useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({ variant = "quiet", className = "", type = "button", ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "quiet" | "primary" }) {
  return <button {...props} type={type} className={`button button--${variant} ${className}`} />;
}

export function Field({ label, error, hint, id: providedId, ...props }:
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined; hint?: string }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const description = [props["aria-describedby"], error ? `${id}-error` : hint ? `${id}-hint` : undefined]
    .filter(Boolean).join(" ") || undefined;
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <input {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={description} />
    {error ? <span className="field__error" id={`${id}-error`} role="alert">{error}</span>
      : hint && <span className="field__hint" id={`${id}-hint`}>{hint}</span>}
  </div>;
}

export function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("");
  return <span className="avatar" aria-label={name} title={name}>{initials}</span>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function HighlightToggle({ pressed, label, onChange }:
  { pressed: boolean; label: string; onChange: () => void }) {
  return <button type="button" className="highlight-toggle" aria-pressed={pressed} aria-label={label}
    onClick={onChange} title={label}>
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M6 4v6a4 4 0 0 0 8 0V4M4 17h12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  </button>;
}

export interface TaskRowProps {
  title: string;
  code: string;
  meta: string;
  assignee: string;
  highlighted: boolean;
  selected: boolean;
  onOpen: () => void;
  onHighlight: () => void;
}

export function TaskRow(props: TaskRowProps) {
  return <li className={`task-row ${props.selected ? "task-row--selected" : ""}`}>
    <button type="button" className="task-row__open" onClick={props.onOpen} aria-label={`Abrir ${props.title}`}
      aria-current={props.selected ? "true" : undefined}>
      <span className="task-row__circle" aria-hidden="true" />
      <span className={`task-row__title ${props.highlighted ? "task-row__title--highlighted" : ""}`}>{props.title}</span>
      <span className="task-row__code">{props.code}</span>
    </button>
    <span className="task-row__meta">{props.meta}</span>
    <Avatar name={props.assignee} />
    <HighlightToggle pressed={props.highlighted} label={`Resaltar ${props.title}`} onChange={props.onHighlight} />
  </li>;
}

export function StatusMessage({ tone = "empty", title, children }:
  { tone?: "empty" | "loading" | "error"; title: string; children?: ReactNode }) {
  return <div className={`status-message status-message--${tone}`} role={tone === "error" ? "alert" : "status"}
    aria-busy={tone === "loading" ? true : undefined}>
    <strong>{title}</strong>{children && <p>{children}</p>}
  </div>;
}

export function DetailPanel({ open, title, onClose, children }:
  { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [compact, setCompact] = useState(() => matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const media = matchMedia("(max-width: 640px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || !compact) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open, compact]);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    heading.current?.focus({ preventScroll: true });
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key === "Tab" && matchMedia("(max-width: 640px)").matches) {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
        ) ?? []).filter((element) => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (!first || !last) { event.preventDefault(); heading.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return <aside ref={panel} className="detail-panel" role={compact ? "dialog" : "region"}
    aria-modal={compact ? true : undefined} aria-labelledby={id}>
    <div className="detail-panel__top"><span>Detalle</span><Button aria-label="Cerrar detalle" onClick={onClose}>Cerrar <span aria-hidden="true">×</span></Button></div>
    <h2 id={id} ref={heading} tabIndex={-1}>{title}</h2>
    {children}
  </aside>;
}
