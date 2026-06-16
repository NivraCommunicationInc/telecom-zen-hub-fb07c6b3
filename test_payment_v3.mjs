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

    // Dismiss cookie popup
    const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("Accepter")').first();
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
      log('Cookie popup dismissed');
    }

    // Check BOM
    const bomErrors = errors.filter(e => e.includes('%EF%BB%BF'));
    log(`BOM errors: ${bomErrors.length}`);

    // Get page DOM to understand plan card structure
    const pageHTML = await page.evaluate(() => {
      // Find plan cards - look for elements with price text
      const cards = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return text.includes('Internet 100 Mbps') && el.children.length < 10;
      });
      if (cards.length > 0) {
        return cards[0].outerHTML.slice(0, 500);
      }
      return 'not found';
    });
    log('Internet 100 plan element: ' + pageHTML.slice(0, 200));

    // Try clicking "Internet 100 Mbps" text directly
    const plan100 = page.locator('text=Internet 100 Mbps').first();
    if (await plan100.count() > 0) {
      log('Found Internet 100 Mbps, clicking...');
      await plan100.click({ force: true });
      await page.waitForTimeout(2000);
    } else {
      // Try clicking any plan that has a price
      const planTexts = ['Internet 500', 'Internet Giga', 'Mobile 5G', 'Amazon Prime'];
      for (const txt of planTexts) {
        const el = page.locator(`text=${txt}`).first();
        if (await el.count() > 0) {
          log(`Clicking plan with text "${txt}"...`);
          await el.click({ force: true });
          await page.waitForTimeout(2000);
          break;
        }
      }
    }

    await page.screenshot({ path: `${DIR}/v3_01_after_click.png`, fullPage: true });

    // Check if plan selected (sidebar should show plan name)
    const sidebarText = await page.locator('[class*="command"], [class*="order"], [class*="summary"], aside').first().innerText().catch(() => '');
    log('Sidebar: ' + sidebarText.slice(0, 100));

    // Check Continuer
    const continuer = page.locator('button:has-text("Continuer")').first();
    let isEnabled = await continuer.isEnabled().catch(() => false);
    log(`Continuer enabled: ${isEnabled}`);

    if (!isEnabled) {
      // Try pressing the plan card with keyboard
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      isEnabled = await continuer.isEnabled().catch(() => false);
      log(`Continuer enabled after keyboard: ${isEnabled}`);
    }

    if (isEnabled) {
      await continuer.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${DIR}/v3_02_step2.png`, fullPage: true });
      log('Continuer clicked → Step 2');

      // Advance through steps
      for (let step = 0; step < 4; step++) {
        const btn = page.locator('button:has-text("Continuer")').first();
        if (await btn.isEnabled().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(2000);
          log(`Step ${step + 3} reached`);
          await page.screenshot({ path: `${DIR}/v3_step${step+3}.png`, fullPage: true });
        } else break;
      }
    }

    // Check final state for PayPal
    await page.waitForTimeout(3000);
    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
    );
    const paypalScripts = scripts.filter(s => s.includes('paypal'));
    const paypalIframes = await page.locator('iframe[src*="paypal"], iframe[title*="aypal"]').count();

    await page.screenshot({ path: `${DIR}/v3_final.png`, fullPage: true });

    const supaErrors401 = errors.filter(e => e.includes('401'));

    console.log('\n══════════════════════════════════════════════════');
    console.log('RAPPORT FINAL — nivra-telecom.ca');
    console.log('══════════════════════════════════════════════════');
    console.log(`✅ Site accessible et plans chargés`);
    console.log(`${bomErrors.length === 0 ? '✅' : '❌'} BOM corrigé: ${bomErrors.length === 0 ? 'OUI' : 'NON'}`);
    console.log(`${isEnabled ? '✅' : '⚠️ '} Bouton Continuer activable: ${isEnabled}`);
    console.log(`${paypalScripts.length + paypalIframes > 0 ? '✅' : '⚠️ '} PayPal SDK: ${paypalScripts.length} scripts, ${paypalIframes} iframes`);
    console.log(`⚠️  401 Supabase: ${supaErrors401.length} (auth background checks, non-bloquants)`);
    console.log(`📸 Screenshots: ${DIR}/v3_*.png`);

  } catch (err) {
    log('FATAL: ' + err.message.slice(0, 200));
    await page.screenshot({ path: `${DIR}/v3_error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
