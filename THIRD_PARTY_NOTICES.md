# Recursos de terceros

El código original de Taski usa [MIT](LICENSE). Los recursos incorporados conservan sus licencias propias:

- **Inter**: copyright The Inter Project Authors, SIL Open Font License 1.1. Se distribuye una copia local sin modificar del archivo variable usado en el prototipo aceptado, con [OFL completo](src/web/assets/OFL-Inter.txt). Proyecto: [rsms/inter](https://github.com/rsms/inter).
- **React, React DOM y Scheduler**: licencias MIT de Meta Platforms y colaboradores, copiadas de las versiones fijadas en `package-lock.json` al [archivo de avisos distribuido](src/web/assets/THIRD_PARTY_NOTICES.txt).

La vista de componentes incluye un enlace al archivo de avisos, que Vite incorpora al bundle junto a la fuente. Al redistribuir fuente o bibliotecas, conserva estos textos y revisa el cambio si actualizas dependencias/recursos. La marca SVG de la vista está escrita en código propio; no incorpora recursos de Superlist, Timestripe o Pártela.
