# Contribution Guidelines

## Prepare and check a change

Use Node 24 and Git. Work on a review branch, normally using the `codex/` prefix for Codex changes. Confirm the repository directory and `git status --short --branch` before editing. Preserve existing work.

For a new checkout, install the locked development dependencies:

```powershell
npm ci --ignore-scripts
```

Run the combined check before requesting review and again before an approved push:

```powershell
npm run check
```

It runs `npm run lint`, `npm run scan:secrets`, `npm run validate-kb` and `npm test` sequentially, stopping at the first failure. Each command can also be run separately. The existing tests use synthetic settings and local fake HTTP servers, so localhost access is required. No live provider credentials are needed.

Use the detailed [operating guide](docs/engineering-controls.md#6-local-workflow-windows-and-powershell) for one-command-at-a-time PowerShell instructions, expected results and troubleshooting boundaries.

## Review expectations

- Keep the diff within the approved scope. Explain additional files or dependencies before expanding that scope.
- Inspect `git diff --check`, the full tracked diff and all new files. A summary alone does not review their contents.
- Before an approved commit, inspect `git diff --cached` and ensure its contents match the files actually checked. Secret scanning currently reads the working tree, not the index or historical commits.
- Record actual command results, failures, environment limitations and any untested behaviour in the review report.
- After an approved push, check GitHub Actions for the exact published revision. Merge enforcement depends on repository rules; do not infer it from the existence of a workflow.
- Commits, pushes, merges, deployment and live/cost-bearing tests require the owner's applicable approval. A passing local check does not grant that approval.

## Secrets and test fixtures

Keep private `.env` files untracked. Public `.env.example` values must remain placeholders. Never add real tokens, passwords, private keys or candidate records to source, fixtures, documents or screenshots.

Run the current-file scanner before publication. Keep output masking enabled and do not paste findings containing credentials into shared discussions. A genuine exposed credential requires revocation/rotation and exposure review; deleting the latest line is insufficient.

Use clearly synthetic test values. Do not blanket-exclude tests, documentation or whole source directories to suppress a scanner finding. Any narrow exception needs a documented reason and review. A scanner pass is not a full-history credential audit.

## Code and documentation conventions

Follow the configured ESLint rules and retain narrow, explained exceptions where a framework contract or safe-error boundary requires them. Do not remove the fourth parameter from Express error middleware to satisfy a generic unused-variable rule.

Keep line endings set to LF through `.gitattributes`. A comprehensive formatter is not configured yet; avoid unrelated repository-wide formatting changes.

When documenting a change, explain its purpose, actual behaviour, file/dependency scope, commands, evidence, limitations and remaining work. Update the documentation index and presentation guide when the represented project status changes. Distinguish plans, local implementations, published changes and observed live behaviour.

## Knowledge-base changes

All additions must include the required metadata, including `source_url`, `source_date`, `status` and `verification_status`. The current validator checks required fields; a pass does not establish full schema compliance or factual verification. Content changes and promotion to approved public answers require the separately agreed content-review process.
