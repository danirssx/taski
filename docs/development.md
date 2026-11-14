# Desarrollo y estructura

B1 incorpora un único proyecto TypeScript con npm y lockfile. No hay monorepo ni servicios adicionales.

| Carpeta | Responsabilidad | Dependencias permitidas |
| --- | --- | --- |
| `src/domain` | Reglas y tipos del producto | Dominio. |
| `src/application` | Casos de uso y puertos | Dominio y aplicación, sin plataformas. |
| `src/config` | Presets y validación de instalación | Configuración, sin importar núcleo o adaptadores. |
| `src/adapters` | HTTP, Worker, almacenamiento y MCP | Núcleo, configuración y adaptadores. |
| `src/client` | Cliente HTTP independiente | Cliente y APIs web estándar, sin React/Cloudflare. |
| `src/contracts` | DTOs públicos de la API | Sin plataformas ni dependencias externas. |
| `src/web` | Componentes/temas B2, integración de app en B7 | Web y cliente; solo el presentador preview puede importar presets. |
| `experiments/b0` | Spike Python independiente | No se importa desde `src`. |

Las carpetas aún sin implementación tienen un README de alcance. No confundirlas con capacidades disponibles. El tipo de salud vive en aplicación; la traducción a HTTP vive en el adaptador.

El Worker importa la [configuración](configuration.md) en su frontera de composición; el núcleo no importa presets. La validación de configuración no se mezcla con el almacenamiento; la API de proyecto expone su versión y permite omitir la configuración sin cambios.

La [vista de componentes](ui.md) arranca por separado con `npm run ui`. `build:web` produce `dist/web`; `build:worker` produce `dist/worker`. El typecheck web usa tipos DOM/React en su propio tsconfig, separados del núcleo y del Worker. El build local de ambos sigue sin desplegar.

## Herramientas

Node 24.11.1 (fijado en `.nvmrc`) y npm 11. También se admite Node 26 desde 26.3.0; CI comprueba ambas ramas. Las dependencias directas tienen versión exacta y `package-lock.json` fija el árbol resuelto. Usar `npm ci` en un checkout; no regenerar el lock para poder instalar.

```sh
npm ci
npm run db:migrate
npm run dev
```

Wrangler muestra el servidor local en `http://127.0.0.1:8787`. `GET /health` verifica una lectura real del bootstrap D1: HTTP 200 si está preparado y 503 en caso contrario. Consulta el [arranque local](getting-started.md) para respuesta esperada, persistencia y configuración de ejemplo. La API de tickets y el acceso de equipo se documentan en [API HTTP](api.md), [acceso](access.md) y [cliente TypeScript](client.md). La UI conectada y el MCP siguen pendientes. Detener con Ctrl+C.

## Comprobaciones

```sh
npm run check
npm run docs:check
git diff --check
```

`check` ejecuta tipos, fronteras, pruebas y bundle. `typecheck` verifica el núcleo sin tipos de DOM/Cloudflare; `check:boundaries` inspecciona imports estáticos, exports e imports dinámicos literales. Es una regla de arquitectura, no un sandbox de seguridad. `npm test` prueba fallos de disponibilidad y Worker/D1 reales emulados mediante el harness de Wrangler, con almacenamiento efímero aislado. `build` usa `wrangler deploy --dry-run` para generar `dist` sin desplegar ni requerir credenciales. `dev` y los scripts de D1 usan modo local, sin `--remote`.

CI ejecuta estas comprobaciones en PRs, incluidos forks, sin secretos de instalación o Cloudflare. La documentación y el spike de B0 conservan su workflow independiente. No se añade un comando de despliegue remoto hasta B11.
