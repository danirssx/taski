# Contribuir a Taski

Taski acepta pull requests de colaboradores externos mediante forks. Las contribuciones se proponen a `main`; los mantenedores revisan e integran los cambios.

## Qué se puede aportar hoy

Documentación, recorridos de usuario, UI, arquitectura y cambios enfocados en la base TypeScript/Worker local. Consulta [desarrollo y estructura](docs/development.md) y el [roadmap](docs/roadmap.md) antes de implementar una funcionalidad grande. Los tickets y el acceso de equipo ya están disponibles mediante la API HTTP y el cliente TypeScript. La UI conectada y el servidor MCP siguen pendientes.

También puedes ejecutar y mejorar el [spike del contrato B0](experiments/b0/README.md), con datos ficticios y sin credenciales. Al cambiar contrato, fixtures o presupuestos, ejecuta sus pruebas y el check del informe reproducible además de los checks documentales. El código del spike es experimental, separado del runtime TypeScript que comienza en B1.

Un cambio pequeño de documentación puede proponerse directamente. Para cambios de alcance o arquitectura, describe primero el problema y el enfoque en un issue para coordinar el trabajo.

## Fork → rama → pull request

1. Pulsa **Fork** en [danirssx/taski](https://github.com/danirssx/taski).
2. Clona tu fork. Sustituye `TU_USUARIO` por tu usuario de GitHub:

```sh
git clone https://github.com/TU_USUARIO/taski.git
cd taski
git remote add upstream https://github.com/danirssx/taski.git
git switch -c docs/mi-mejora
```

3. Haz un cambio enfocado y comprueba los documentos:

```sh
python3 scripts/check_docs.py
git diff --check
```

Para código TypeScript o configuración del Worker, instala con `npm ci` y ejecuta `npm run check`. Incluye el lockfile si cambia una dependencia. Mantén dominio/aplicación libres de React y Cloudflare. Los comandos y las fronteras están en [desarrollo](docs/development.md).

Si cambias el onboarding, migra el arranque o modificas sus comandos, ejecuta también `npm run onboarding:check` desde un checkout limpio con los cambios commiteados. Reproduce la instalación en un clon temporal y registra el resultado real; no sustituye una revisión humana independiente cuando el issue la requiere. Ver [evidencia y recorrido de B1](docs/verification/b1-onboarding.md).

4. Revisa y publica tu rama en tu fork:

```sh
git add README.md
git commit -m "docs: aclarar el inicio del proyecto"
git push -u origin docs/mi-mejora
```

El comando `git add` es un ejemplo: selecciona los archivos que hayas cambiado.

5. En GitHub, abre **Contribute → Open pull request** desde tu fork. Selecciona como base `danirssx/taski:main` y como origen tu rama.
6. Describe el problema, el resultado y lo que comprobaste usando la plantilla del PR. Añade capturas si cambias el diseño.

Consulta también la [guía oficial de PRs desde un fork](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork).

## Comprobaciones y revisión

La comprobación de documentación se ejecuta en pushes a `main` y pull requests, incluidos los de forks. GitHub puede solicitar aprobación de un mantenedor para ejecutar Actions de un colaborador nuevo, según la configuración de la cuenta. No hace falta entregar secretos o acceso a Cloudflare para este check.

La revisión comprueba que el cambio resuelve un problema concreto, respeta el alcance, usa datos ficticios y actualiza la documentación correspondiente. Un check verde es evidencia de una comprobación concreta; no sustituye revisar el contenido ni garantiza que una función todavía no implementada esté disponible.

## Documentación como parte del cambio

- Actualiza ejemplos, opciones y guías cuando cambie su comportamiento.
- Distingue funcionalidades disponibles de propuestas.
- Indica entorno y pasos realmente probados; conserva mensajes de éxito/error útiles.
- Usa nombres y datos ficticios, nunca códigos de acceso, sesiones o datos de un equipo real.
- Conserva los avisos y licencias de los recursos incorporados.

Los criterios detallados están en [documentación](docs/documentation.md). Al contribuir, aceptas que tu aportación original se distribuya bajo la [licencia MIT del proyecto](LICENSE).
