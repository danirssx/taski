# Cliente TypeScript

`src/client/index.ts` es un cliente sin React, DOM, Cloudflare o dependencias de terceros. Usa tipos públicos en `src/contracts/api.ts` y un transporte fetch opcional. Su tsconfig separado compila sin tipos de navegador/Node/plataforma, además del check de fronteras. La web, Node o un Worker pueden aportar fetch; una app Swift consumirá el mismo HTTP/OpenAPI sin importar TypeScript.

```ts
import { TaskiClient } from "./src/client/index.ts";

const client = new TaskiClient({ baseUrl: "http://127.0.0.1:8787" });
// En navegador usa la cookie HttpOnly de una sesión ya iniciada.
const project = await client.getProject();
const page = await client.listTickets();
const ticket = await client.getTicket(page.items[0]!.key); // work por defecto
```

Para agentes o scripts, construye el cliente con `code`, `memberId` y `clientName` desde el entorno local, nunca desde archivos compartidos. No incluye código en URL, errores o serialización del cliente. `fetch` inyectable permite pruebas y hosts sin fetch global. El cliente no almacena código en localStorage.

Métodos: getProject, listTickets, getTicket, createTicket, updateTicket, addComment, listActivity y linkPullRequest; más accessOptions/login/changeMember/logout para sesiones web. login envía el código y no lo retiene; la cookie queda a cargo del navegador. Node no mantiene cookie jar automáticamente: para scripts se recomienda acceso por cabeceras o un transporte que lo gestione explícitamente.

Las vistas son genéricas: getTicket(key) tiene los campos de trabajo, getTicket(key,{view:"full"}) añade identidad/fechas y summary los reduce. listTickets({view:"work"}) añade metadatos de UI. Consulta `omitted`, nextCursor y nextCommentsCursor; las páginas pueden continuarse solo con el cursor y el límite. getProject(knownVersion) evita retransmitir el catálogo de miembros cuando no cambió.

## Cambiar estado y dejar avance

```ts
await client.updateTicket(ticket.ticket.key, {
  expectedVersion: ticket.ticket.version,
  idempotencyKey: "avance-001",
  changes: { status: "in_review" },
  comment: "Listo para revisar",
});
```

No hay reintentos automáticos ni incremento ciego de versiones. TaskiClientError conserva code/status; ante VERSION_CONFLICT relee y reconcilia. Ante pérdida de transporte conserva la misma clave y parámetros para consultar/reintentar el resultado, según [garantías de reintento](retries.md). [OpenAPI](api/openapi.json) describe entradas, salidas y seguridad; el servidor valida los datos y no se confía en los tipos del consumidor.

Las pruebas ejecutan el recorrido real contra Worker/D1 emulado, incluida asignación, comentario, PR y revisión; también comprueban que un error no dispara escrituras repetidas. La API comparte casos de uso con el MCP que se incorpora en B6.
