import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8000/api';
const DIR = '/screenshots/configured';

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
    console.log('=== SETUP ===');
    const ts = Date.now();

    // Register
    const regData = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `cfg${ts}@t.dev`, username: `cfg${ts}`, password: 'Test1234' }),
    });
    const token = regData.token;
    if (!token) { console.error('No token'); await browser.close(); return; }
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // Create project
    const projData = await apiFetch('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'EGFR Drug Discovery', description: 'Screening inhibitors against EGFR for oncology', uniprot_id: 'P00533' }),
    });
    const projectId = projData.id;
    console.log('  Project:', projectId);

    // Set target_preview_json directly to mark target as configured
    const targetConfig = {
      configured_at: new Date().toISOString(),
      uniprot_id: 'P00533',
      protein_name: 'Epidermal growth factor receptor',
      structure: { source: 'pdb_holo', pdb_id: '1M17', resolution: 2.6 },
      pockets: [
        { probability: 0.92, residues: 'L718,V726,A743,K745,E762,L788,T790,Q791,L792,M793,G796,C797', volume: 486 },
        { probability: 0.71, residues: 'D855,L858,F856', volume: 234 }
      ],
      selected_pocket_idx: 0,
      chembl_info: { has_data: true, n_actives: 4523, n_assays: 1891 },
      assessment: {
        overall_score: 82,
        druggability_score: 88,
        data_score: 75,
        structural_score: 78,
        summary: 'EGFR is a well-validated drug target with high druggability'
      }
    };

    await apiFetch(`/projects/${projectId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ target_preview_json: targetConfig }),
    });
    console.log('  Target configured via API');

    // Create and wait for a job
    const jobData = await apiFetch('/jobs', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ uniprot_id: 'P00533', mode: 'rapid', max_ligands: 5, project_id: projectId }),
    });
    const jobId = jobData.job_id;
    console.log('  Job:', jobId);

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

    // Set auth in browser
    console.log('\n=== SCREENSHOTS ===');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.evaluate((t) => localStorage.setItem('dockit_token', t), token);
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(1500);

    // 1. Overview WITH target configured
    await page.goto(`${BASE}/project/${projectId}/overview`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('overview_configured');

    // 2. Target setup (now shows configured state with stepper progress)
    await page.goto(`${BASE}/project/${projectId}/target`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('target_configured');

    // 3. Runs page - should show the run now!
    await page.goto(`${BASE}/project/${projectId}/runs`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('runs_with_data');

    // 4. Results page
    await page.goto(`${BASE}/project/${projectId}/results`, { waitUntil: 'networkidle' });
    await sleep(3000);
    await shotFull('results_with_data');

    // 5. Scroll down on results to see the table
    await page.evaluate(() => window.scrollBy(0, 600));
    await sleep(1000);
    await shot('results_scrolled');

    // 6. Optimization page
    await page.goto(`${BASE}/project/${projectId}/optimization`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('optimization_with_data');

    // 7. Click a molecule card if present
    const molCards = page.locator('[class*="cursor-pointer"]');
    const molCount = await molCards.count();
    console.log(`  Molecule cards: ${molCount}`);
    if (molCount > 0) {
      await molCards.first().click();
      await sleep(3000);
      await shotFull('scaffold_analyzer');
    }

    // 8. Reports page
    await page.goto(`${BASE}/project/${projectId}/reports`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shotFull('reports_with_data');

    // 9. Project list (with populated project)
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(1500);
    await shot('project_list_populated');

    console.log(`\n=== DONE: ${n} screenshots ===`);
  } catch (err) {
    console.error('FATAL:', err.message, err.stack);
    try { await page.screenshot({ path: `${DIR}/error.png`, fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }
})();
