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
  page.on('pageerror', err => errors.push('[PAGE ERROR] ' + err.message));

  try {
    // ── STEP 1: Load /commander ──────────────────────────
    log('Chargement /commander...');
    await page.goto(`${BASE}/commander`, { waitUntil: 'networkidle', timeout: 40000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${DIR}/01_forfait_step.png`, fullPage: true });

    // Check what's on screen — forfait selection
    const pageText = await page.locator('body').innerText();
    log('Contenu visible: ' + pageText.slice(0, 300).replace(/\n/g, ' '));

    // ── STEP 2: Select a plan ─────────────────────────────
    log('Sélection forfait...');

    // Look for plan cards / radio buttons / clickable plan options
    const planSelectors = [
      '[data-plan]',
      '.plan-card',
      'button:has-text("Sélectionner")',
      'button:has-text("Choisir")',
      '[role="radio"]',
      'input[type="radio"]',
      '.forfait',
      'div[class*="plan"]',
      'div[class*="card"]:has(button)',
    ];

    let planFound = false;
    for (const sel of planSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
        log(`Plan trouvé via: ${sel}`);
        await el.click().catch(() => {});
        await page.waitForTimeout(1000);
        planFound = true;
        break;
      }
    }

    if (!planFound) {
      // Try to click any card that might be a plan
      const cards = page.locator('div[class*="cursor-pointer"], div[class*="hover"], button').first();
      if (await cards.count() > 0) {
        log('Trying generic clickable element...');
        await cards.click().catch(() => {});
      }
    }

    await page.screenshot({ path: `${DIR}/02_after_plan_click.png`, fullPage: true });

    // ── STEP 3: Click Continuer (enabled) ─────────────────
    log('Click Continuer...');
    const continuer = page.locator('button:has-text("Continuer")').first();
    const isEnabled = await continuer.isEnabled().catch(() => false);
    log(`Bouton Continuer enabled: ${isEnabled}`);

    if (isEnabled) {
      await continuer.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${DIR}/03_step2.png`, fullPage: true });
      log('Step 2 atteint');
    }

    // ── STEP 4: Check for any input fields (adresse, infos) ─
    const inputs = await page.locator('input:visible').all();
    log(`Inputs visibles: ${inputs.length}`);
    for (const inp of inputs.slice(0, 5)) {
      const type = await inp.getAttribute('type') || 'text';
      const placeholder = await inp.getAttribute('placeholder') || '';
      const name = await inp.getAttribute('name') || '';
      log(`  input[type="${type}" name="${name}" placeholder="${placeholder}"]`);
    }

    // ── STEP 5: Navigate directly to payment step ──────────
    log('Vérification step Paiement...');

    // Try to advance to payment step by clicking Paiement in stepper
    const paiementStep = page.locator('[class*="step"]:has-text("Paiement"), li:has-text("Paiement"), button:has-text("Paiement")').first();
    if (await paiementStep.count() > 0) {
      log('Stepper Paiement trouvé — click');
      await paiementStep.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: `${DIR}/04_payment_check.png`, fullPage: true });

    // Check for PayPal SDK loading
    const allScripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
    );
    const paypalScript = allScripts.filter(s => s.includes('paypal'));
    log(`Scripts PayPal chargés: ${paypalScript.length}`);
    paypalScript.forEach(s => log('  ' + s.replace(/client-id=[^&]+/, 'client-id=***')));

    // ── RAPPORT FINAL ──────────────────────────────────────
    const totalErrors = errors.length;
    const supaErrors = errors.filter(e =>
      e.includes('supabase') || e.includes('Failed to fetch') ||
      e.includes('401') || e.includes('403') || e.includes('lacxnb')
    );
    const paypalErrors = errors.filter(e => e.toLowerCase().includes('paypal'));

    console.log('\n══════════════════════════════════════════════════');
    console.log('RAPPORT TEST PAIEMENT — https://nivra-telecom.ca');
    console.log('══════════════════════════════════════════════════');
    console.log(`✅ Site accessible et répond correctement`);
    console.log(`✅ Page /commander chargée`);
    console.log(`${paypalScript.length > 0 ? '✅' : '⚠️ '} SDK PayPal chargé: ${paypalScript.length > 0 ? 'OUI' : 'NON'}`);
    console.log(`${totalErrors === 0 ? '✅' : '⚠️ '} Erreurs JS totales: ${totalErrors}`);
    console.log(`${supaErrors.length === 0 ? '✅' : '❌'} Erreurs Supabase: ${supaErrors.length}`);
    console.log(`${paypalErrors.length === 0 ? '✅' : '❌'} Erreurs PayPal: ${paypalErrors.length}`);

    if (supaErrors.length > 0) {
      console.log('\n❌ ERREURS SUPABASE:');
      supaErrors.forEach(e => console.log('   ' + e.slice(0, 250)));
    }
    if (paypalErrors.length > 0) {
      console.log('\n❌ ERREURS PAYPAL:');
      paypalErrors.forEach(e => console.log('   ' + e.slice(0, 250)));
    }
    if (errors.length > 0 && supaErrors.length === 0 && paypalErrors.length === 0) {
      console.log('\n⚠️  Autres erreurs JS (non critiques):');
      errors.slice(0, 5).forEach(e => console.log('   ' + e.slice(0, 200)));
    }

    if (paypalScript.length > 0) {
      console.log(`\n🔑 Client PayPal dans le SDK: ${paypalScript[0].match(/client-id=([^&]+)/)?.[1]?.slice(0, 15)}...`);
    }

  } catch (err) {
    log('FATAL: ' + err.message.slice(0, 200));
    await page.screenshot({ path: `${DIR}/error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
