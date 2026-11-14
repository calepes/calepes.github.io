const {createHash} = require('node:crypto');
const DELAYS = [2000, 4000, 8000, 16000, 30000];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = text => createHash('sha256').update(text).digest('hex');
function artifactName(run, attempt) {
 if (!/^\d+$/.test(String(run)) || !/^[1-9]\d*$/.test(String(attempt))) throw Error('Invalid package identity');
 return `pages-${run}-${attempt}`;
}
async function waitForArtifact(list, expected, pause = sleep) {
 for (let i = 0; i <= DELAYS.length; i++) {
  const matches = (await list()).filter(a => a.name === expected.name);
  if (matches.length > 1) throw Error(`Duplicate artifacts: ${expected.name}; refusing to select or delete`);
  if (matches.length === 1) {
   const a = matches[0];
   if (String(a.id) !== String(expected.id) || !(a.size > 0)) throw Error('Unexpected artifact identity or empty package');
   return a;
  }
  console.log(`Artifact not visible: observation ${i + 1}/6 (${expected.name})`);
  if (i < DELAYS.length) await pause(DELAYS[i]);
 }
 throw Error(`Artifact not visible after six observations: ${expected.name}; no deployment created`);
}
function retryDisposition(steps) {
 if (steps.some(s => s.conclusion !== 'success' && s.conclusion !== 'skipped')) throw Error('Reconcile prior deployment creation before retrying; outcome may be uncertain');
 return steps.some(s => s.conclusion === 'success') ? 'verify' : 'create';
}
function validateProvenance(a, expected) {
 if (String(a.id) !== expected.id || a.name !== expected.name || a.expired || !(a.size_in_bytes > 0) || String(a.workflow_run?.id) !== expected.run || a.workflow_run?.head_sha !== expected.commit)
  throw Error('Unexpected artifact provenance (ID/name/run/commit/expiry/size); no deployment created');
}
async function verifyPublication(get, base, expected, pause = sleep, reuse = false) {
 const origin = new URL(base).origin;
 if (!base.startsWith('https://')) throw Error('Publication URL must use HTTPS');
 let last;
 for (let i = 0; i <= DELAYS.length; i++) {
  try {
   const read = async path => {
    const url = new URL(path, base); url.searchParams.set('build', `${expected.commit}-${expected.run}`);
    const r = await get(url.href);
    if ([401,403].includes(r.status)) throw Object.assign(Error(`Public permission error ${r.status}`),{fatal:true});
    if (r.status !== 200 || new URL(r.url).origin !== origin || new URL(r.url).pathname !== url.pathname) throw Error(`Public page unavailable or redirected: ${path} (${r.status})`);
    return r.text();
   };
   const marker = JSON.parse(await read('.well-known/pages-build.json'));
   if (marker.commit !== expected.commit || marker.run !== expected.run || (!reuse && marker.packageAttempt !== expected.packageAttempt) || JSON.stringify(marker.files) !== JSON.stringify(expected.files)) throw Error('Public build marker is stale or unexpected');
   for (const [path, hash] of Object.entries(expected.files)) if (sha256(await read(path)) !== hash) throw Error(`Public content is stale: ${path}`);
   return;
  } catch (error) {
   if (error.fatal) throw error;
   last = error;
   if (i < DELAYS.length) await pause(DELAYS[i]);
  }
 }
 throw Error(`Deployment not publicly verified: ${last.message}`);
}
async function reconcileRuns(json, repo, commit, run, attempt) {
 const runs = await json(`https://api.github.com/repos/${repo}/actions/workflows/pages.yml/runs?head_sha=${commit}&per_page=100`);
 if (runs.total_count > 100) throw Error('Too many prior runs; reconciliation required');
 if (runs.total_count !== runs.workflow_runs.length || runs.workflow_runs.filter(r=>String(r.id)===run && r.run_attempt===attempt).length !== 1) throw Error('Incomplete workflow history; reconcile before creating deployment');
 let priorSuccess;
 for (const r of runs.workflow_runs) {
  if (r.head_sha !== commit) throw Error('Unexpected prior-run commit');
  if (String(r.id) !== run && r.status !== 'completed') throw Error('Prior run still active; reconcile before creating deployment');
  const last = String(r.id) === run ? attempt - 1 : r.run_attempt;
  for (let n = 1; n <= last; n++) {
   const jobs = await json(`https://api.github.com/repos/${repo}/actions/runs/${r.id}/attempts/${n}/jobs?per_page=100`);
   if (jobs.total_count > 100) throw Error('Too many jobs; reconciliation required');
   if (!jobs.jobs.length || jobs.jobs.length !== jobs.total_count || jobs.jobs.some(j=>j.status !== 'completed' || !Array.isArray(j.steps))) throw Error('Incomplete prior jobs; reconcile before creating deployment');
   const steps = jobs.jobs.flatMap(j => j.steps || []).filter(s=>['Deploy pinned Pages artifact','Deploy to GitHub Pages'].includes(s.name));
   if (retryDisposition(steps) === 'verify') priorSuccess = String(r.id);
  }
 }
 return {mode:priorSuccess ? 'verify' : 'create',run:priorSuccess || run};
}
module.exports = {reconcileRuns, artifactName, waitForArtifact, retryDisposition, validateProvenance, verifyPublication, sha256};
