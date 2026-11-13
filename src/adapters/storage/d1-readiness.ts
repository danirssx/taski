import type { ReadinessProbe } from "../../application/health.ts";

export function d1Readiness(database: D1Database): ReadinessProbe {
  return {
    async check(): Promise<void> {
      const row = await database
        .prepare("SELECT bootstrap_version FROM taski_bootstrap WHERE id = 1")
        .first<{ bootstrap_version: number }>();
      if (row?.bootstrap_version !== 1) {
        throw new Error("Database bootstrap is not ready");
      }
    },
  };
}
