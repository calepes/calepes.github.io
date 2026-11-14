const {test} = require('node:test');
const assert = require('node:assert/strict');
const {artifactName, waitForArtifact, retryDisposition, verifyPublication} = require('./publication.cjs');
const id = {name:'pages-42-1',id:123};
const artifact = {...id,size:20};
const sleep = async () => {};
test('artifact names bind run and package attempt; deploy-only retry retains original', () => {
 assert.equal(artifactName(42,1),'pages-42-1');
 assert.notEqual(artifactName(42,1),artifactName(42,2));
});
test('immediate visibility checks exactly the uploaded ID',async()=>{
 let calls=0; assert.equal((await waitForArtifact(async()=>{calls++;return [artifact]},id,sleep)).id,123); assert.equal(calls,1);
});
test('zero then one retries progressively without uploading',async()=>{
 let calls=0;const delays=[];
 await waitForArtifact(async()=>++calls<3?[]:[artifact],id,async n=>delays.push(n));
 assert.equal(calls,3);assert.deepEqual(delays,[2000,4000]);
});
test('permanent absence has six observations and bounded progressive waits',async()=>{
 let calls=0;const delays=[];
 await assert.rejects(waitForArtifact(async()=>{calls++;return []},id,async n=>delays.push(n)),/not visible/);
 assert.equal(calls,6);assert.deepEqual(delays,[2000,4000,8000,16000,30000]);
});
for(const [label,items] of [['duplicates',[artifact,artifact]],['unexpected ID',[{...artifact,id:124}]],['empty package',[{...artifact,size:0}]]]){
 test(label+' fails immediately',async()=>{let calls=0;await assert.rejects(waitForArtifact(async()=>{calls++;return items},id,sleep));assert.equal(calls,1)});
}
test('permission failure is not retried',async()=>{let calls=0;await assert.rejects(waitForArtifact(async()=>{calls++;throw Error('403 Forbidden')},id,sleep),/403/);assert.equal(calls,1)});
test('failed-job retry before deploy reuses package; skipped deployment is safe',()=>{
 assert.equal(retryDisposition([{conclusion:'skipped'}]),'create');
 assert.equal(retryDisposition([]),'create');
});
test('successful creation is verification-only; failed/unknown creation cannot be replayed',()=>{
 assert.equal(retryDisposition([{conclusion:'success'}]),'verify');
 for(const conclusion of ['failure','cancelled',null]) assert.throws(()=>retryDisposition([{conclusion}]),/Reconcile/);
});
const {createHash} = require('node:crypto');
const text='<html>digest</html>';const hash=createHash('sha256').update(text).digest('hex');
const expected={commit:'a'.repeat(40),run:'42',packageAttempt:'1',files:{'digest/2026-11-14.html':hash}};
function response(status,body,url){return {status,url,async text(){return body}}}
const base='https://apps.lepesqueur.net/';
test('200 plus exact marker and digest hash verifies published source',async()=>{
 await verifyPublication(async url=>response(200,url.includes('pages-build.json')?JSON.stringify(expected):text,url),base,expected,sleep);
});
for(const [label,status,marker,body] of [['404',404,expected,text],['stale commit',200,{...expected,commit:'b'.repeat(40)},text],['stale digest',200,expected,'old html']]){
 test(label+' never claims verified',async()=>{let calls=0;await assert.rejects(verifyPublication(async url=>{calls++;return response(status,url.includes('pages-build.json')?JSON.stringify(marker):body,url)},base,expected,sleep));assert(calls>=6)});
}
test('public permission error fails without retry',async()=>{let calls=0;await assert.rejects(verifyPublication(async url=>{calls++;return response(403,'denied',url)},base,expected,sleep),/403/);assert.equal(calls,1)});
const {validateProvenance,reconcileRuns} = require('./publication.cjs');
const provenance={id:123,name:'pages-42-1',size_in_bytes:20,expired:false,workflow_run:{id:42,head_sha:'abc'}};
const identity={id:'123',name:'pages-42-1',commit:'abc',run:'42'};
test('REST ID/run/commit/expiry corroborate Twirp result',()=>validateProvenance(provenance,identity));
for(const patch of [{id:124},{name:'other'},{expired:true},{workflow_run:{id:43,head_sha:'abc'}},{workflow_run:{id:42,head_sha:'other'}}]){
 test('REST unexpected provenance '+JSON.stringify(patch),()=>assert.throws(()=>validateProvenance({...provenance,...patch},identity)));
}
function history(steps,{run=42,attempt=2}={}) {
 const calls=[];
 return {calls,read:async url=>{calls.push(url);return url.includes('/workflows/')?{total_count:run===42?1:2,workflow_runs:run===42?[{id:run,run_attempt:attempt,head_sha:'abc',status:'completed'}]:[{id:42,run_attempt:2,head_sha:'abc'},{id:run,run_attempt:attempt,head_sha:'abc',status:'completed'}]}:{total_count:1,jobs:[{status:'completed',steps}]}}};
}
test('deploy-only rerun reads prior attempt and preserves package; no upload operation',async()=>{
 const h=history([{name:'Deploy pinned Pages artifact',conclusion:'skipped'}]);
 assert.deepEqual(await reconcileRuns(h.read,'owner/repo','abc','42',2),{mode:'create',run:'42'});
 assert(h.calls.some(url=>url.includes('/attempts/1/jobs')));
});
test('uncertain prior creation blocks rerun, including a different workflow run',async()=>{
 for (const run of [42,41]) {
  const h=history([{name:'Deploy pinned Pages artifact',conclusion:'failure'}],{run,attempt:run===42?2:1});
  await assert.rejects(reconcileRuns(h.read,'owner/repo','abc','42',2),/Reconcile/);
 }
});
test('previous success means verification-only, no second creation',async()=>{
 const h=history([{name:'Deploy pinned Pages artifact',conclusion:'success'}],{run:41,attempt:1});
 assert.deepEqual(await reconcileRuns(h.read,'owner/repo','abc','42',2),{mode:'verify',run:'41'});
});
test('metadata permissions/rate errors block instead of bypassing history',async()=>{
 await assert.rejects(reconcileRuns(async()=>{throw Error('403 rate/permission')},'owner/repo','abc','42',2),/403/);
});
test('too many prior runs cannot be silently truncated',async()=>{
 await assert.rejects(reconcileRuns(async()=>({total_count:101,workflow_runs:[]}), 'owner/repo','abc','42',2),/Too many/);
});
test('missing current run cannot authorize a deployment retry',async()=>{
 await assert.rejects(reconcileRuns(async()=>({total_count:0,workflow_runs:[]}), 'owner/repo','abc','42',2),/Incomplete/);
});
test('empty or truncated prior jobs cannot authorize retry',async()=>{
 for(const jobs of [{total_count:0,jobs:[]},{total_count:2,jobs:[{steps:[]}]}]){
  await assert.rejects(reconcileRuns(async url=>url.includes('/workflows/')?{total_count:1,workflow_runs:[{id:42,run_attempt:2,head_sha:'abc'}]}:jobs,'owner/repo','abc','42',2),/Incomplete/);
 }
});
