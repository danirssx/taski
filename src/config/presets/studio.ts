import type { InstallationConfig } from "../types.ts";

export const studioPreset = {
  schemaVersion: 1,
  configVersion: 1,
  project: { id: "studio", name: "Estudio editorial", prefix: "EDIT", baseUrl: "https://studio.example" },
  locale: "es",
  members: [
    { id: "lee", name: "Lee", defaultView: "work" },
    { id: "jules", name: "Jules", defaultView: "feedback" },
  ],
  areas: [{ id: "general", label: "Entrada" }, { id: "content", label: "Contenido" }],
  defaultAreaId: "general",
  statusLabels: { todo: "Por hacer", in_progress: "Preparando", in_review: "Revisión", done: "Listo" },
  typeLabels: { task: "Trabajo", feedback: "Idea" },
  policy: { agentsCanComplete: false },
  brand: { name: "Taski Studio", accentLight: "#276658", accentDark: "#91d3c0" },
} satisfies InstallationConfig;
