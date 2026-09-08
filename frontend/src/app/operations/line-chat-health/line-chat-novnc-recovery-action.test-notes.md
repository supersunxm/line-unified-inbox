# LINE Chat noVNC health action safeguards

- The UI action is mounted only into the `profile-b` row.
- Clicking the action is the only event that starts a recovery session; page load never starts noVNC.
- The backend remains the authorization boundary (`ADMIN`) and only permits `profile-b`.
- The temporary recovery URL is returned by the backend after the token-gated worker session starts.
- `account-1` is not targeted by this action.
- Manual recovery can reserve the profile operation lease while open, so it is intended only as an operator fallback.
