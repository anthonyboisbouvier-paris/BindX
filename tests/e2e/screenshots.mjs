import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // 1. Screenshot de la page d'accueil (InputForm)
  console.log('1. Capturing input form...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/antho/dockit/screenshot_input.png', fullPage: true });
  console.log('   -> screenshot_input.png');

  // 2. Cliquer sur "Exemple EGFR" et lancer le screening
  console.log('2. Launching EGFR screening...');
  await page.click('button:has-text("Exemple EGFR")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/antho/dockit/screenshot_form_filled.png', fullPage: true });
  console.log('   -> screenshot_form_filled.png');

  // Réduire le nombre de ligands pour aller vite
  await page.fill('#max-ligands', '5');
  await page.click('button:has-text("Lancer le screening")');
  await page.waitForTimeout(2000);

  // 3. Screenshot de la barre de progression
  console.log('3. Capturing progress bar...');
  await page.screenshot({ path: '/home/antho/dockit/screenshot_progress.png', fullPage: true });
  console.log('   -> screenshot_progress.png');

  // 4. Attendre la fin du job (max 3 minutes)
  console.log('4. Waiting for job completion...');
  try {
    await page.waitForSelector('text=Resultats du screening', { timeout: 180000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('   Timeout waiting for results, taking screenshot anyway');
  }

  // 5. Screenshot des résultats
  console.log('5. Capturing results...');
  await page.screenshot({ path: '/home/antho/dockit/screenshot_results.png', fullPage: true });
  console.log('   -> screenshot_results.png');

  // 6. Cliquer sur le premier résultat dans le tableau pour voir la pose
  try {
    const firstRow = await page.$('table tbody tr:first-child');
    if (firstRow) {
      await firstRow.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/home/antho/dockit/screenshot_pose.png', fullPage: true });
      console.log('   -> screenshot_pose.png');
    }
  } catch (e) {
    console.log('   Could not click result row:', e.message);
  }

  await browser.close();
  console.log('\nDone! All screenshots saved.');
})();
