"""
Convierte los PNG originales de hero (raiz del repo) a WebP optimizados en
public/, listos para el LCP de la Landing.

Entrada (raiz del proyecto, ignorada por git):
  hero_cadencia.png         (panoramica desktop ~16:9)
  hero_cadencia_movil.png   (vertical mobile ~9:16)

Salida (public/, comprometida en el repo):
  public/hero_cadencia.webp
  public/hero_cadencia_movil.webp

Estrategia:
  1. Backup de los .webp actuales en scripts/.backup/ (nunca sobrescribir un
     backup existente: el primer run guarda la version legacy y siguientes
     no la machacan).
  2. Si el lado mas largo del PNG supera MAX_DIM, redimensionar manteniendo
     ratio (LANCZOS): un hero por encima de 2560 px es derroche - en pantallas
     retina 4K ya basta para que el navegador no re-escale notablemente.
  3. Probar varios `quality` en WebP method=6 (compresion mas exhaustiva) y
     elegir la primera version que entre en TARGET_KB. Si ninguna entra,
     coger la mas pequena (lossy). Es preferible perder un poco de detalle
     a meter 1 MB en el LCP.
"""
from PIL import Image
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_DIR = os.path.join(ROOT, 'scripts', '.backup')
PUBLIC = os.path.join(ROOT, 'public')

TARGETS = [
    {
        'name': 'desktop',
        'src': os.path.join(ROOT, 'hero_cadencia.png'),
        'out': os.path.join(PUBLIC, 'hero_cadencia.webp'),
        'backup': os.path.join(BACKUP_DIR, 'hero_cadencia.legacy.webp'),
        'max_dim': 2560,   # 16:9 -> 2560x1440 max
        'target_kb': 220,  # actual ~157 KB; permitimos 40 % margen
    },
    {
        'name': 'mobile',
        'src': os.path.join(ROOT, 'hero_cadencia_movil.png'),
        'out': os.path.join(PUBLIC, 'hero_cadencia_movil.webp'),
        'backup': os.path.join(BACKUP_DIR, 'hero_cadencia_movil.legacy.webp'),
        'max_dim': 1440,   # 9:16 -> 810x1440 max
        'target_kb': 180,  # actual ~134 KB
    },
]

QUALITY_LADDER = [85, 82, 78, 74, 70, 65]


def ensure_backup(src_webp: str, backup: str) -> None:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    if not os.path.exists(src_webp):
        return
    if os.path.exists(backup):
        return
    shutil.copy2(src_webp, backup)
    kb = os.path.getsize(backup) // 1024
    print(f'[backup] {os.path.basename(backup)} guardado ({kb} KB)')


def downscale_if_needed(img: Image.Image, max_dim: int) -> Image.Image:
    w, h = img.size
    largest = max(w, h)
    if largest <= max_dim:
        return img
    ratio = max_dim / largest
    new_size = (int(round(w * ratio)), int(round(h * ratio)))
    print(f'  [resize] {w}x{h} -> {new_size[0]}x{new_size[1]}')
    return img.resize(new_size, Image.Resampling.LANCZOS)


def encode_webp(target: dict) -> None:
    src = target['src']
    out = target['out']
    if not os.path.exists(src):
        raise FileNotFoundError(f'No existe el PNG fuente: {src}')

    print(f"\n[{target['name']}] {os.path.basename(src)} ({os.path.getsize(src) // 1024} KB)")

    ensure_backup(out, target['backup'])

    img = Image.open(src).convert('RGB')
    img = downscale_if_needed(img, target['max_dim'])

    chosen = None
    tmp = out + '.tmp'
    for q in QUALITY_LADDER:
        img.save(tmp, format='WEBP', quality=q, method=6)
        kb = os.path.getsize(tmp) // 1024
        flag = ' <= ok' if kb <= target['target_kb'] else '   too big'
        print(f'  q={q:2d}: {kb:4d} KB{flag}')
        if chosen is None and kb <= target['target_kb']:
            chosen = (q, kb)
            break

    if chosen is None:
        # ningun nivel cumplio target; reencode con el mas bajo y aceptamos
        img.save(tmp, format='WEBP', quality=QUALITY_LADDER[-1], method=6)
        chosen = (QUALITY_LADDER[-1], os.path.getsize(tmp) // 1024)
        print(f'  [fallback] ningun quality cumple {target["target_kb"]} KB; uso q={chosen[0]} -> {chosen[1]} KB')

    shutil.move(tmp, out)
    final_kb = os.path.getsize(out) // 1024
    print(f"  [ok] {os.path.relpath(out, ROOT)}: q={chosen[0]} -> {final_kb} KB")


def main() -> None:
    for target in TARGETS:
        encode_webp(target)
    print('\n[done] heros optimizados.')


if __name__ == '__main__':
    main()
