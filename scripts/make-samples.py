"""Generates the fictional German demo receipts in samples/.

Usage: python3 scripts/make-samples.py samples

All merchants, addresses and numbers are invented. Some receipts are rendered as
clean scans, some as phone photos (perspective, table background, blur, noise).
"""
import json, math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
REG = '/usr/share/fonts/google-noto/NotoSansMono-Regular.ttf'
BOLD = '/usr/share/fonts/google-noto/NotoSansMono-Bold.ttf'
random.seed(7)

W = 46  # characters per line


def row(left, right, width=W):
    return left + ' ' * max(1, width - len(left) - len(right)) + right


def center(text, width=W):
    return text.center(width).rstrip()


def eur(v):
    return f'{v:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


RECEIPTS = [
    dict(file='01-baeckerei.png', photo=False, merchant='Bäckerei Sonnenkorn', date='01.10.2026', time='07:42',
         head=['Bäckerei Sonnenkorn', 'Lindenallee 12', '10115 Berlin', 'Tel. 030 5550123'],
         items=[('4x Dinkelbrötchen', 3.20), ('2x Butterbrezel', 2.80), ('1x Mohnkuchen', 3.60), ('1x Bauernbrot 750g', 2.80)],
         rate=7, gross=12.40, net=11.59, vat=0.81, pay='BAR', given=20.00),
    dict(file='02-tankstelle.jpg', photo=True, merchant='Tankstelle Nordring GmbH', date='01.10.2026', time='18:05',
         head=['Tankstelle Nordring GmbH', 'Nordring 88', '22297 Hamburg'],
         items=[('Super E10  52,40 L x 1,800', 94.32)],
         rate=19, gross=94.32, net=79.26, vat=15.06, pay='EC-Karte'),
    dict(file='03-buerobedarf.png', photo=False, merchant='Büro Profi GmbH', date='02.10.2026', time='11:17',
         head=['Büro Profi GmbH', 'Schreibwaren & Bürobedarf', 'Marktstraße 3', '50667 Köln'],
         items=[('Druckerpapier A4 500 Bl.', 6.90), ('Toner TN-2420 schwarz', 54.90), ('Ordner breit 5 Stk.', 12.50),
                ('Kugelschreiber 10er', 12.60)],
         rate=19, gross=86.90, net=73.03, vat=13.87, pay='EC-Karte'),
    dict(file='04-hosting.png', photo=False, merchant='Cloudwerk Hosting GmbH', date='15.09.2026', time=None,
         invoice=True, rate=19, gross=28.56, net=24.00, vat=4.56),
    dict(file='05-cafe.jpg', photo=True, merchant='Café Morgenrot', date='24.09.2026', time='13:31',
         head=['Café Morgenrot', 'Kastanienweg 4', '80331 München'],
         items=[('2x Cappuccino', 7.80), ('1x Bagel Lachs', 9.50), ('1x Apfelschorle 0,4', 3.90), ('1x Cookie', 2.60)],
         rate=19, gross=23.80, net=20.00, vat=3.80, pay='EC-Karte'),
    dict(file='06-fahrkarte.png', photo=False, merchant='Nordexpress Reisen GmbH', date='18.09.2026', time='09:02',
         head=['Nordexpress Reisen GmbH', 'Fahrkarte / Ticket', 'Berlin Hbf -> Hamburg Hbf'],
         items=[('Fahrkarte 2. Klasse Flexpreis', 49.90)],
         rate=7, gross=49.90, net=46.64, vat=3.26, pay='Kreditkarte'),
    dict(file='07-mobilfunk.png', photo=False, merchant='Mobilfunk Plus GmbH', date='03.09.2026', time='10:00',
         head=['Mobilfunk Plus GmbH', 'Kundenservice-Shop', 'Hauptstraße 21', '04109 Leipzig'],
         items=[('Mobilfunk Tarif L 09/2026', 39.99)],
         rate=19, gross=39.99, net=33.61, vat=6.38, pay='EC-Karte'),
    dict(file='08-hofladen.jpg', photo=True, merchant='Hofladen Wiesengrund UG', date='27.08.2026', time='16:48',
         head=['Hofladen Wiesengrund UG', 'Am Wiesengrund 2', '14467 Potsdam'],
         items=[('Kartoffeln 2,5 kg', 4.50), ('Freilandeier 10 Stk.', 4.20), ('Apfelsaft 1 l', 3.30), ('Bergkäse 250 g', 6.50)],
         rate=7, gross=18.50, net=17.29, vat=1.21, pay='BAR', given=20.00, table=True),
]


