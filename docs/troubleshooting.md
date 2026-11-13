# Problemas del arranque local

## Node o npm incompatible

Comprueba `node --version` y `npm --version`. Usa Node 24.11.1 o Node 26 desde 26.3.0 y npm 11; `nvm use` aplica `.nvmrc` si tienes nvm. Evita reutilizar `node_modules` de otra versión o arquitectura: ejecuta `npm ci` en la carpeta correcta. No edites el lockfile para ocultar un fallo de instalación.

## `/health` devuelve 503

El Worker arrancó pero no pudo confirmar el bootstrap en D1. En la raíz del mismo checkout, ejecuta:

```sh
npm run db:migrate
npm run db:check
```

Comprueba que `bootstrap_version` sea 1 y repite la consulta de salud. Los scripts comparten configuración y directorio de persistencia. No mezcles `--persist-to` personalizados entre migraciones y servidor. Si la base fue alterada manualmente, revisa ese cambio antes de borrar datos; volver a aplicar una migración registrada no repara filas borradas a mano.

## Puerto ocupado o conexión rechazada

Espera el mensaje `Ready`, mantén el servidor abierto y utiliza `127.0.0.1`. Si otro proceso usa 8787, detén tu proceso anterior o usa `npm run dev -- --port 8788` y cambia la URL de curl. No hace falta exponer el servidor al equipo ni abrir un túnel para verificar B1.

## Wrangler pide login o una base real

Los comandos documentados son locales y no piden cuenta. Comprueba que ejecutas los scripts de este repositorio, con su configuración neutra y sin `--remote`. `npm run build` es un dry-run: produce archivos locales sin publicar. No añadas tokens o datos de otra instalación al repo para solucionar el problema.

## Falla una prueba o el build

Ejecuta `npm run check` para conservar el primer error, además de las versiones de Node/npm y tu sistema operativo. Las pruebas usan D1 emulado mediante Wrangler; no son un test del servicio remoto de Cloudflare. En un PR incluye el comando, error y entorno sin `.env`, `.dev.vars` ni credenciales. Usa el flujo de [contribución](../CONTRIBUTING.md).

## Solo aparece JSON y no una interfaz

B1 entrega infraestructura local. `/` y `/mcp` aún responden 404. La UI, los tickets y el MCP llegan después; no es un fallo de instalación. Ver [roadmap](roadmap.md).
