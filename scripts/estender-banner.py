# REPETECO — estende a arte do banner nas laterais (para telas largas),
# sem desfoque e sem cortar o nome. Usa "image quilting" (Efros & Freeman,
# 2001): preenche as laterais com pedaços da própria arte que não têm
# letras nem o mascote, escolhendo os que combinam com os vizinhos e
# emendando pelo caminho de menor diferença.
#
# Uso (gera o JPG largo; depois converta para WebP nos tamanhos usados):
#   python3 scripts/estender-banner.py <arte.jpg> <saida.jpg> 1000 21 64 16 1.05
#   argumentos: largura extra por lado, semente, tamanho do pedaço,
#   sobreposição, tolerância. A versão publicada usou exatamente esses valores.
# As caixas das letras (boxes) valem para a arte de 1600×458 px.
import sys
import numpy as np
from PIL import Image
src, out, E = sys.argv[1], sys.argv[2], int(sys.argv[3])
rng = np.random.default_rng(int(sys.argv[4]) if len(sys.argv) > 4 else 7)
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = im.shape
# Caixas das letras e do mascote (x0, y0, x1, y1) com folga.
boxes = [(100,130,310,370),(280,70,415,225),(390,145,565,350),(495,250,645,415),
         (610,45,955,415),(900,70,1080,290),(1030,240,1165,395),(1125,85,1305,250),(1235,145,1450,370)]
mask = np.ones((H, W), bool)
for x0,y0,x1,y1 in boxes: mask[max(0,y0):y1, max(0,x0):x1] = False
P, O = int(sys.argv[5]) if len(sys.argv) > 5 else 96, int(sys.argv[6]) if len(sys.argv) > 6 else 24          # tamanho do pedaço e sobreposição
step = P - O
# Posições válidas de pedaços (sem nenhum pixel de letra).
ok = []
for y in range(0, H - P + 1, 4):
    for x in range(0, W - P + 1, 4):
        if mask[y:y+P, x:x+P].all(): ok.append((y, x))
ok = np.array(ok)
uses = {}  # quantas vezes cada região (blocos de 32 px) da arte já foi usada
bucket = lambda yx: (int(yx[0]) // 32, int(yx[1]) // 32)
print("pedaços disponíveis:", len(ok), file=sys.stderr)

def min_cut_v(err):  # caminho vertical de menor erro (err: h x O)
    h, w = err.shape; c = err.copy()
    for i in range(1, h):
        prev = np.pad(c[i-1], 1, constant_values=np.inf)
        c[i] += np.minimum(np.minimum(prev[:-2], prev[1:-1]), prev[2:])
    path = np.zeros(h, int); path[-1] = int(np.argmin(c[-1]))
    for i in range(h-2, -1, -1):
        j = path[i+1]; lo, hi = max(0, j-1), min(w, j+2)
        path[i] = lo + int(np.argmin(c[i, lo:hi]))
    m = np.zeros((h, w), bool)
    for i in range(h): m[i, path[i]:] = True   # True = usa o novo pedaço
    return m

def quilt(width, seed_col):
    """Gera faixa de largura `width`; seed_col (H x O x 3) é a coluna vizinha à esquerda."""
    cols = int(np.ceil((width - O) / step)) + 1
    rows = int(np.ceil((H - O) / step)) + 1
    Wc, Hc = (cols - 1) * step + P, (rows - 1) * step + P
    canvas = np.zeros((Hc, Wc + O, 3), np.float32)
    filled = np.zeros((Hc, Wc + O), bool)
    canvas[:H, :O] = seed_col; filled[:H, :O] = True
    for r in range(rows):
        for c in range(cols):
            y, x = r * step, c * step + O - O  # x relativo ao canvas (coluna-semente ocupa 0..O)
            x = c * step
            region = canvas[y:y+P, x:x+P]; known = filled[y:y+P, x:x+P]
            cand = ok[rng.choice(len(ok), size=min(600, len(ok)), replace=False)]
            ds = []
            for (sy, sx) in cand:
                patch = im[sy:sy+P, sx:sx+P]
                ds.append(((patch - region) ** 2).sum(-1)[known].mean() if known.any() else 0.0)
            ds = np.array(ds) * np.array([1 + 0.8 * uses.get(bucket(c_), 0) for c_ in cand])
            # tolerância: sorteia entre os pedaços até 15% piores que o melhor (variedade)
            good = np.flatnonzero(ds <= ds.min() * float(sys.argv[7] if len(sys.argv) > 7 else 1.15) + 1e-6)
            sy, sx = cand[rng.choice(good)]
            uses[bucket((sy, sx))] = uses.get(bucket((sy, sx)), 0) + 1
            patch = im[sy:sy+P, sx:sx+P]
            m = np.ones((P, P), bool)
            if known[:, :O].all() and x > 0 or (x == 0 and filled[y:y+P, :O].all()):
                err = ((patch[:, :O] - region[:, :O]) ** 2).sum(-1)
                m[:, :O] &= min_cut_v(err)
            if r > 0:
                err = ((patch[:O, :] - region[:O, :]) ** 2).sum(-1)
                m[:O, :] &= min_cut_v(err.T).T
            region[m] = patch[m]; known[m] = True
    return canvas[:H, O:O + width]

# Sobreposição suave com a borda da arte original (esconde a emenda).
B = 48
ramp = np.linspace(0, 1, B)[None, :, None]
right = quilt(E + B, im[:, W-B-O:W-B])
left = quilt(E + B, im[:, B:B+O][:, ::-1])[:, ::-1]
mid = im.copy()
mid[:, W-B:] = mid[:, W-B:] * (1 - ramp) + right[:, :B] * ramp
mid[:, :B] = mid[:, :B] * ramp + left[:, -B:] * (1 - ramp)
full = np.concatenate([left[:, :-B], mid, right[:, B:]], axis=1)
Image.fromarray(np.clip(full, 0, 255).astype(np.uint8)).save(out, quality=92)
