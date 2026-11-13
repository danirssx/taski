# Configuración de una instalación

B2 separa los datos de instalación de las reglas y adaptadores. Cada instalación sigue sirviendo a un único proyecto. Los presets públicos son ficticios: no contienen el equipo, secretos o recursos de Pártela.

## Elegir un preset

La selección vive en [src/config/index.ts](../src/config/index.ts): importa el preset y lo pasa a `parseConfiguration`. Por defecto se usa [demo](../src/config/presets/demo.ts). Para probar otro proyecto, cambia solo esa importación por [studio](../src/config/presets/studio.ts) y su export `studioPreset`.

Ambos usan el mismo validador y Worker; no se editan dominio, casos de uso o SQL para cambiar nombres, miembros o marca. Esto demuestra separación de configuración, no el despliegue de dos instalaciones remotas: esa comprobación completa pertenece a B10/B11.

La validación ocurre al evaluar el módulo de configuración, antes de que el Worker atienda peticiones. Los errores son `ConfigurationError` y nombran el campo, sin volcar el objeto completo. No hay valores por defecto silenciosos para campos requeridos ni claves desconocidas aceptadas. La configuración validada se copia y congela de forma recursiva.

## Campos del esquema 1

Todos son obligatorios; el preset demo muestra los valores iniciales. Los tipos están en [types.ts](../src/config/types.ts) y la comprobación de datos desconocidos en [schema.ts](../src/config/schema.ts).

| Campo | Tipo / límites | Cambio y efecto |
| --- | --- | --- |
| schemaVersion | Literal `1` | Versión del formato. Otro valor exige actualizar el parser, no se interpreta automáticamente. |
| configVersion | Entero seguro positivo | Incrementar cada vez que cambien miembros, áreas, rótulos, política o marca. Permitirá invalidar contexto conocido en B5/B6; todavía no hay un endpoint de configuración. |
| project.id | ID estable de 1–48 caracteres | Minúscula inicial, luego letras minúsculas, dígitos, `_` o `-`. Con datos existentes, cambiarlo exige plan de migración/otra instalación. |
| project.name | Texto de 1–100 caracteres | Rótulo visible; cambiarlo no cambia identidad. |
| project.prefix | 2–8 letras mayúsculas/dígitos, letra inicial | Prefijo inicial de códigos. No se cambia libremente después de crear tickets. |
| project.baseUrl | URL absoluta de hasta 300 caracteres | HTTPS; HTTP solo para localhost, 127.0.0.1 o ::1. Sin credenciales, query o fragmento. Se normaliza sin slash final; puede tener un subpath. |
| locale | Literal `es` | Solo español implementado. No constituye un motor de traducciones. |
| members | 1–50 objetos | id único y estable; name de 1–100 caracteres; defaultView `work` o `feedback`. Es preferencia de presentación, no un rol. |
| areas | 1–50 objetos | id único y estable; label de 1–64 caracteres. |
| defaultAreaId | ID de una de las áreas | Referencia validada; no puede apuntar a un área inexistente. |
| statusLabels | Claves exactas todo/in_progress/in_review/done | Rótulos de 1–64 caracteres; cambiar texto conserva el ID de estado. |
| typeLabels | Claves exactas task/feedback | Rótulos de 1–64 caracteres; tipos separados de estados. |
| policy.agentsCanComplete | Booleano; demo/studio usan false | La configuración describe la política. Su ejecución/auditoría en mutaciones se implementa en B3/B4. |
| brand.name | Texto de 1–100 caracteres | Identidad de presentación, independiente del proyecto. |
| brand.accentLight / accentDark | Color hex de seis dígitos | Acento para cada tema. El parser valida formato; revisar contraste visual al crear un tema. |

Los textos se recortan en sus extremos; los IDs/prefijo exigen su formato exacto. Se permiten nombres iguales para personas distintas: las referencias siempre usan ID. Rótulos vacíos, IDs repetidos, referencias inválidas y campos no previstos producen error.

## Personalizar y verificar

1. Copia un preset y cambia los datos ficticios por los de tu instalación.
2. Selecciónalo en `src/config/index.ts`; incrementa configVersion.
3. Ejecuta `npm run check` y `npm run docs:check`; reinicia `npm run dev`.
4. Conserva los cambios de configuración/tema fuera del núcleo. Para un fork público usa ejemplos ficticios; los presets y secretos reales de una instalación no se publican como configuración compartida.

No se guarda el código de acceso en el preset. B4 lo recibirá por secretos del Worker y configuración local excluida de Git. Tampoco hay account ID, bucket o base reales en los presets.

## Compatibilidad cuando existan datos

Cambiar name/label conserva IDs. Renombrar un member.id o area.id equivale a crear otra identidad: B3 deberá mantener referencias históricas; no retirar una identidad referenciada sin un plan. El prefijo y project.id forman parte de la identidad inicial: conservar los códigos/URLs ya emitidos o crear una migración explícita con aliases/redirecciones. El validador de B2 no consulta D1 ni puede saber si hay tickets existentes.

Cambiar baseUrl requiere conservar rutas o redirecciones de enlaces compartidos en el despliegue. Las migraciones durables y la segunda instalación se comprueban en B3/B10/B11; no se afirma que editar un preset migre datos.
