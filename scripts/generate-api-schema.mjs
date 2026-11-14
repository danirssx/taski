import { readFile, writeFile } from "node:fs/promises";
import { definitions } from "../src/adapters/api/contract.ts";

const components = {};
for (const definition of definitions) {
  components[`${definition.name}Input`] = definition.inputSchema;
  components[`${definition.name}Output`] = definition.outputSchema;
}
const paths = {};
const routes = [
  ["get", "/api/v1/project", "get_project"], ["get", "/api/v1/tickets", "list_tickets"],
  ["get", "/api/v1/tickets/{key}", "get_ticket"], ["post", "/api/v1/tickets", "create_ticket"],
  ["patch", "/api/v1/tickets/{key}", "update_ticket"], ["post", "/api/v1/tickets/{key}/comments", "add_comment"],
  ["get", "/api/v1/activity", "list_activity"], ["put", "/api/v1/tickets/{key}/pull-request", "link_pull_request"],
];
for (const [method, path, name] of routes) {
  const definition = definitions.find((entry) => entry.name === name);
  const input = structuredClone(definition.inputSchema);
  const parameters = [];
  if (path.includes("{key}")) {
    parameters.push({ name: "key", in: "path", required: true, schema: input.properties.key });
    delete input.properties.key;
    input.required = input.required.filter((key) => key !== "key");
  }
  if (method === "get") for (const [name, schema] of Object.entries(input.properties)) {
    parameters.push({ name, in: "query", required: input.required.includes(name), schema });
  }
  const entry = { operationId: name, description: definition.description, parameters,
    responses: { [method === "post" && name === "create_ticket" ? "201" : "200"]: {
      description: "Confirmed result", content: { "application/json": { schema: { $ref: `#/components/schemas/${name}Output` } } },
    }, default: { description: "Typed error; inspect error.code. 401/403 access, 409 conflict, 429 rate limit, 503 configuration, 500 unconfirmed internal failure.",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } } };
  if (method !== "get") entry.requestBody = { required: true, content: { "application/json": { schema: input } } };
  paths[path] ??= {}; paths[path][method] = entry;
}
components.Error = { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } } } };
paths["/api/v1/access"] = { get: { operationId: "get_access_options", security: [], responses: { 200: { description: "Public project/brand names and selectable configured members; no secrets or tickets" } } } };
paths["/api/v1/session"] = {};
for (const [method, operationId] of [["post", "create_session"], ["get", "get_session"], ["put", "change_member"], ["delete", "logout"]]) {
  const operation = { operationId, security: method === "post" ? [] : [{ TeamCookie: [] }], responses: { [method === "delete" ? "204" : "200"]: { description: method === "delete" ? "Session revoked; cookie cleared" : "Selected member and self_selected assurance; session cookie for POST/PUT" } } };
  if (["post", "put"].includes(method)) operation.requestBody = { required: true, content: { "application/json": { schema: {
    type: "object", additionalProperties: false, properties: { memberId: { type: "string" }, ...(method === "post" ? { code: { type: "string", minLength: 1, maxLength: 256 } } : {}) },
    required: method === "post" ? ["memberId", "code"] : ["memberId"],
  } } } };
  paths["/api/v1/session"][method] = operation;
}
const document = { openapi: "3.1.0", info: { title: "Taski API", version: "0.1.0", description: "Local implemented contract; see docs/api.md and docs/access.md. No production deployment is implied. assigneeId=~ in GET means unassigned." },
  servers: [{ url: "http://127.0.0.1:8787" }], security: [{ TeamBearer: [], MemberHeader: [] }, { TeamCookie: [] }], paths,
  components: { schemas: components, securitySchemes: {
    TeamBearer: { type: "http", scheme: "bearer", description: "Installation's shared code; never embed in URL/tool args" },
    MemberHeader: { type: "apiKey", in: "header", name: "X-Taski-Member" }, TeamCookie: { type: "apiKey", in: "cookie", name: "taski_session" },
  } } };
const target = new URL("../docs/api/openapi.json", import.meta.url);
const serialized = JSON.stringify(document, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (await readFile(target, "utf8") !== serialized) throw new Error("API schema changed; run npm run api:generate and review the diff");
  console.log("OK: OpenAPI matches the eight operation contracts and access routes.");
} else { await writeFile(target, serialized); console.log("Generated docs/api/openapi.json"); }
