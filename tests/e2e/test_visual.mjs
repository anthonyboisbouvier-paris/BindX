import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8000/api';
const DIR = '/work/screenshots/v10';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  return res.json();
}

(async () => {
  let n = 0;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  async function shot(name) {
    n++;
    const p = `${DIR}/${String(n).padStart(2, '0')}_${name}.png`;
    await page.screenshot({ path: p });
    console.log(`  [${n}] ${name}`);
  }
  async function shotFull(name) {
    n++;
    const p = `${DIR}/${String(n).padStart(2, '0')}_${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(`  [${n}] ${name} (full)`);
  }

  try {
    // ---- STEP 1: Setup via API ----
    console.log('=== API SETUP ===');
    const ts = Date.now();

    // Register
    const regData = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `visual${ts}@t.dev`, username: `visual${ts}`, password: 'Test1234' }),
    });
    const token = regData.token;
    console.log('  Token:', token ? token.substring(0, 20) + '...' : 'MISSING');
    if (!token) { console.error('  FATAL: No token'); await browser.close(); return; }

    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // Create project
    const projData = await apiFetch('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'EGFR Visual Test', uniprot_id: 'P00533' }),
    });
    const projectId = projData.id;
    console.log('  Project:', projectId);

    // Create job
    const jobData = await apiFetch('/jobs', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ uniprot_id: 'P00533', mode: 'rapid', max_ligands: 5, project_id: projectId }),
    });
    const jobId = jobData.job_id;
    console.log('  Job:', jobId);

    // Poll job
    console.log('  Waiting for job...');
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      const status = await apiFetch(`/jobs/${jobId}`, { headers: authHeaders });
      process.stdout.write(`\r  ${status.progress || 0}% ${status.status}     `);
      if (status.status === 'completed' || status.status === 'failed') {
        console.log('');
        break;
      }
    }

    // ---- STEP 2: Browser screenshots ----
    console.log('\n=== SCREENSHOTS ===');

    // Set auth in browser
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.evaluate((t) => localStorage.setItem('dockit_token', t), token);
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(1500);

    // 1. Project list
    await shot('01_project_list');

    // 2. Project overview
    await page.goto(`${BASE}/project/${projectId}/overview`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('02_project_overview');

    // 3. Target setup
    await page.goto(`${BASE}/project/${projectId}/target`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('03_target_setup');

    // 4. Runs
    await page.goto(`${BASE}/project/${projectId}/runs`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('04_runs_list');

    // 5. Results
    await page.goto(`${BASE}/project/${projectId}/results`, { waitUntil: 'networkidle' });
    await sleep(3000);
    await shotFull('05_results_full');
    await shot('05b_results_viewport');

    // 6. Try tagging hits — look for tag buttons
    const tagBtns = page.locator('button:has-text("Hit"), button:has-text("hit"), button:has-text("Tag")');
    const tagCount = await tagBtns.count();
    console.log(`  Tag buttons found: ${tagCount}`);
    for (let i = 0; i < Math.min(3, tagCount); i++) {
      try { await tagBtns.nth(i).click({ timeout: 2000 }); await sleep(300); } catch {}
    }
    if (tagCount > 0) {
      await sleep(500);
      await shot('06_hits_tagged');
    }

    // 7. Optimization page
    await page.goto(`${BASE}/project/${projectId}/optimization`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('07_optimization_full');

    // Look for molecule cards to click
    const allCards = await page.locator('[class*="cursor-pointer"][class*="rounded"]').all();
    console.log(`  Clickable cards: ${allCards.length}`);

    // Try clicking first card
    if (allCards.length > 0) {
      await allCards[0].click();
      await sleep(4000); // Wait for ScaffoldAnalyzer to load
      await shotFull('08_scaffold_analyzer_full');
      await shot('08b_scaffold_analyzer_viewport');

      // Check for "Structural Analysis" text
      const saHeader = await page.locator('text=Structural Analysis').count();
      console.log(`  "Structural Analysis" visible: ${saHeader > 0}`);

      if (saHeader > 0) {
        // Scroll to it
        await page.locator('text=Structural Analysis').scrollIntoViewIfNeeded();
        await sleep(500);
        await shot('09_scaffold_visible');

        // Interact: freeze a position
        const modBtns = await page.locator('button:has-text("Modify")').all();
        console.log(`  Modify buttons: ${modBtns.length}`);
        if (modBtns.length > 0) {
          await modBtns[0].click();
          await sleep(300);
          await shot('10_position_frozen');
        }

        // Click group pills
        const pills = await page.locator('button.font-mono').all();
        console.log(`  Group pills: ${pills.length}`);
        for (let i = 0; i < Math.min(3, pills.length); i++) {
          await pills[i].click();
          await sleep(200);
        }
        await shot('11_groups_selected');

        // Full page with all interactions
        await shotFull('12_full_interacted');
      }
    } else {
      console.log('  No molecule cards found on optimization page');
      // Capture page text for debug
      const text = await page.textContent('body');
      console.log('  Page text (200 chars):', text.substring(0, 200));
    }

    // 8. Reports
    await page.goto(`${BASE}/project/${projectId}/reports`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await shot('13_reports');

    // 9. Legacy pages
    await page.goto(`${BASE}/run`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await shot('14_legacy_run');

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await sleep(500);
    await shot('15_login');

    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await sleep(500);
    await shot('16_register');

    console.log(`\n=== DONE: ${n} screenshots ===`);
  } catch (err) {
    console.error('FATAL:', err.message, err.stack);
    try { await page.screenshot({ path: `${DIR}/error.png`, fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }
})();
