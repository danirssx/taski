"""Comprueba que los enlaces Markdown a archivos locales tengan destino en el repo.

Solo usa la biblioteca estándar para que un colaborador pueda ejecutarlo sin
instalar dependencias de la futura app. No solicita recursos de red.
"""

from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    errors = []
    checked = 0
    excluded = {".git", ".venv", "node_modules", "dist", ".wrangler", "test-results", "playwright-report"}
    documents = sorted(path for path in root.rglob("*.md") if not excluded.intersection(path.parts))
    for document in documents:
        text = document.read_text(encoding="utf-8")
        text = re.sub(r"^```.*?^```\s*$", "", text, flags=re.MULTILINE | re.DOTALL)
        for match in re.finditer(r"!?\[[^\]]*\]\(([^\s)]+)\)", text):
            link = match.group(1).strip("<>")
            url = urlsplit(link)
            if url.scheme or url.netloc or not url.path:
                continue
            target = (document.parent / unquote(url.path)).resolve()
            if not target.is_relative_to(root):
                errors.append(f"{document.relative_to(root)}: enlace fuera del repo: {link}")
            elif not target.exists():
                errors.append(f"{document.relative_to(root)}: destino inexistente: {link}")
            checked += 1
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"OK: {len(documents)} documentos; {checked} enlaces locales comprobados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
