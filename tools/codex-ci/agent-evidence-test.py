#!/usr/bin/env python3
"""Synthetic adversarial tests for private Agent CI evidence verification."""

import hashlib
import importlib.util
import json
import os
import pathlib
import shutil
import tempfile
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("agent-evidence.py")
SPEC = importlib.util.spec_from_file_location("agent_evidence", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
REPOSITORY = pathlib.Path(__file__).resolve().parents[2]


class EvidenceVerifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inventory = MODULE.expected_inventory(REPOSITORY)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="agent-ci-evidence-test-")
        self.root = pathlib.Path(self.temporary.name)
        os.chmod(self.root, 0o700)

    def tearDown(self):
        self.temporary.cleanup()

    def write_private(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(path.parent, 0o700)
        path.write_bytes(content)
        os.chmod(path, 0o600)
        return path

    def make_checksums(self):
        rows = []
        for path in sorted(item for item in self.root.rglob("*") if item.is_file() and item.name != "SHA256SUMS"):
            relative = path.relative_to(self.root).as_posix()
            rows.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {relative}")
        self.write_private("SHA256SUMS", ("\n".join(rows) + "\n").encode())

    def synthetic_report(self):
        jobs = []
        for expected in self.inventory["jobs"]:
            steps = []
            if expected["required"]:
                for index, expected_step in enumerate(expected["steps"], start=1):
                    relative = f"logs/{expected['id']}/{index:02d}.log"
                    contents = b"synthetic test log\n"
                    self.write_private(relative, contents)
                    steps.append({
                        "name": expected_step["name"],
                        "status": "PASS",
                        "exitCode": 0,
                        "log": relative,
                        "outputSha256": hashlib.sha256(contents).hexdigest(),
                    })
            postgres = expected["id"] in {"backend", "auth-foundation"}
            jobs.append({
                "id": expected["id"],
                "workflow": expected["workflow"],
                "workflowSha256": expected["workflowSha256"],
                "required": expected["required"],
                "status": "PASS" if expected["required"] else "BLOCKED",
                "expectedStepNames": [step["name"] for step in expected["steps"]],
                "expectedStepCount": len(expected["steps"]),
                "steps": steps,
                "isolation": {
                    "readonlyRootFilesystem": True,
                    "hostMountCount": 0,
                    "initReaper": True,
                    "workspaceDockerVolume": True,
                    "dockerManagedVolumeCount": 1,
                },
                "networkPolicy": {"directEgressBlocked": True, "internalOnly": True},
                "workspaceDockerVolume": True,
                "workspaceVolumeDriver": "local",
                "workspaceVolumeCreated": True,
                "workspaceVolumeDisposed": True,
                "postgresServiceCleanup": "PASS" if postgres else "NOT_APPLICABLE",
                "postgresContainerDisposed": True if postgres else None,
                "postgres": {"userUid": 999, "serviceHostname": "postgres"} if postgres else None,
            })
        mandatory_steps = sum(len(job["steps"]) for job in jobs if job["required"])
        return {
            "workflowHashes": dict(self.inventory["workflowHashes"]),
            "requiredJobIds": list(MODULE.REQUIRED_JOBS),
            "advisoryJobIds": list(MODULE.ADVISORY_JOBS),
            "jobs": jobs,
            "mandatoryJobsPassed": len(MODULE.REQUIRED_JOBS),
            "mandatoryStepCount": mandatory_steps,
        }

    def write_report_and_regenerate_unsigned_sidecar(self, report):
        self.write_private("result.json", (json.dumps(report, sort_keys=True) + "\n").encode())
        self.make_checksums()
        # The sidecar is deliberately unsigned. This proves only file consistency,
        # so the trusted workflow inventory must independently reject tampering.
        MODULE.verify_checksums(self.root, MODULE.list_regular_files(self.root))

    def test_exact_workflow_inventory_and_all_mandatory_steps_pass(self):
        report = self.synthetic_report()
        MODULE.verify_jobs(report, self.root, self.inventory)

    def test_removing_all_expected_names_and_steps_fails_after_sidecar_regeneration(self):
        report = self.synthetic_report()
        shutil.rmtree(self.root / "logs")
        for job in report["jobs"]:
            if job["required"]:
                job.pop("expectedStepNames")
                job["expectedStepCount"] = 0
                job["steps"] = []
        report["mandatoryStepCount"] = 0
        self.write_report_and_regenerate_unsigned_sidecar(report)
        with self.assertRaisesRegex(MODULE.EvidenceError, "mandatory step total differs from the trusted workflow inventory"):
            MODULE.verify_jobs(report, self.root, self.inventory)

    def test_missing_step_inventory_even_when_report_totals_are_preserved_fails(self):
        report = self.synthetic_report()
        backend = next(job for job in report["jobs"] if job["id"] == "backend")
        backend.pop("expectedStepNames")
        backend["steps"] = []
        with self.assertRaisesRegex(MODULE.EvidenceError, "reported step inventory differs from the trusted workflow inventory"):
            MODULE.verify_jobs(report, self.root, self.inventory)

    def test_report_cannot_replace_trusted_names_and_counts_together(self):
        report = self.synthetic_report()
        backend = next(job for job in report["jobs"] if job["id"] == "backend")
        backend["expectedStepNames"] = ["attacker-substituted"]
        backend["expectedStepCount"] = 1
        backend["steps"] = [{
            "name": "attacker-substituted",
            "status": "PASS",
            "exitCode": 0,
            "log": "logs/backend/01.log",
            "outputSha256": hashlib.sha256(b"synthetic test log\n").hexdigest(),
        }]
        with self.assertRaisesRegex(MODULE.EvidenceError, "reported step inventory differs from the trusted workflow inventory"):
            MODULE.verify_jobs(report, self.root, self.inventory)

    def test_workflow_hashes_per_job_count_and_aggregate_count_are_exact(self):
        report = self.synthetic_report()
        report["workflowHashes"]["backend-ci.yml"] = "0" * 64
        with self.assertRaisesRegex(MODULE.EvidenceError, "workflow hashes do not match"):
            MODULE.verify_jobs(report, self.root, self.inventory)

        report = self.synthetic_report()
        backend = next(job for job in report["jobs"] if job["id"] == "backend")
        backend["expectedStepCount"] += 1
        with self.assertRaisesRegex(MODULE.EvidenceError, "reported step inventory differs"):
            MODULE.verify_jobs(report, self.root, self.inventory)

        report = self.synthetic_report()
        report["mandatoryStepCount"] += 1
        with self.assertRaisesRegex(MODULE.EvidenceError, "mandatory step total differs"):
            MODULE.verify_jobs(report, self.root, self.inventory)

    def test_missing_job_or_job_identifier_claim_fails_closed(self):
        report = self.synthetic_report()
        report["jobs"] = [job for job in report["jobs"] if job["id"] != "enforce"]
        with self.assertRaisesRegex(MODULE.EvidenceError, "job inventory"):
            MODULE.verify_jobs(report, self.root, self.inventory)

        report = self.synthetic_report()
        report["requiredJobIds"].remove("enforce")
        with self.assertRaisesRegex(MODULE.EvidenceError, "required/advisory job identifiers"):
            MODULE.verify_jobs(report, self.root, self.inventory)

    def test_log_hash_and_credential_scan_remain_required(self):
        report = self.synthetic_report()
        backend = next(job for job in report["jobs"] if job["id"] == "backend")
        step = backend["steps"][0]
        path = self.root / step["log"]
        secret = b"Bearer opaqueSecretValue123456\n"
        path.write_bytes(secret)
        step["outputSha256"] = hashlib.sha256(secret).hexdigest()
        with self.assertRaisesRegex(MODULE.EvidenceError, "credential-like material"):
            MODULE.verify_jobs(report, self.root, self.inventory)

        path.write_bytes(b"changed after execution\n")
        with self.assertRaisesRegex(MODULE.EvidenceError, "log hash"):
            MODULE.verify_jobs(report, self.root, self.inventory)

    def test_workspace_mount_and_cleanup_must_be_verified(self):
        report = self.synthetic_report()
        backend = next(job for job in report["jobs"] if job["id"] == "backend")
        backend["workspaceVolumeDisposed"] = False
        with self.assertRaisesRegex(MODULE.EvidenceError, "workspace volume lifecycle"):
            MODULE.verify_jobs(report, self.root, self.inventory)

    def test_process_reaper_is_required_in_every_job(self):
        report = self.synthetic_report()
        backend = next(job for job in report["jobs"] if job["id"] == "backend")
        del backend["isolation"]["initReaper"]
        with self.assertRaisesRegex(MODULE.EvidenceError, "isolation evidence is incomplete"):
            MODULE.verify_jobs(report, self.root, self.inventory)

    @staticmethod
    def valid_network_preflight():
        return {
            "status": "PASS",
            "directIpv4DefaultRoute": False,
            "directIpv4TcpReachable": False,
            "directIpv6TcpReachable": False,
            "hostProxyReachable": False,
            "allowedRegistry": True,
            "allowedFontsCss": True,
            "allowedFontAssetHost": True,
            "allowedEmojiAsset": True,
            "deniedUnlistedHost": True,
        }

    def test_network_preflight_requires_all_allowed_and_denied_origin_checks(self):
        report = {"networkPreflight": self.valid_network_preflight()}
        MODULE.verify_network_preflight(report)
        for key in ("allowedRegistry", "allowedFontsCss", "allowedFontAssetHost", "allowedEmojiAsset", "deniedUnlistedHost"):
            with self.subTest(missing_positive_check=key):
                changed = {"networkPreflight": self.valid_network_preflight()}
                changed["networkPreflight"].pop(key)
                with self.assertRaisesRegex(MODULE.EvidenceError, "restricted network preflight"):
                    MODULE.verify_network_preflight(changed)

    def test_network_preflight_rejects_each_direct_or_host_proxy_access_assertion(self):
        for key in ("directIpv4DefaultRoute", "directIpv4TcpReachable", "directIpv6TcpReachable", "hostProxyReachable"):
            with self.subTest(unexpected_access=key):
                changed = {"networkPreflight": self.valid_network_preflight()}
                changed["networkPreflight"][key] = True
                with self.assertRaisesRegex(MODULE.EvidenceError, "restricted network preflight"):
                    MODULE.verify_network_preflight(changed)

    def test_network_preflight_requires_negative_checks_to_be_explicitly_false(self):
        for key in ("directIpv4DefaultRoute", "directIpv4TcpReachable", "directIpv6TcpReachable", "hostProxyReachable"):
            with self.subTest(missing_negative_check=key):
                changed = {"networkPreflight": self.valid_network_preflight()}
                changed["networkPreflight"].pop(key)
                with self.assertRaisesRegex(MODULE.EvidenceError, "restricted network preflight"):
                    MODULE.verify_network_preflight(changed)


if __name__ == "__main__":
    unittest.main(verbosity=2)
