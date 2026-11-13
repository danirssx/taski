export type Theme = "light" | "dark" | "system";

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("taski.theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* Storage is optional, including in restricted browsers. */ }
  return "system";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("taski.theme", theme); } catch { /* The theme still works for this session. */ }
}
