import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8000/api';
const DIR = '/home/antho/dockit/screenshots/e2e_full';

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

  // Log console errors
  page.on('pageerror', err => console.error('  PAGE ERROR:', err.message));

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
    console.log('=== PHASE 1: AUTH ===');
    const ts = Date.now();

    // 1. Login page
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await sleep(800);
    await shot('login_page');

    // 2. Register page
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await sleep(800);
    await shot('register_page');

    // 3. Register a user via API
    const regData = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `e2e${ts}@test.dev`, username: `e2e_user_${ts}`, password: 'Test1234' }),
    });
    const token = regData.token;
    if (!token) { console.error('No token!'); await browser.close(); return; }
    console.log('  Registered:', regData.username || `e2e_user_${ts}`);
    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Set auth in browser
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.evaluate((t) => localStorage.setItem('dockit_token', t), token);
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(1500);

    console.log('\n=== PHASE 2: PROJECT CREATION ===');

    // 4. Empty project list
    await shot('project_list_empty');

    // 5. Click New Project button
    const newProjBtn = page.locator('button:has-text("New Project")');
    if (await newProjBtn.count() > 0) {
      await newProjBtn.first().click();
      await sleep(1000);
      await shot('new_project_modal');

      // Fill form
      const nameInput = page.locator('input[placeholder*="project"], input[name="name"]').first();
      if (await nameInput.count() > 0) {
        await nameInput.fill('EGFR Drug Discovery');
        await sleep(200);
      }
      const descInput = page.locator('textarea, input[placeholder*="description"], input[name="description"]').first();
      if (await descInput.count() > 0) {
        await descInput.fill('High-throughput virtual screening against EGFR for oncology drug discovery');
        await sleep(200);
      }
      const uniprotInput = page.locator('input[placeholder*="P00533"], input[name="uniprot_id"], input[placeholder*="UniProt"]').first();
      if (await uniprotInput.count() > 0) {
        await uniprotInput.fill('P00533');
        await sleep(200);
      }
      await shot('new_project_filled');

      // Submit
      const createBtn = page.locator('button:has-text("Create")').first();
      if (await createBtn.count() > 0) {
        await createBtn.click();
        await sleep(2000);
      }
    }

    // Get project ID from URL or API
    let projectId;
    const projects = await apiFetch('/projects', { headers: authHeaders });
    if (projects.length > 0) {
      projectId = projects[0].id;
    } else {
      // Create via API as fallback
      const proj = await apiFetch('/projects', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ name: 'EGFR Drug Discovery', description: 'Screening EGFR inhibitors', uniprot_id: 'P00533' }),
      });
      projectId = proj.id;
    }
    console.log('  Project ID:', projectId);

    // 6. Project overview (no target)
    await page.goto(`${BASE}/project/${projectId}/overview`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('overview_no_target');

    console.log('\n=== PHASE 3: TARGET SETUP ===');

    // 7. Target setup initial
    await page.goto(`${BASE}/project/${projectId}/target`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await shot('target_step1_initial');

    // 8. Click Validate (UniProt ID should be pre-filled from project)
    const validateBtn = page.locator('button:has-text("Validate")').first();
    if (await validateBtn.count() > 0) {
      // Ensure P00533 is in the input
      const uInput = page.locator('input').filter({ hasText: '' }).first();
      const uInputVal = await page.locator('input[type="text"]').first().inputValue().catch(() => '');
      if (!uInputVal || !uInputVal.includes('P00533')) {
        const textInputs = page.locator('input[type="text"]');
        for (let i = 0; i < await textInputs.count(); i++) {
          const val = await textInputs.nth(i).inputValue();
          if (val === '' || val === 'P00533') {
            await textInputs.nth(i).fill('P00533');
            break;
          }
        }
      }
      await sleep(300);
      await validateBtn.click();
      console.log('  Clicked Validate...');
    }

    // Wait for validation (structure fetching, pocket detection)
    console.log('  Waiting for validation...');
    await sleep(12000);
    await shotFull('target_after_validate');

    // 9. Select structure if multiple options
    const structCards = page.locator('[class*="cursor-pointer"]').filter({ hasText: 'PDB' });
    const structCount = await structCards.count();
    console.log(`  Structure cards: ${structCount}`);
    if (structCount > 0) {
      await structCards.first().click();
      await sleep(1000);
    }

    // 10. Scroll to pockets
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await sleep(1000);
    await shot('target_pockets_visible');

    // 11. Select pocket (first one if radio/card)
    const pocketCards = page.locator('text=Pocket 1');
    if (await pocketCards.count() > 0) {
      await pocketCards.first().click();
      await sleep(500);
    }

    // 12. Scroll to bottom for save
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000);
    await shot('target_ready_to_save');

    // 13. Click Save Configuration
    const saveBtn = page.locator('button:has-text("Save Target"), button:has-text("Save Configuration")').first();
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      console.log('  Saving target configuration...');
      await sleep(3000);
      await shotFull('target_saved');
    }

    // Refresh to see configured state
    await page.goto(`${BASE}/project/${projectId}/target`, { waitUntil: 'networkidle' });
    await sleep(3000);
    await shotFull('target_configured_full');

    console.log('\n=== PHASE 4: RUN SCREENING ===');

    // 14. Overview with target configured
    await page.goto(`${BASE}/project/${projectId}/overview`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('overview_with_target');

    // 15. Go to Runs page
    await page.goto(`${BASE}/project/${projectId}/runs`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await shot('runs_empty');

    // 16. Create New Run
    const newRunBtn = page.locator('button:has-text("Create New Run"), button:has-text("New Run")');
    if (await newRunBtn.count() > 0) {
      await newRunBtn.first().click();
      await sleep(1500);
      await shot('new_run_modal');
    }

    // Submit the run via API (more reliable than form interaction)
    const jobData = await apiFetch('/jobs', {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ uniprot_id: 'P00533', mode: 'rapid', max_ligands: 5, project_id: projectId }),
    });
    const jobId = jobData.job_id;
    console.log('  Job ID:', jobId);

    // 17. Runs page with active job
    await page.goto(`${BASE}/project/${projectId}/runs`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('runs_active_job');

    // 18. Wait for job completion
    console.log('  Waiting for job...');
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      const status = await apiFetch(`/jobs/${jobId}`, { headers: authHeaders });
      process.stdout.write(`\r  ${status.progress || 0}% ${status.status}     `);
      if (status.status === 'completed' || status.status === 'failed') {
        console.log('');
        break;
      }
      // Screenshot at key progress points
      if (i === 5 || i === 15) {
        await page.goto(`${BASE}/project/${projectId}/runs`, { waitUntil: 'networkidle' });
        await sleep(1000);
        await shot(`runs_progress_${status.progress || 0}pct`);
      }
    }

    // 19. Runs page completed
    await page.goto(`${BASE}/project/${projectId}/runs`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('runs_completed');

    console.log('\n=== PHASE 5: RESULTS ===');

    // 20. Results page
    await page.goto(`${BASE}/project/${projectId}/results`, { waitUntil: 'networkidle' });
    await sleep(3000);
    await shotFull('results_full');

    // 21. Click on different molecules in table
    const molRows = page.locator('tr').filter({ hasText: 'CHEMBL' });
    const rowCount = await molRows.count();
    console.log(`  Molecule rows: ${rowCount}`);
    if (rowCount > 1) {
      await molRows.nth(1).click();
      await sleep(2000);
      await shot('results_molecule2_selected');
    }

    // 22. Tag some hits
    const hitBtns = page.locator('button:has-text("Hit"), button:has-text("hit")');
    const hitCount = await hitBtns.count();
    console.log(`  Hit buttons: ${hitCount}`);
    for (let i = 0; i < Math.min(2, hitCount); i++) {
      try {
        await hitBtns.nth(i).click({ timeout: 2000 });
        await sleep(500);
      } catch {}
    }
    if (hitCount > 0) {
      await sleep(500);
      await shot('results_hits_tagged');
    }

    // 23. Auto-select hits button
    const autoHitBtn = page.locator('button:has-text("Auto-Select Hits")');
    if (await autoHitBtn.count() > 0) {
      await autoHitBtn.first().click();
      await sleep(1500);
      await shot('results_auto_hits');
    }

    // 24. Scroll to Pareto front
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(1000);
    await shot('results_pareto_front');

    // 25. Scroll to downloads
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000);
    await shot('results_downloads');

    console.log('\n=== PHASE 6: OPTIMIZATION ===');

    // 26. Optimization page
    await page.goto(`${BASE}/project/${projectId}/optimization`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('optimization_page');

    // 27. Click molecule card if any
    const optCards = page.locator('[class*="cursor-pointer"]').filter({ hasText: 'CHEMBL' });
    const optCardCount = await optCards.count();
    console.log(`  Optimization molecule cards: ${optCardCount}`);
    if (optCardCount > 0) {
      await optCards.first().click();
      await sleep(3000);
      await shotFull('optimization_scaffold_analyzer');

      // Scroll to scaffold analyzer
      const scaffoldHeader = page.locator('text=Structural Analysis');
      if (await scaffoldHeader.count() > 0) {
        await scaffoldHeader.scrollIntoViewIfNeeded();
        await sleep(500);
        await shot('scaffold_analyzer_visible');
      }
    }

    console.log('\n=== PHASE 7: REPORTS ===');

    // 28. Reports page
    await page.goto(`${BASE}/project/${projectId}/reports`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('reports_full');

    // 29. Scroll to report content
    await page.evaluate(() => window.scrollBy(0, 400));
    await sleep(1000);
    await shot('reports_content');

    console.log('\n=== PHASE 8: FINAL OVERVIEW ===');

    // 30. Final overview with all data
    await page.goto(`${BASE}/project/${projectId}/overview`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('final_overview');

    // 31. Project list with populated project
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(1500);
    await shot('final_project_list');

    console.log(`\n=== DONE: ${n} screenshots in ${DIR} ===`);
  } catch (err) {
    console.error('FATAL:', err.message, err.stack);
    try { await page.screenshot({ path: `${DIR}/error.png`, fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }
})();
