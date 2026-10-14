// Gemeinsame Hilfen der Prüfskripte.

/** Gesetzliche Feiertage in Bayern (wie api/lib/basis.php), als Menge „YYYY-MM-DD“. */
export function feiertage(j) {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), ta = ((h + l - 7 * m + 114) % 31) + 1;
  const o = new Date(Date.UTC(j, mo - 1, ta));
  const plus = (n) => new Date(o.getTime() + n * 86400000).toISOString().slice(0, 10);
  return new Set([`${j}-01-01`, `${j}-01-06`, plus(-2), plus(1), `${j}-05-01`, plus(39), plus(50), plus(60), `${j}-08-15`, `${j}-10-03`, `${j}-11-01`, `${j}-12-25`, `${j}-12-26`]);
}
