// Captures the landing-page screenshots and catalog card images from the hosted example.
//
//   npm run build:example        # refresh docs/try/ first if the UI changed
//   npm run capture              # writes docs/images/*.jpg and docs/catalog/*.jpg
//
// Runs headless Chromium at a fixed 1600x1000 viewport in a fresh browser with no sign-in,
// so only synthetic sample data can appear. Review every image before publishing anyway.
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");
const BASE = "/sfguide-contact-driver-analytics/try"; // must match basePath in next.config.ts
const CARD_ID = "contact-driver-analytics";
const VIEWPORT = { width: 1600, height: 1000 };
const PAGE_SCALE = 1;    // 1600x1000 landing-page images
const CARD_SCALE = 0.6;  // 960x600 catalog cards

const tab = (name) => async (page) => { await page.getByRole("tab", { name }).click(); };

const SHOTS = [
  { name: "01-dashboard", card: 1 },
  { name: "02-contact-drivers", card: 2, act: tab("Contact Drivers") },
  {
    name: "03-call-detail", card: 3,
    async act(page) {
      await page.getByText("Escalations", { exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByText("Complaint").first().click();
      await dialog.getByText("AI Summary").waitFor();
    },
  },
  {
    name: "04-ai-insights", card: 4,
    async act(page) {
      await tab("AI Insights")(page);
      await page.getByRole("button", { name: "Generate Insights" }).click();
      await page.getByText("Sample: scripted text").waitFor({ timeout: 15000 });
    },
  },
  {
    name: "05-live-setup",
    async act(page) {
      await page.locator("[role=radio]").nth(1).click();
      await page.getByRole("dialog").waitFor();
    },
  },
];

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon" };

// Serves docs/try/ at the GitHub Pages path, the way the hosted example is published.
function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
    let file = normalize(join(DOCS, "try", decodeURIComponent(url.pathname.slice(BASE.length))));
    if (!file.startsWith(join(DOCS, "try"))) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500); // Recharts animations finish
}

async function main() {
  if (!existsSync(join(DOCS, "try", "index.html"))) throw new Error("docs/try/ is missing. Run `npm run build:example` first.");
  mkdirSync(join(DOCS, "images"), { recursive: true });
  mkdirSync(join(DOCS, "catalog"), { recursive: true });
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}${BASE}/`;
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      for (const [scale, out, quality] of [
        [PAGE_SCALE, join(DOCS, "images", `${shot.name}.jpg`), 85],
        ...(shot.card ? [[CARD_SCALE, join(DOCS, "catalog", `${CARD_ID}-${shot.card}.jpg`), 72]] : []),
      ]) {
        const context = await browser.newContext({
          viewport: VIEWPORT, deviceScaleFactor: scale, colorScheme: "light", reducedMotion: "reduce",
          locale: "en-US", timezoneId: "America/New_York",
        });
        const page = await context.newPage();
        await page.goto(origin);
        await page.getByText("Calls (latest week)").waitFor();
        await settle(page);
        if (shot.act) { await shot.act(page); await settle(page); }
        await page.screenshot({ path: out, type: "jpeg", quality });
        await context.close();
        console.log(`${out.replace(ROOT + "/", "")}  ${Math.round(statSync(out).size / 1024)} KB`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((failure) => { console.error(failure.message); process.exit(1); });
