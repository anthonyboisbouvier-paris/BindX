import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8000/api';
const DIR = '/home/antho/dockit/screenshots/ux_audit';

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
      body: JSON.stringify({ email: `ux${ts}@t.dev`, username: `uxaudit${ts}`, password: 'Test1234' }),
    });
    const token = regData.token;
    console.log('  Token:', token ? token.substring(0, 20) + '...' : 'MISSING');
    if (!token) { console.error('  FATAL: No token'); await browser.close(); return; }
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // Create project
    const projData = await apiFetch('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'EGFR Drug Discovery', description: 'Screening inhibitors against Epidermal Growth Factor Receptor (EGFR) for oncology research', uniprot_id: 'P00533' }),
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
    let jobStatus = 'pending';
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      const status = await apiFetch(`/jobs/${jobId}`, { headers: authHeaders });
      process.stdout.write(`\r  ${status.progress || 0}% ${status.status}     `);
      jobStatus = status.status;
      if (status.status === 'completed' || status.status === 'failed') {
        console.log('');
        break;
      }
    }

    // ---- STEP 2: Screenshots ----
    console.log('\n=== SCREENSHOTS ===');

    // Set auth in browser
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.evaluate((t) => localStorage.setItem('dockit_token', t), token);
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(1500);

    // 1. Login page (before auth)
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await sleep(500);
    await shot('login_page');

    // 2. Register page
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await sleep(500);
    await shot('register_page');

    // 3. Project list
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate((t) => localStorage.setItem('dockit_token', t), token);
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(1500);
    await shot('project_list');

    // 4. Project overview (target NOT configured)
    await page.goto(`${BASE}/project/${projectId}/overview`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('project_overview_no_target');

    // 5. Target setup (step 1 only)
    await page.goto(`${BASE}/project/${projectId}/target`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await shot('target_setup_step1');

    // 6. Runs page (target not configured guard)
    await page.goto(`${BASE}/project/${projectId}/runs`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await shot('runs_guard');

    // 7. Results page (target not configured guard)
    await page.goto(`${BASE}/project/${projectId}/results`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await shot('results_guard');

    // 8. Optimization page (target not configured guard)
    await page.goto(`${BASE}/project/${projectId}/optimization`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await shot('optimization_guard');

    // 9. Now configure target through the UI!
    console.log('\n  --- Configuring target via UI ---');
    await page.goto(`${BASE}/project/${projectId}/target`, { waitUntil: 'networkidle' });
    await sleep(1000);

    // Fill UniProt ID and click Validate
    const uniprotInput = page.locator('input[placeholder*="P00533"], input[value="P00533"]').first();
    await uniprotInput.fill('P00533');
    await sleep(200);

    const validateBtn = page.locator('button:has-text("Validate")').first();
    await validateBtn.click();
    console.log('  Clicked Validate...');

    // Wait for validation to complete (structures appear)
    await sleep(8000);
    await shotFull('target_after_validate');

    // Try to find and click "Select" or structure card
    const structureCards = page.locator('button:has-text("Select"), [class*="cursor-pointer"]');
    const scCount = await structureCards.count();
    console.log(`  Structure options: ${scCount}`);
    if (scCount > 0) {
      await structureCards.first().click();
      await sleep(3000);
      await shotFull('target_structure_selected');
    }

    // Find pocket selection
    const pocketBtns = page.locator('button:has-text("Select Pocket"), button:has-text("Choose"), button:has-text("Pocket")');
    const pocketCount = await pocketBtns.count();
    console.log(`  Pocket options: ${pocketCount}`);
    if (pocketCount > 0) {
      await pocketBtns.first().click();
      await sleep(2000);
      await shotFull('target_pocket_selected');
    }

    // Find Save/Confirm button
    const saveBtns = page.locator('button:has-text("Save"), button:has-text("Confirm"), button:has-text("Continue")');
    const saveCount = await saveBtns.count();
    console.log(`  Save buttons: ${saveCount}`);
    for (let i = 0; i < saveCount; i++) {
      const btn = saveBtns.nth(i);
      const text = await btn.textContent();
      console.log(`    Button ${i}: "${text}"`);
      if (text.includes('Save') || text.includes('Confirm')) {
        await btn.click();
        await sleep(2000);
        break;
      }
    }
    await shotFull('target_configured');

    // 10. Now go to overview with target configured
    await page.goto(`${BASE}/project/${projectId}/overview`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('overview_with_target');

    // 11. Runs page (should now be accessible)
    await page.goto(`${BASE}/project/${projectId}/runs`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('runs_list');

    // 12. Results page
    await page.goto(`${BASE}/project/${projectId}/results`, { waitUntil: 'networkidle' });
    await sleep(3000);
    await shotFull('results_page');

    // 13. Optimization page
    await page.goto(`${BASE}/project/${projectId}/optimization`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('optimization_page');

    // 14. Reports page
    await page.goto(`${BASE}/project/${projectId}/reports`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('reports_page');

    // 15. Legacy run page
    await page.goto(`${BASE}/run`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await shot('legacy_run');

    console.log(`\n=== DONE: ${n} screenshots ===`);
  } catch (err) {
    console.error('FATAL:', err.message, err.stack);
    try { await page.screenshot({ path: `${DIR}/error.png`, fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }
})();
