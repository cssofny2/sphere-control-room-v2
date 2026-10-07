# PR 6 restricted publisher

This workflow is deliberately limited to PR #6 in cssofny2/sphere-control-room-v2 and its feature/cr-102-cancellable-runner head. It does not merge, retarget, force-push, or promote production.

On a matching push, the read-only job verifies that PR #6 is open, has the expected base and head, and still points to the triggering commit. It installs locked dependencies, checks the baseline, applies the exact reviewed sweep-ownership change, then runs all npm tests and the production build. Unexpected source context fails closed.

Only a checksummed patch for src/MetrologyLabV3.tsx and scripts/sweep-race.test.mjs moves to the publishing job. That separate job receives contents:write, rechecks the PR and branch SHA, and performs a normal fast-forward push with the automatically issued GITHUB_TOKEN. Generated dist files, temporary files, and manifests are not published. This token is repository-scoped; branch/path restrictions are enforced by workflow checks, not token-level scoping.

The helper is idempotent: when the fix and tests are present, no second commit is made. Stop/restart regressions use extracted application functions; this workflow does not yet include the separate mounted React/jsdom harness or axis/training scan browser tests.

The initial workflow commit should trigger the push event without browser login. Actions must be enabled and repository/organization policy must permit the requested token permissions. A connector may separately require permission to write workflow files. Do not weaken protections if these permissions are denied.

Manual workflow_dispatch availability generally requires the workflow to exist on the default branch. Do not merge into main merely to expose that button; the branch push is the bootstrap trigger.

GITHUB_TOKEN pushes do not normally start another push-based Actions run. Validation occurs before publication in this workflow. Verify the resulting commit's Vercel deployment separately rather than assuming an external deployment was triggered. Cloudflare failures are not bypassed. Keep PR #6 draft until remaining merge gates have been addressed.

To retire the one-time publisher, remove it in a reviewed follow-up or convert validation to read-only CI. This is not an unrestricted autonomous code-writing agent.
