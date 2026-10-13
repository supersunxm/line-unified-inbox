#!/usr/bin/env python3
"""Synthetic tamper tests for the Local CI evidence verifier."""

import json
import pathlib
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import evidence


REPO = pathlib.Path(__file__).resolve().parents[2]


class EvidenceVerifierTests(unittest.TestCase):
    def setUp(self):
        self.inventory = evidence.expected_inventory(REPO)
        self.root = pathlib.Path(tempfile.mkdtemp(prefix="evidence-verifier-test-"))
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self.result, self.manifest = self.make_valid_fixture()

    def make_valid_fixture(self):
        manifest_entries = [{
            "path": "synthetic-source.txt", "type": "file", "mode": 0o644,
            "size": 8, "sha256": evidence.sha256(b"fixture\n"),
        }]
        source_hash = evidence.canonical_manifest_hash(manifest_entries)
        jobs = []
        for expected in self.inventory["jobs"]:
            steps = []
            for index, expected_step in enumerate(expected["steps"], start=1):
                log_path = self.root / "logs" / expected["id"] / f"{index:02d}.log"
                log_path.parent.mkdir(parents=True, exist_ok=True)
                log = b"synthetic verifier fixture output\n"
                log_path.write_bytes(log)
                steps.append({
                    "name": expected_step["name"], "status": "PASS", "exitCode": 0,
                    "log": str(log_path), "outputSha256": evidence.sha256(log),
                })
            jobs.append({
                "id": expected["id"], "workflow": expected["workflow"],
                "required": expected["required"], "status": "PASS" if expected["required"] else "BLOCKED",
                "guestCreated": True if expected["required"] else False,
                "guestDisposed": True if expected["required"] else False,
                "workflowSha256": self.inventory["workflowHashes"][expected["workflow"]],
                "environment": {"arch": "arm64", "platform": "linux", "node": "v22.23.3"},
                "postgres": {"image": "postgres:16", "status": "READY"} if expected["postgres"] else None,
                "rootlessContainerCleanup": "PASS" if expected["postgres"] else None,
                "steps": steps,
            })
        result = {
            "schemaVersion": 1, "localOnly": True, "githubActionsInvoked": False,
            "runnerRegistered": False, "commitSha": "a" * 40,
            "sourceTreeSha256": source_hash, "sourceTreeMatchesAtFinish": True,
            "workflowHashes": dict(self.inventory["workflowHashes"]), "jobs": jobs,
            "localDecision": {"localRequiredChecks": "PASS", "missing": [], "nonPassing": [], "githubRequiredChecksEquivalent": False},
            "cleanup": {"createdGuestCount": 8, "disposedGuestCount": 8,
                        "baseAfterRun": {"present": True, "status": "Stopped"},
                        "rootlessDockerSocketWasGuestLocal": True, "githubRunnerRegistration": "NOT_USED"},
        }
        manifest = {"commitSha": result["commitSha"], "sourceTreeSha256": source_hash,
                    "fileCount": 1, "entries": manifest_entries}
        (self.root / "result.json").write_text(json.dumps(result), encoding="utf-8")
        (self.root / "source-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        return result, manifest

    def write_result(self):
        (self.root / "result.json").write_text(json.dumps(self.result), encoding="utf-8")
        (self.root / "source-manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def test_valid_evidence_verifies_every_job_step_and_log(self):
        summary = evidence.verify_evidence(self.root, self.inventory)
        expected_steps = sum(len(job["steps"]) for job in self.inventory["jobs"] if job["required"])
        self.assertEqual(summary["evidence"], "VERIFIED")
        self.assertEqual(summary["mandatoryJobs"], 8)
        self.assertEqual(summary["mandatorySteps"], expected_steps)
        self.assertEqual(summary["requiredSkips"], 0)

    def test_step_failure_and_skip_are_rejected(self):
        backend = next(job for job in self.result["jobs"] if job["id"] == "backend")
        backend["steps"][0]["status"] = "FAIL"
        self.write_result()
        with self.assertRaisesRegex(ValueError, "did not pass"):
            evidence.verify_evidence(self.root, self.inventory)
        backend["steps"][0]["status"] = "PASS"
        backend["steps"][0]["skipped"] = True
        self.write_result()
        with self.assertRaisesRegex(ValueError, "was skipped"):
            evidence.verify_evidence(self.root, self.inventory)

    def test_guest_cleanup_and_postgres_identity_are_required(self):
        self.result["cleanup"]["disposedGuestCount"] = 7
        self.write_result()
        with self.assertRaisesRegex(ValueError, "eight disposable"):
            evidence.verify_evidence(self.root, self.inventory)
        self.result["cleanup"]["disposedGuestCount"] = 8
        backend = next(job for job in self.result["jobs"] if job["id"] == "backend")
        backend["postgres"]["image"] = "latest"
        self.write_result()
        with self.assertRaisesRegex(ValueError, "PostgreSQL 16"):
            evidence.verify_evidence(self.root, self.inventory)

    def test_changed_log_bytes_are_rejected(self):
        log_path = pathlib.Path(next(job for job in self.result["jobs"] if job["id"] == "backend")["steps"][0]["log"])
        log_path.write_text("changed after execution\n", encoding="utf-8")
        self.write_result()
        with self.assertRaisesRegex(ValueError, "log checksum mismatch"):
            evidence.verify_evidence(self.root, self.inventory)

    def test_missing_job_and_wrong_workflow_fingerprint_are_rejected(self):
        self.result["jobs"] = [job for job in self.result["jobs"] if job["id"] != "enforce"]
        self.write_result()
        with self.assertRaisesRegex(ValueError, "eight mandatory"):
            evidence.verify_evidence(self.root, self.inventory)
        self.result, self.manifest = self.make_valid_fixture()
        self.result["workflowHashes"]["backend-ci.yml"] = "0" * 64
        for job in self.result["jobs"]:
            if job["workflow"] == "backend-ci.yml":
                job["workflowSha256"] = "0" * 64
        self.write_result()
        with self.assertRaisesRegex(ValueError, "workflow checksums"):
            evidence.verify_evidence(self.root, self.inventory)

    def test_local_evidence_never_claims_github_checks(self):
        self.result["localDecision"]["githubRequiredChecksEquivalent"] = True
        self.write_result()
        with self.assertRaisesRegex(ValueError, "must not claim GitHub"):
            evidence.verify_evidence(self.root, self.inventory)


if __name__ == "__main__":
    unittest.main(verbosity=2)
