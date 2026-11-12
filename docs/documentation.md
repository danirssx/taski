# La documentación es parte del producto

La calidad documental es prioritaria desde el primer bloque. Una contribución funcional incluye las instrucciones para usar y mantener lo que cambia.

## Guías necesarias para una primera versión funcional

1. Arranque rápido desde checkout limpio, requisitos y mensajes de éxito.
2. Referencia de configuración con tipos, ejemplos, valores iniciales y cambios que requieren migración.
3. API/OpenAPI y ejemplos de entrada, respuesta, error, paginación y conflicto.
4. Conexión MCP verificada por separado en Claude Code y Codex.
5. Despliegue en la propia cuenta Cloudflare y configuración de dominio/base.
6. Segunda instalación para otro proyecto, con datos y acceso independientes.
7. Personalización de marca, temas y UI sin editar el dominio.
8. Arquitectura, almacenamiento y recorrido de una operación.
9. Actualización, migraciones, exportación, restauración y diagnóstico.
10. Contribución por forks y PRs, pruebas y compatibilidad de versiones.

## Cómo comprobamos que sirve

Los ejemplos se ejecutan contra la versión documentada. Una persona distinta a quien escribió la guía debe poder seguir el arranque, configurar un agente y levantar otra instalación usando solo documentación pública. Se registran entorno/versiones y pasos realmente probados.

Enlaces internos existentes y contenido probado se distinguen de propuestas. El check actual verifica archivos de destino locales; no consulta enlaces externos ni garantiza la exactitud funcional del texto.

Las guías viven inicialmente en Markdown en el repositorio. Se prioriza contenido reproducible y actualizado; un portal documental puede añadirse cuando sea útil.
