# Desarrollo y estructura

B1 incorpora un único proyecto TypeScript con npm y lockfile. No hay monorepo ni servicios adicionales.

| Carpeta | Responsabilidad | Dependencias permitidas |
| --- | --- | --- |
| `src/domain` | Reglas y tipos del producto, en B3 | Dominio. |
| `src/application` | Casos de uso y puertos | Dominio y aplicación, sin plataformas. |
| `src/adapters` | HTTP, Worker, almacenamiento y MCP | Núcleo y adaptadores. |
| `src/client` | Cliente HTTP independiente, en B5 | Cliente y APIs web estándar, sin React/Cloudflare. |
| `src/web` | Presentación, en B2/B7 | Web y cliente. |
| `experiments/b0` | Spike Python independiente | No se importa desde `src`. |

Las carpetas aún sin implementación tienen un README de alcance. No confundirlas con capacidades disponibles. El tipo de salud vive en aplicación; la traducción a HTTP vive en el adaptador.

## Herramientas

Node 24.11.1 (fijado en `.nvmrc`) y npm 11. También se admite Node 26 desde 26.3.0; CI comprueba ambas ramas. Las dependencias directas tienen versión exacta y `package-lock.json` fija el árbol resuelto. Usar `npm ci` en un checkout; no regenerar el lock para poder instalar.

```sh
npm ci
npm run dev
```

Wrangler muestra el servidor local en `http://127.0.0.1:8787`. En este primer esqueleto `GET /health` devuelve `{"service":"taski","status":"ok"}` como señal de proceso vivo. D1 y su comprobación de disponibilidad se incorporan en B1-02. No hay tareas, acceso de equipo, UI o MCP todavía. Detener con Ctrl+C.

## Comprobaciones

```sh
npm run check
npm run docs:check
git diff --check
```

`check` ejecuta tipos, fronteras y bundle. `typecheck` verifica el núcleo sin tipos de DOM/Cloudflare; `check:boundaries` inspecciona imports estáticos, exports e imports dinámicos literales. Es una regla de arquitectura, no un sandbox de seguridad. `build` usa `wrangler deploy --dry-run` para generar `dist` sin desplegar ni requerir credenciales. `dev` usa modo local, sin `--remote`.

CI ejecuta estas comprobaciones en PRs, incluidos forks, sin secretos de instalación o Cloudflare. La documentación y el spike de B0 conservan su workflow independiente. No se añade un comando de despliegue remoto hasta B11.
