import { assertPublicWebsiteUrl, normalizeWebsiteUrl } from "./siteAuditService.js";
import { saveGeneratedScreenshot } from "./assetStore.js";

const SCREENSHOT_TIMEOUT_MS = 30_000;

async function loadChromium() {
  try {
    const playwright = await import(/* webpackIgnore: true */ "playwright");
    return playwright.chromium;
  } catch {
    throw new Error("O navegador de captura ainda não foi instalado. Execute npm run install:browser.");
  }
}

async function createSafeRouter(context) {
  const checkedHosts = new Map();
  await context.route("**/*", async route => {
    const requestUrl = route.request().url();
    let parsed;
    try { parsed = new URL(requestUrl); } catch { return route.abort(); }
    if (["data:", "blob:", "about:"].includes(parsed.protocol)) return route.continue();
    if (!["http:", "https:"].includes(parsed.protocol)) return route.abort();
    const key = parsed.hostname.toLowerCase();
    let validation = checkedHosts.get(key);
    if (!validation) {
      validation = assertPublicWebsiteUrl(parsed).then(() => true).catch(() => false);
      checkedHosts.set(key, validation);
    }
    return (await validation) ? route.continue() : route.abort();
  });
}

async function captureViewport(browser, leadId, url, config) {
  const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1, isMobile: Boolean(config.isMobile), hasTouch: Boolean(config.isMobile), userAgent: config.userAgent, ignoreHTTPSErrors: false });
  await createSafeRouter(context);
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: SCREENSHOT_TIMEOUT_MS });
    if (!response) throw new Error("O site não retornou uma resposta para a captura.");
    await assertPublicWebsiteUrl(new URL(page.url()));
    await page.waitForTimeout(1200);
    const buffer = await page.screenshot({ type: "jpeg", quality: 76, fullPage: false });
    return saveGeneratedScreenshot(leadId, { buffer, kind: config.kind, label: config.label });
  } finally {
    await context.close();
  }
}

export async function captureWebsiteScreenshots(leadId, websiteUrl) {
  const normalized = normalizeWebsiteUrl(websiteUrl);
  await assertPublicWebsiteUrl(normalized);
  const chromium = await loadChromium();
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { throw new Error(`O navegador de captura não está disponível. Execute npm run install:browser. Detalhe: ${error.message}`); }
  try {
    const assets = [];
    assets.push(await captureViewport(browser, leadId, normalized.toString(), {
      kind: "site-desktop", label: "Captura automática do site — desktop", viewport: { width: 1440, height: 1000 }, isMobile: false,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36 LeadFlow/1.0",
    }));
    assets.push(await captureViewport(browser, leadId, normalized.toString(), {
      kind: "site-mobile", label: "Captura automática do site — celular", viewport: { width: 390, height: 844 }, isMobile: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1 LeadFlow/1.0",
    }));
    return assets;
  } finally {
    await browser.close();
  }
}
