# Legacy Local CI policy

The proposed mandatory replacement is [Agent-operated CI policy](AGENT_CI_POLICY.md). It becomes effective only after explicit owner approval of the exact policy and hook migration. Until that decision, the existing Local CI policy and pre-push hook in the original clone remain in force.

The Lima/VZ supervisor, legacy evidence verifier and `ci:local` commands are retained for historical diagnostics. They are not a fallback or alternate pass for the approved Agent gate. See the current-main version of this file in Git history for the historical policy; this redirect does not claim that prior Local CI or dirty-tree Agent evidence validates the new clean candidate.
