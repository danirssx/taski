import type { InstallationConfig } from "./types.ts";

export class ConfigurationError extends Error {
  constructor(path: string, reason: string) {
    super(`Invalid Taski configuration: ${path}: ${reason}`);
    this.name = "ConfigurationError";
  }
}

const fail = (path: string, reason: string): never => { throw new ConfigurationError(path, reason); };

function object(input: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail(path, "expected object");
  const value = input as Record<string, unknown>;
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, "unknown field");
  for (const key of keys) if (!(key in value)) fail(`${path}.${key}`, "required field");
  return value;
}

function text(input: unknown, path: string, max = 100): string {
  if (typeof input !== "string" || !input.trim() || input.length > max) {
    return fail(path, `expected nonempty text, at most ${max} characters`);
  }
  return input.trim();
}

function id(input: unknown, path: string): string {
  if (typeof input !== "string" || !/^[a-z][a-z0-9_-]{0,47}$/.test(input)) {
    return fail(path, "use a stable lowercase ID, 1–48 letters/digits/_/-");
  }
  return input;
}

function rows(input: unknown, path: string): unknown[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 50) {
    return fail(path, "expected 1–50 entries");
  }
  return input;
}

function unique<T extends { id: string }>(entries: T[], path: string): T[] {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) fail(`${path}[${index}].id`, "duplicate stable ID");
    seen.add(entry.id);
  });
  return entries;
}

function labels<K extends string>(input: unknown, path: string, keys: readonly K[]): Record<K, string> {
  const value = object(input, path, keys);
  return Object.fromEntries(keys.map((key) => [key, text(value[key], `${path}.${key}`, 64)])) as Record<K, string>;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function parseConfiguration(input: unknown): InstallationConfig {
  const value = object(input, "config", ["schemaVersion", "configVersion", "project", "locale", "members",
    "areas", "defaultAreaId", "statusLabels", "typeLabels", "policy", "brand"]);
  if (value.schemaVersion !== 1) fail("schemaVersion", "only schema version 1 is supported");
  if (typeof value.configVersion !== "number" || !Number.isSafeInteger(value.configVersion) || value.configVersion < 1) {
    fail("configVersion", "expected a positive safe integer; increment after changing configuration");
  }
  if (value.locale !== "es") fail("locale", "only es is implemented");
  const project = object(value.project, "project", ["id", "name", "prefix", "baseUrl"]);
  if (typeof project.prefix !== "string" || !/^[A-Z][A-Z0-9]{1,7}$/.test(project.prefix)) {
    fail("project.prefix", "expected 2–8 uppercase letters/digits, beginning with a letter");
  }
  let baseUrl: URL;
  try { baseUrl = new URL(text(project.baseUrl, "project.baseUrl", 300)); }
  catch { return fail("project.baseUrl", "expected an absolute HTTPS URL or loopback HTTP URL"); }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash
      || !(baseUrl.protocol === "https:" || (baseUrl.protocol === "http:"
        && ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname)))) {
    fail("project.baseUrl", "use HTTPS (HTTP only on loopback), without credentials/query/fragment");
  }
  const members = unique(rows(value.members, "members").map((entry, index) => {
    const path = `members[${index}]`;
    const member = object(entry, path, ["id", "name", "defaultView"]);
    if (member.defaultView !== "work" && member.defaultView !== "feedback") {
      fail(`${path}.defaultView`, "expected work or feedback");
    }
    return { id: id(member.id, `${path}.id`), name: text(member.name, `${path}.name`),
      defaultView: member.defaultView as "work" | "feedback" };
  }), "members");
  const areas = unique(rows(value.areas, "areas").map((entry, index) => {
    const path = `areas[${index}]`;
    const area = object(entry, path, ["id", "label"]);
    return { id: id(area.id, `${path}.id`), label: text(area.label, `${path}.label`, 64) };
  }), "areas");
  const defaultAreaId = id(value.defaultAreaId, "defaultAreaId");
  if (!areas.some((area) => area.id === defaultAreaId)) fail("defaultAreaId", "must reference a configured area ID");
  const policy = object(value.policy, "policy", ["agentsCanComplete"]);
  if (typeof policy.agentsCanComplete !== "boolean") fail("policy.agentsCanComplete", "expected boolean");
  const brand = object(value.brand, "brand", ["name", "accentLight", "accentDark"]);
  for (const key of ["accentLight", "accentDark"]) {
    if (typeof brand[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(brand[key])) {
      fail(`brand.${key}`, "expected a six-digit hex color");
    }
  }
  return freeze({ schemaVersion: 1, configVersion: value.configVersion as number,
    locale: "es", project: { id: id(project.id, "project.id"), name: text(project.name, "project.name"),
      prefix: project.prefix as string, baseUrl: baseUrl.toString().replace(/\/$/, "") },
    members, areas, defaultAreaId,
    statusLabels: labels(value.statusLabels, "statusLabels", ["todo", "in_progress", "in_review", "done"]),
    typeLabels: labels(value.typeLabels, "typeLabels", ["task", "feedback"]),
    policy: { agentsCanComplete: policy.agentsCanComplete as boolean },
    brand: { name: text(brand.name, "brand.name"), accentLight: brand.accentLight as string,
      accentDark: brand.accentDark as string } });
}
