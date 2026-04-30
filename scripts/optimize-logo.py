"""
Optimiza public/logo.png reduciendo tamano sin perdida visible.

Mantiene SIEMPRE el aspect ratio original. El logo historico era 2:1 (nota
musical + rueda y vinilo) pero el actual de marca es 1:1 (corazon + clave +
pulso); el script se adapta al ratio que encuentre en disco - nunca
distorsiona.

Probamos varias estrategias (resoluciones + paleta cuantizada) y elegimos la
de mas calidad dentro del presupuesto TARGET_KB.
"""
from PIL import Image
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'logo.png')
BACKUP_DIR = os.path.join(ROOT, 'scripts', '.backup')
BACKUP = os.path.join(BACKUP_DIR, 'logo.original.png')
TARGET_KB = 200  # margen sobre los 150 KB pedidos
RESULTS = []

# Backup primero (fuera de public/ para que Vite no lo publique)
os.makedirs(BACKUP_DIR, exist_ok=True)
if not os.path.exists(BACKUP):
    shutil.copy2(SRC, BACKUP)
    print(f'[backup] {BACKUP} creado ({os.path.getsize(BACKUP) // 1024} KB)')

original = Image.open(SRC).convert('RGBA')
orig_w, orig_h = original.size
orig_aspect = orig_w / orig_h
orig_size_kb = os.path.getsize(SRC) // 1024
print(f'[origen] {original.size} aspect={orig_aspect:.3f} {original.mode} -> {orig_size_kb} KB')


def size_at_max_dim(max_dim: int) -> tuple[int, int]:
    """Devuelve (w, h) escalando manteniendo aspect ratio para que el lado
    mas largo sea como mucho `max_dim`."""
    if orig_w >= orig_h:
        w = max_dim
        h = max(1, int(round(max_dim / orig_aspect)))
    else:
        h = max_dim
        w = max(1, int(round(max_dim * orig_aspect)))
    return (w, h)


def save_and_measure(img: Image.Image, path: str, **save_kwargs) -> int:
    img.save(path, **save_kwargs)
    return os.path.getsize(path) // 1024


# Estrategia 1: solo optimize=True (sin cambiar nada)
s1 = save_and_measure(original, 'tmp_s1.png', format='PNG', optimize=True)
RESULTS.append(('lossless optimize', 's1', s1))

# Estrategia 2: redimensionar a 1024 lado largo + optimize lossless
img_2 = original.resize(size_at_max_dim(1024), Image.Resampling.LANCZOS)
s2 = save_and_measure(img_2, 'tmp_s2.png', format='PNG', optimize=True)
RESULTS.append((f'{img_2.size[0]}x{img_2.size[1]} lossless', 's2', s2))

# Estrategia 3: 1024 lado largo + quantize 256 colores (paleta, mantiene alpha binario)
img_3 = original.resize(size_at_max_dim(1024), Image.Resampling.LANCZOS)
img_3q = img_3.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
s3 = save_and_measure(img_3q, 'tmp_s3.png', format='PNG', optimize=True)
RESULTS.append((f'{img_3.size[0]}x{img_3.size[1]} P=256', 's3', s3))

# Estrategia 4: 1024 lado largo + quantize 128 colores
img_4 = original.resize(size_at_max_dim(1024), Image.Resampling.LANCZOS)
img_4q = img_4.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
s4 = save_and_measure(img_4q, 'tmp_s4.png', format='PNG', optimize=True)
RESULTS.append((f'{img_4.size[0]}x{img_4.size[1]} P=128', 's4', s4))

# Estrategia 5: 1280 lado largo P=256 (mas resolucion para retina pantallas grandes)
img_5 = original.resize(size_at_max_dim(1280), Image.Resampling.LANCZOS)
img_5q = img_5.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
s5 = save_and_measure(img_5q, 'tmp_s5.png', format='PNG', optimize=True)
RESULTS.append((f'{img_5.size[0]}x{img_5.size[1]} P=256', 's5', s5))

# Estrategia 6: 768 lado largo P=256 (minimo razonable, todavia 2x para xl=96px)
img_6 = original.resize(size_at_max_dim(768), Image.Resampling.LANCZOS)
img_6q = img_6.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
s6 = save_and_measure(img_6q, 'tmp_s6.png', format='PNG', optimize=True)
RESULTS.append((f'{img_6.size[0]}x{img_6.size[1]} P=256', 's6', s6))

print('\n--- Resultados ---')
for name, key, kb in RESULTS:
    flag = ' <= ok' if kb <= TARGET_KB else '   too big'
    print(f'  {name:26s}: {kb:5d} KB {flag}')

# Elegir la mejor: priorizamos calidad maxima dentro del presupuesto.
candidates = [(name, key, kb) for name, key, kb in RESULTS if kb <= TARGET_KB]
# Preferimos: mas resolucion > mas colores. Orden de candidatos por calidad.
priority_order = ['s5', 's3', 's4', 's6', 's2', 's1']
chosen = None
for key in priority_order:
    for name, k, kb in candidates:
        if k == key:
            chosen = (name, k, kb)
            break
    if chosen:
        break

if chosen is None:
    # Fallback: el mas pequeno
    chosen = min(RESULTS, key=lambda x: x[2])

print(f'\n[elegido] {chosen[0]} ({chosen[2]} KB)')

# Reemplazar logo.png por la version elegida
shutil.copy2(f'tmp_{chosen[1]}.png', SRC)
final_kb = os.path.getsize(SRC) // 1024
print(f'[final] public/logo.png -> {final_kb} KB (era {orig_size_kb} KB, reduccion {(1 - final_kb/orig_size_kb)*100:.1f}%)')

# Limpieza
for _, key, _ in RESULTS:
    p = f'tmp_{key}.png'
    if os.path.exists(p):
        os.remove(p)
print('[ok] tmp files limpiados')
