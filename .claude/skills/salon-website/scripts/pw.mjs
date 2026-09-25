// Playwright finden: erst PLAYWRIGHT_PFAD, dann das normale Paket, dann die
// globale Installation der Cloud-Umgebung.
export async function chromium() {
  const wege = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const w of wege) { try { return (await import(w)).chromium; } catch (e) { /* nächster */ } }
  throw new Error('Playwright nicht gefunden — PLAYWRIGHT_PFAD setzen');
}
