# Acceso de equipo B4

El servidor valida un código compartido elegido por la instalación. Las personas seleccionan un miembro configurado; la identidad se registra como `self_selected`, no como cuenta individual verificada. No se incorporan OAuth ni invitaciones.

## Desarrollo local

1. Ejecuta `npm run db:migrate` para añadir las tablas de sesión/intentos.
2. Copia `.dev.vars.example` a `.dev.vars` y sustituye el código de ejemplo por el código local elegido.
3. Reinicia `npm run dev`. No hace falta código para `/health` o la vista de componentes; sí para crear una sesión y para las operaciones protegidas de los bloques siguientes.

`.dev.vars` está excluido de Git. En despliegue, TASKI_TEAM_ACCESS_CODE será un secreto del Worker. No se incluye en presets o variables VITE ni existe fallback de producción. Si no está configurado, el acceso responde CONFIGURATION_REQUIRED (503), sin revelar su valor. El ejemplo publicado es ficticio.

## Rutas disponibles

- GET `/api/v1/access`: nombre visible y miembros para el selector inicial, sin código, áreas o tickets. Esta información de presentación es pública para poder elegir persona antes de entrar.
- POST `/api/v1/session`, JSON `{code, memberId}`: valida código/miembro y devuelve cookie de sesión y miembro elegido.
- GET `/api/v1/session`: consulta la sesión elegida.
- PUT `/api/v1/session`, JSON `{memberId}` con cookie: cambia persona y rota/revoca la sesión anterior.
- DELETE `/api/v1/session`: revoca el token en servidor y elimina su cookie.

La cookie es HttpOnly, SameSite=Strict, Path=/ y Secure sobre HTTPS; en HTTP de loopback se permite desarrollo. Expira a los siete días. D1 conserva solo su hash y vencimiento; logout la revoca. Cambiar el código invalida sesiones anteriores. Miembros retirados de configuración no pueden seguir usando una sesión antigua.

Las escrituras de sesión exigen JSON y rechazan Origin distinto al del Worker. Hay límite simple de diez códigos fallidos por origen de red en una ventana de un minuto, con HTTP 429/Retry-After. Se almacena un bucket hash, no el código ni IP en texto. No pretende reemplazar identidad individual o un sistema avanzado de permisos.

El backend no registra el código en respuestas, actividad o errores. El bundle web de componentes no importa el adaptador de acceso. Los tickets/API/MCP se protegerán desde esta misma frontera en los próximos issues.
