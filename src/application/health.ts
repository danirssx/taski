// Health describes application readiness without importing HTTP or Cloudflare.
export interface ServiceHealth {
  service: "taski";
  status: "ok" | "unavailable";
  checks: { database: "ok" | "unavailable" };
}

export interface ReadinessProbe {
  check(): Promise<void>;
}

export async function checkHealth(probe: ReadinessProbe): Promise<ServiceHealth> {
  try {
    await probe.check();
    return { service: "taski", status: "ok", checks: { database: "ok" } };
  } catch {
    return { service: "taski", status: "unavailable", checks: { database: "unavailable" } };
  }
}
