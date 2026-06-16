import { chromium } from './node_modules/playwright/index.mjs';

const BASE = 'https://nivra-telecom.ca';
const DIR = 'C:/Users/Lavau/.claude/jobs/e369c3ad/tmp';
const log = (msg) => console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`);
const errors = [];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('[PAGE ERR] ' + err.message));

  try {
    await page.goto(`${BASE}/commander`, { waitUntil: 'networkidle', timeout: 40000 });
    await page.waitForTimeout(3000);

    // Dismiss cookie popup if present
    const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("Accepter")').first();
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
      log('Cookie popup dismissed');
    }

    await page.screenshot({ path: `${DIR}/v2_01_initial.png`, fullPage: true });

    // Check for WebSocket errors (BOM indicator)
    const wsErrors = errors.filter(e => e.includes('%EF%BB%BF') || e.includes('BOM'));
    log(`WebSocket BOM errors: ${wsErrors.length}`);

    // Find the first clickable plan card button
    log('Looking for plan buttons...');
    const planBtns = await page.locator('button').all();
    log(`Total buttons: ${planBtns.length}`);

    // Try clicking a "Sélectionner" or similar button within a plan card
    let planSelected = false;
    for (const btn of planBtns) {
      const txt = await btn.innerText().catch(() => '');
      if (txt.match(/Sélectionner|Choisir|Select|Commander/i) && !txt.includes('Continuer')) {
        const visible = await btn.isVisible().catch(() => false);
        if (visible) {
          log(`Clicking plan button: "${txt.slice(0, 30)}"`);
          await btn.click();
          await page.waitForTimeout(1500);
          planSelected = true;
          break;
        }
      }
    }

    if (!planSelected) {
      // Try clicking the first card that looks like a plan (has a price)
      const priceItems = await page.locator('text=/\\d+\\$|\\$\\d+/').all();
      log(`Price elements: ${priceItems.length}`);
      if (priceItems.length > 0) {
        const firstCard = await priceItems[0].locator('xpath=ancestor::div[contains(@class,"card") or contains(@class,"forfait")]').first();
        if (await firstCard.count() > 0) {
          log('Clicking price card...');
          await firstCard.click();
          await page.waitForTimeout(1500);
          planSelected = true;
        }
      }
    }

    if (!planSelected) {
      // Last resort: click first plan item visible
      const allClickable = await page.locator('[class*="plan"], [class*="forfait"], [class*="card"]').all();
      for (const el of allClickable.slice(0, 5)) {
        if (await el.isVisible().catch(() => false)) {
          log('Clicking generic plan element...');
          await el.click();
          await page.waitForTimeout(1000);
          planSelected = true;
          break;
        }
      }
    }

    await page.screenshot({ path: `${DIR}/v2_02_after_select.png`, fullPage: true });

    // Check if Continuer is now enabled
    const continuer = page.locator('button:has-text("Continuer")').first();
    const isEnabled = await continuer.isEnabled().catch(() => false);
    log(`Continuer enabled: ${isEnabled}`);

    if (isEnabled) {
      await continuer.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${DIR}/v2_03_step2.png`, fullPage: true });
      log('Step 2 reached!');

      // Try to continue through steps
      for (let step = 0; step < 5; step++) {
        const nextBtn = page.locator('button:has-text("Continuer"), button:has-text("Suivant")').first();
        const enabled = await nextBtn.isEnabled().catch(() => false);
        if (enabled) {
          await nextBtn.click();
          await page.waitForTimeout(2000);
          log(`Advanced to step ${step + 3}`);
        } else break;
      }
      await page.screenshot({ path: `${DIR}/v2_04_final_step.png`, fullPage: true });
    }

    // Check for PayPal
    await page.waitForTimeout(3000);
    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
    );
    const paypalScripts = scripts.filter(s => s.includes('paypal'));
    const paypalIframes = await page.locator('iframe[src*="paypal"], iframe[title*="aypal"]').count();

    await page.screenshot({ path: `${DIR}/v2_05_paypal_check.png`, fullPage: true });

    // Check Supabase URL being used (verify no BOM)
    const supabaseUrl = await page.evaluate(() => {
      // Look for any network requests to supabase
      const meta = document.querySelector('meta[name="supabase-url"]');
      return meta ? meta.content : 'not found in meta';
    });
    log(`Supabase URL meta: ${supabaseUrl}`);

    // Count error types
    const supaErrors = errors.filter(e => e.includes('401') || e.includes('supabase'));
    const bomErrors = errors.filter(e => e.includes('%EF%BB%BF') || e.includes('BOM'));

    console.log('\n══════════════════════════════════════════════════');
    console.log('RAPPORT TEST PAIEMENT v2 — https://nivra-telecom.ca');
    console.log('══════════════════════════════════════════════════');
    console.log(`✅ Site accessible`);
    console.log(`✅ Plans chargés (page /commander se charge)`);
    console.log(`${bomErrors.length === 0 ? '✅' : '❌'} BOM dans les clés: ${bomErrors.length === 0 ? 'AUCUN (corrigé!)' : `${bomErrors.length} erreurs`}`);
    console.log(`${isEnabled ? '✅' : '⚠️ '} Plan sélectionnable et Continuer activé: ${isEnabled}`);
    console.log(`${paypalScripts.length > 0 || paypalIframes > 0 ? '✅' : '⚠️ '} PayPal présent: scripts=${paypalScripts.length} iframes=${paypalIframes}`);
    console.log(`Erreurs Supabase 401: ${supaErrors.length}`);
    console.log(`Total erreurs JS: ${errors.length}`);

    if (supaErrors.length > 0 && supaErrors.length <= 10) {
      console.log('\nErreurs Supabase:');
      supaErrors.forEach(e => console.log('  ' + e.slice(0, 200)));
    }

  } catch (err) {
    log('FATAL: ' + err.message.slice(0, 200));
    await page.screenshot({ path: `${DIR}/v2_error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
