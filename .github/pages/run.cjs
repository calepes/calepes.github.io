const fs = require('node:fs');
const path = require('node:path');
const {artifactName, waitForArtifact, validateProvenance, reconcileRuns, verifyPublication, sha256} = require('./publication.cjs');
const env = process.env;
const required = key => {if (!env[key]) throw Error(`Missing ${key}`); return env[key]};
const output = (key,value) => fs.appendFileSync(required('GITHUB_OUTPUT'),`${key}=${value}\n`);
async function json(url) {
 // This is a public repo: no token or extra Actions permission is needed here.
 const r = await fetch(url,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
 if (!r.ok) throw Error(`Public metadata lookup failed (${r.status}); no retry or permission fallback`);
 return r.json();
}
function manifest() {
 const root = required('GITHUB_WORKSPACE');
 const digest = fs.readdirSync(path.join(root,'digest')).filter(x=>/^\d{4}-\d{2}-\d{2}\.html$/.test(x)).sort().at(-1);
 if (!digest) throw Error('No generated digest HTML');
 return {commit:required('GITHUB_SHA'),run:required('GITHUB_RUN_ID'),packageAttempt:required('PACKAGE_ATTEMPT'),files:Object.fromEntries(['index.html',`digest/${digest}`].map(file=>[file,sha256(fs.readFileSync(path.join(root,file)))]))};
}

async function main() {
 switch (process.env.PUBLICATION_COMMAND || process.argv[2]) {
  case 'manifest': {
   const m = manifest(); const dir = path.join(required('GITHUB_WORKSPACE'),'.well-known');
   fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'pages-build.json'),JSON.stringify(m)+'\n');
   output('name',artifactName(m.run,m.packageAttempt));output('attempt',m.packageAttempt);
   console.log(`GENERATED: ${m.commit}; ${Object.keys(m.files).join(', ')}`);break;
  }
  case 'gate': {
   const expected = {name:required('ARTIFACT_NAME'),id:required('ARTIFACT_ID'),commit:required('GITHUB_SHA'),run:required('GITHUB_RUN_ID')};
   if (expected.name !== artifactName(expected.run,required('PACKAGE_ATTEMPT'))) throw Error('Unexpected package name');
   const {DefaultArtifactClient} = require('@actions/artifact');
   const client = new DefaultArtifactClient();
   // Same client/version/default current-run Twirp call as the pinned deploy-pages action.
   await waitForArtifact(async()=>(await client.listArtifacts()).artifacts,expected);
   validateProvenance(await json(`https://api.github.com/repos/${required('GITHUB_REPOSITORY')}/actions/artifacts/${expected.id}`),expected);
   console.log(`UPLOADED AND VISIBLE: ${expected.name}, ID ${expected.id}, commit ${expected.commit}`);
   const prior = await reconcileRuns(json,required('GITHUB_REPOSITORY'),expected.commit,expected.run,Number(required('GITHUB_RUN_ATTEMPT')));
   output('mode',prior.mode);output('verified_run',prior.run);break;
  }
  case 'verify': {
   const expected = manifest(); expected.run = required('VERIFIED_RUN');
   await verifyPublication(url=>fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)}),required('PAGE_URL'),expected,undefined,env.REUSE_DEPLOYMENT==='true');
   console.log(`VERIFIED: HTTP 200, marker and file SHA256 match commit ${expected.commit}`);break;
  }
  default: throw Error('Expected manifest, gate or verify');
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
