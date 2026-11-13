# Trabajar en Taski

- Lee README, CONTRIBUTING y docs/product-scope.md antes de cambiar el proyecto.
- El repositorio tiene una base TypeScript/Worker local y el spike de B0. No presentes tickets, UI conectada, MCP o despliegue como existentes hasta implementarlos y comprobarlos.
- Prioriza el núcleo reutilizable y los recorridos MCP. Marca, miembros y datos reales pertenecen a cada instalación.
- Cada cambio de comportamiento incluye documentación y ejemplos acordes con la implementación.
- Comprueba la documentación con `python3 scripts/check_docs.py` y el diff con `git diff --check`.
- Para código/configuración de aplicación, lee `docs/development.md` y ejecuta `npm run check`. Dominio y aplicación no importan plataformas; el spike Python no se importa desde `src`.
- Si cambias el spike o sus fixtures, sigue `experiments/b0/README.md`: pruebas de contrato y reporte proxy reproducible. No traslades el almacenamiento en memoria del experimento a la aplicación.
- Mantén las contribuciones enfocadas y abre PRs hacia main. La documentación pública utiliza datos ficticios.
- El primer commit de documentación inicializa main para permitir forks y PRs; los cambios posteriores se proponen por PR.
