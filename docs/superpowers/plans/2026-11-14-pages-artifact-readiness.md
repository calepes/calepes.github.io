# Pages artifact readiness — implementation plan

Goal: publish the existing digest/site only from a uniquely identified, visible package and verify the deployed commit.
Spec: Cal's authenticated request of 14 November 2026; incidents 43583240237 and 43196584920, recovery 43205058702.

Architecture: independent package/deploy jobs. Package names include workflow run ID and package attempt; upload returns the immutable ID. Gate uses the same @actions/artifact 2.1.3 DefaultArtifactClient.listArtifacts() call and current-run Twirp scope as deploy-pages at d6db901. A REST read of the specific ID adds provenance checks; REST availability never substitutes for Twirp visibility. Keep current deployment permissions/environment/concurrency.

- [x] Add tests first: immediate/late/missing/duplicate/wrong identity/permission failure; package attempt names; deploy-only retry; uncertain creation; public 404/stale content.
- [x] Implement bounded visibility checks (six observations; 2,4,8,16,30 seconds between empty results). Never retry authorization errors or deployment creation.
- [x] Separate jobs; retain package outputs on failed-job rerun. Before a retry, inspect earlier attempts' deployment steps. Successful deployment is verification-only; a started non-successful deployment requires reconciliation. Do not upload from deploy.
- [x] Add build marker with source commit, run, package attempt and SHA256 of index and latest digest. Verify HTTPS 200, exact marker and both file hashes with bounded read-only polling.
- [x] Test locally, document evidence/rollback, review isolated diff; publish according to existing authorization and verify actual workflow/URL/content. No DNS, permissions, secrets, artifact deletion or force push.

Risks/limits: the upstream cause of the transient zero result is unconfirmed. The official deployer performs a second lookup: if visibility changes after the gate, it can still fail safely. Retry guard is deliberately conservative when creation could have happened. No synthetic test proves availability of GitHub/CDN; live verification is separate.

Rollback: revert the isolated fix commit through a normal commit, retaining later changes. Never rerun an old combined upload/deploy job; dispatch a fresh run after reconciling any uncertain deployment. Keep artifacts; no deletion.

Execution: isolated branch from remote 6748d5f. Local tests 28/28, actionlint and invariant checks PASS. Independent review finding (incomplete history) fixed with RED/GREEN regression tests. Live publication and HTTP/content verification remain to be recorded in the task receipt.
