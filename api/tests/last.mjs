// Last: viele gleichzeitige Buchungen auf zufällige Plätze. Danach darf
// keine Person irgendwo doppelt belegt sein (Prüfung per SQL, siehe unten).
//   node api/tests/last.mjs http://127.0.0.1:8098/api/ 200
const API = process.argv[2] || 'http://127.0.0.1:8098/api/';
const N = +(process.argv[3] || 200);
const kat = await (await fetch(API + '?a=katalog')).json();
const tage = []; const d = new Date(); d.setDate(d.getDate() + 3);
while (tage.length < 3) { if (d.getDay() >= 2 && d.getDay() <= 5) tage.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
const zufall = (a) => a[Math.floor(Math.random() * a.length)];
const auftraege = Array.from({ length: N }, (_, i) => {
  const l = zufall(kat.leistungen.filter((x) => x.dauer <= 180));
  const h = 9 + Math.floor(Math.random() * 8), m = zufall(['00', '15', '30', '45']);
  return { salon: l.salon, leistungen: [l.id], person: Math.random() < 0.5 ? zufall(l.personen) : undefined,
    start: `${zufall(tage)} ${String(h).padStart(2, '0')}:${m}`, name: 'Last ' + i, telefon: '0170 ' + (5000000 + i), einwilligung: true };
});
const t0 = Date.now();
const res = await Promise.all(auftraege.map((a) => fetch(API + '?a=buchen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }).then((r) => r.status)));
const z = {}; for (const s of res) z[s] = (z[s] || 0) + 1;
console.log(JSON.stringify({ anfragen: N, ms: Date.now() - t0, status: z }));
if (z[500]) process.exit(1);