def receipt_lines(r):
    L = []
    for h in r['head']:
        L.append(('b' if h == r['head'][0] else 'r', center(h)))
    L += [('r', ''), ('r', '-' * W)]
    for name, price in r['items']:
        L.append(('r', row(name, f'{eur(price)} {"A" if r["rate"] == 19 else "B"}')))
    L.append(('r', '-' * W))
    L.append(('b', row('SUMME EUR', eur(r['gross']))))
    L.append(('r', ''))
    if r.get('table'):
        L.append(('r', row('MwSt.%    Steuer       Netto', 'Brutto')))
        L.append(('r', row(f'B {r["rate"]}%     {eur(r["vat"])}        {eur(r["net"])}', eur(r['gross']))))
    else:
        L.append(('r', row('Netto', eur(r['net']))))
        L.append(('r', row(f'MwSt {r["rate"]}%', eur(r['vat']))))
    L.append(('r', ''))
    if r.get('given'):
        L.append(('r', row('Gegeben BAR', eur(r['given']))))
        L.append(('r', row('Rückgeld', eur(r['given'] - r['gross']))))
    else:
        L.append(('r', row(r['pay'], eur(r['gross']))))
    L += [('r', ''), ('r', f'Datum {r["date"]}   Uhrzeit {r["time"]}'), ('r', 'Bon-Nr. ' + str(random.randint(1000, 9999))),
          ('r', 'Steuer-Nr. 12/345/' + str(random.randint(10000, 99999))), ('r', ''), ('r', center('Vielen Dank für Ihren Einkauf!'))]
    return L


def invoice_lines(r):
    w = 60
    rw = lambda a, b: row(a, b, w)
    return [
        ('b', 'Cloudwerk Hosting GmbH'),
        ('r', 'Rechenzentrumsweg 7 · 90402 Nürnberg'),
        ('r', ''), ('r', ''),
        ('b', 'Rechnung R-2026-09-4711'),
        ('r', rw('Rechnungsdatum', r['date'])),
        ('r', rw('Leistungszeitraum', '01.09.2026 - 30.09.2026')),
        ('r', ''), ('r', '-' * w),
        ('r', rw('Cloud Server CX22 (2 vCPU, 4 GB RAM)', '18,00')),
        ('r', rw('Backup-Speicher 40 GB', '4,00')),
        ('r', rw('Primäre IPv4-Adresse', '2,00')),
        ('r', '-' * w),
        ('r', rw('Nettobetrag', eur(r['net']) + ' EUR')),
        ('r', rw('MwSt. 19%', eur(r['vat']) + ' EUR')),
        ('b', rw('Gesamtbetrag', eur(r['gross']) + ' EUR')),
        ('r', ''),
        ('r', 'Der Betrag wird per SEPA-Lastschrift eingezogen.'),
        ('r', 'USt-IdNr. DE999999999 · Amtsgericht Nürnberg'),
    ]


def render(lines, cols, size=30, pad=60, paper=(250, 249, 246)):
    reg, bold = ImageFont.truetype(REG, size), ImageFont.truetype(BOLD, size)
    cw = reg.getlength('M')
    lh = int(size * 1.45)
    img = Image.new('RGB', (int(cols * cw + 2 * pad), len(lines) * lh + 2 * pad), paper)
    d = ImageDraw.Draw(img)
    for i, (style, text) in enumerate(lines):
        d.text((pad, pad + i * lh), text, font=bold if style == 'b' else reg, fill=(28, 28, 30))
    return img


