import type { InstallationConfig } from "../types.ts";

export const demoPreset = {
  schemaVersion: 1,
  configVersion: 1,
  project: { id: "demo", name: "Proyecto demo", prefix: "DEMO", baseUrl: "http://127.0.0.1:8787" },
  locale: "es",
  members: [
    { id: "alex", name: "Alex", defaultView: "work" },
    { id: "sam", name: "Sam", defaultView: "work" },
    { id: "taylor", name: "Taylor", defaultView: "feedback" },
  ],
  areas: [{ id: "general", label: "General" }, { id: "web", label: "Web" }],
  defaultAreaId: "general",
  statusLabels: { todo: "Pendiente", in_progress: "En curso", in_review: "Por revisar", done: "Terminado" },
  typeLabels: { task: "Tarea", feedback: "Feedback" },
  policy: { agentsCanComplete: false },
  brand: { name: "Taski", accentLight: "#9f3159", accentDark: "#f2a2bc" },
} satisfies InstallationConfig;
