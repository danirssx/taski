import { demoPreset } from "./presets/demo.ts";
import { parseConfiguration } from "./schema.ts";

// Composition boundary: choose a preset here, never inside domain/application.
// Validation runs on module initialization, before the Worker handles requests.
export const installation = parseConfiguration(demoPreset);