def table_texture(w, h, kind):
    if kind == 'wood':
        base = Image.new('RGB', (w, h))
        px = base.load()
        for y in range(h):
            for x in range(w):
                g = 0.5 + 0.5 * math.sin((x * 0.018) + math.sin(y * 0.004) * 3 + math.sin(x * 0.0021) * 5)
                px[x, y] = (int(120 + 50 * g), int(80 + 32 * g), int(48 + 18 * g))
        return base.filter(ImageFilter.GaussianBlur(1.5))
    color = {'slate': (68, 76, 88), 'teal': (40, 98, 96)}[kind]
    return Image.new('RGB', (w, h), color)


def photograph(receipt, kind, tilt):
    """Puts the receipt on a table, in perspective, with soft light and noise."""
    W2, H2 = 1500, 2000
    scale = min(W2 * 0.62 / receipt.width, H2 * 0.82 / receipt.height)
    rw, rh = receipt.width * scale, receipt.height * scale
    cx, cy = W2 / 2, H2 / 2
    # Destination corners: a trapezoid (camera tilted) rotated slightly.
    corners = [(-rw / 2 * 0.94, -rh / 2), (rw / 2 * 0.94, -rh / 2), (rw / 2, rh / 2), (-rw / 2, rh / 2)]
    a = math.radians(tilt)
    dst = [(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in corners]
    src = [(0, 0), (receipt.width, 0), (receipt.width, receipt.height), (0, receipt.height)]
    coeffs = perspective_coeffs(dst, src)
    warped = receipt.transform((W2, H2), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=(0, 0, 0))
    mask = Image.new('L', receipt.size, 255).transform((W2, H2), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=0)
    shadow = mask.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.45))
    bg = table_texture(W2, H2, kind)
    bg.paste((0, 0, 0), (14, 22), shadow)
    bg.paste(warped, (0, 0), mask)
    # Light falloff from one corner, slight blur, sensor noise.
    light = Image.radial_gradient('L').resize((W2 * 2, H2 * 2)).crop((W2 // 3, H2 // 4, W2 // 3 + W2, H2 // 4 + H2))
    bg = Image.composite(bg, Image.blend(bg, Image.new('RGB', (W2, H2), (0, 0, 0)), 0.28), light.point(lambda v: 255 - v))
    bg = bg.filter(ImageFilter.GaussianBlur(0.9))
    noise = Image.effect_noise((W2, H2), 10).convert('RGB')
    return Image.blend(bg, noise, 0.05)


def perspective_coeffs(dst, src):
    """Coefficients for PIL's PERSPECTIVE transform mapping dst → src."""
    import numpy as np
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return list(np.linalg.solve(np.array(A, float), np.array(b, float)))


truth = {}
for i, r in enumerate(RECEIPTS):
    if r.get('invoice'):
        img = render(invoice_lines(r), 60, size=26, pad=80, paper=(255, 255, 255))
    else:
        img = render(receipt_lines(r), W)
    if r['photo']:
        img = photograph(img, ['wood', 'slate', 'teal'][i % 3], [-4, 3, -2][i % 3])
        img.save(OUT / r['file'], quality=88)
    else:
        img.save(OUT / r['file'], optimize=True)
    d = r['date'].split('.')
    truth[r['file']] = dict(merchant=r['merchant'], date=f'{d[2]}-{d[1]}-{d[0]}', net=r['net'], vatAmount=r['vat'],
                            gross=r['gross'], vatRate=r['rate'] / 100)
(OUT / 'truth.json').write_text(json.dumps(truth, indent=1, ensure_ascii=False))
print('ok', len(truth))
