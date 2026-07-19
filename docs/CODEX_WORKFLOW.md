# Codex closed-loop workflow

Every change follows this loop until no actionable findings remain:

1. Primary implementation pass: inspect the relevant implementation and make the smallest complete change.
2. Independent review pass with fresh context: evaluate behavior and contracts without relying on implementation assumptions.
3. Apply every valid finding.
4. Run `npm run verify` and repair failures from direct logs and diagnostics.
5. Security review: secrets, authentication, authorization, input trust, process ownership, and destructive operations.
6. Final diff review using `npm run review`.
7. Repeat the review and verification cycle until clean.

## Review checklists

### Correctness and regressions

- Requirements and edge cases are covered; existing behavior and public contracts remain intentional.
- Tests exercise success and failure paths; no warning or error is hidden.

### Security and database safety

- No secret, credential, OTP, cookie, or sensitive body reaches logs, diffs, or responses.
- Authorization and public-route boundaries are explicit.
- Migrations are additive and reviewed; existing data is preserved; destructive commands have exact validated targets.

### API contracts and frontend state

- Status codes and response types match clients; raw webhook bytes remain exact.
- Loading, error, empty, refresh, deletion, and stale-cache states are correct.

### Accessibility and translations

- Controls have labels, keyboard behavior, focus handling, and sufficient semantic structure.
- Thai, English, and Chinese strings remain aligned and do not expose development credentials.

### Operational reliability

- Fixed ports are checked before startup; PID ownership is validated before termination.
- Health checks distinguish authentication responses from service failure.
- Logs are sanitized, bounded, ignored by Git, and sufficient for diagnosis.
