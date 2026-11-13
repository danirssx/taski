// Health describes application readiness without importing HTTP or Cloudflare.
export interface ServiceHealth {
  service: "taski";
  status: "ok" | "unavailable";
}
