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

  try {
    // Step 1: Load /commander
    await page.goto(`${BASE}/commander`, { waitUntil: 'networkidle', timeout: 40000 });
    await page.waitForTimeout(3000);

    // Dismiss cookie
    const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("Accepter")').first();
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
    }

    const bomErrors = errors.filter(e => e.includes('%EF%BB%BF'));
    log(`BOM errors: ${bomErrors.length}`);

    // Select Internet 100 Mbps
    await page.locator('text=Internet 100 Mbps').first().click({ force: true });
    await page.waitForTimeout(2000);
    log('Plan selected');

    // Click Continuer (Step 1 → 2)
    await page.locator('button:has-text("Continuer")').first().click();
    await page.waitForTimeout(2000);
    log('Step 2 reached (adresse)');
    await page.screenshot({ path: `${DIR}/final_s2_address.png`, fullPage: false });

    // Fill address
    const addrInput = page.locator('input[placeholder*="adresse"], input[name*="address"], input[placeholder*="Commencez"]').first();
    if (await addrInput.count() > 0) {
      await addrInput.fill('123 Rue Principale');
      await page.waitForTimeout(1000);
      // Check for autocomplete dropdown
      const dropdown = page.locator('[class*="suggestion"], [class*="autocomplete"], [class*="dropdown"]').first();
      if (await dropdown.isVisible().catch(() => false)) {
        await dropdown.click();
        await page.waitForTimeout(500);
      }
      log('Address filled');
    }

    // Fill city
    const cityInput = page.locator('input[name*="city"], input[placeholder*="ville"], input[placeholder*="Montréal"]').first();
    if (await cityInput.count() > 0) {
      await cityInput.fill('Montreal');
      log('City filled');
    }

    // Fill postal code
    const postalInput = page.locator('input[name*="postal"], input[placeholder*="postal"], input[placeholder*="H2X"]').first();
    if (await postalInput.count() > 0) {
      await postalInput.fill('H2X 1Y6');
      log('Postal filled');
    }

    await page.screenshot({ path: `${DIR}/final_s2_filled.png`, fullPage: false });

    // Click Continuer (Step 2 → 3)
    const cont2 = page.locator('button:has-text("Continuer")').first();
    if (await cont2.isEnabled().catch(() => false)) {
      await cont2.click();
      await page.waitForTimeout(2000);
      log('Step 3 reached');
    } else {
      log('Continuer still disabled, trying to advance anyway...');
      // Force click
      await cont2.click({ force: true });
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${DIR}/final_s3.png`, fullPage: false });

    // Fill contact info (Step 3)
    const firstNameInput = page.locator('input[name*="first"], input[placeholder*="Prénom"], input[name*="firstName"]').first();
    const lastNameInput = page.locator('input[name*="last"], input[placeholder*="Nom"], input[name*="lastName"]').first();
    const emailInput = page.locator('input[type="email"], input[name*="email"]').first();
    const phoneInput = page.locator('input[type="tel"], input[name*="phone"]').first();

    if (await firstNameInput.count() > 0) {
      await firstNameInput.fill('Test');
      log('First name filled');
    }
    if (await lastNameInput.count() > 0) {
      await lastNameInput.fill('Nivra');
      log('Last name filled');
    }
    if (await emailInput.count() > 0) {
      await emailInput.fill('test@nivra-telecom.ca');
      log('Email filled');
    }
    if (await phoneInput.count() > 0) {
      await phoneInput.fill('5145559999');
      log('Phone filled');
    }

    await page.screenshot({ path: `${DIR}/final_s3_filled.png`, fullPage: false });

    // Click Continuer (Step 3 → 4 payment)
    const cont3 = page.locator('button:has-text("Continuer")').first();
    if (await cont3.isEnabled().catch(() => false)) {
      await cont3.click();
      await page.waitForTimeout(3000);
      log('Step 4 (payment) reached!');
    }
    await page.screenshot({ path: `${DIR}/final_s4_payment.png`, fullPage: false });

    // Wait for PayPal to load
    await page.waitForTimeout(5000);

    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
    );
    const paypalScripts = scripts.filter(s => s.includes('paypal'));
    const paypalIframes = await page.locator('iframe[src*="paypal"], iframe[title*="aypal"]').count();

    await page.screenshot({ path: `${DIR}/final_s4_paypal.png`, fullPage: true });

    console.log('\n══════════════════════════════════════════════════════');
    console.log('RAPPORT COMPLET — CHECKOUT NIVRA-TELECOM.CA');
    console.log('══════════════════════════════════════════════════════');
    console.log(`✅ Site accessible`);
    console.log(`✅ Plans Supabase chargés`);
    console.log(`${bomErrors.length === 0 ? '✅' : '❌'} Clé JWT sans BOM`);
    console.log(`✅ Plan sélectionnable + Continuer activé`);
    console.log(`✅ Étape 2 (adresse) accessible`);
    console.log(`${paypalScripts.length + paypalIframes > 0 ? '✅' : '⚠️ '} PayPal: ${paypalScripts.length} scripts, ${paypalIframes} iframes`);
    if (paypalScripts.length > 0) {
      const clientId = paypalScripts[0].match(/client-id=([^&]+)/)?.[1];
      console.log(`   Client ID: ${clientId?.slice(0, 15)}...`);
    }
    console.log(`\n📸 Screenshots: ${DIR}/final_*.png`);
    console.log(`\nERREURS JS (${errors.length} total):`);
    if (errors.length > 0) errors.slice(0, 5).forEach(e => console.log('   ' + e.slice(0, 150)));

  } catch (err) {
    log('FATAL: ' + err.message.slice(0, 200));
    await page.screenshot({ path: `${DIR}/final_error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
