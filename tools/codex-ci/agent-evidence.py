#!/usr/bin/env python3
"""Verify private evidence from the Codex-operated Docker CI runner."""

import argparse
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from evidence import expected_inventory


REQUIRED_JOBS = [
    "backend",
    "frontend",
    "ci-gate",
    "web-adaptive-auth",
    "auth-foundation",
    "web-registration",
    "enforce",
    "validate",
]
ADVISORY_JOBS = ["live-probe"]
SHA_LINE = re.compile(r"^([0-9a-f]{64})  ([A-Za-z0-9._/-]+)$")
SENSITIVE_LOG = re.compile(
    r"(?:github_pat_[A-Za-z0-9_]{20,}|\bgh[pousr]_[A-Za-z0-9_]{20,}|"
    r"\bBearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+/-]{8,}|"
    r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|"
    r"postgres(?:ql)?://[^\s\[\]]+|\b(?:AKIA|ASIA)[0-9A-Z]{16}\b)",
    re.IGNORECASE,
)


class EvidenceError(Exception):
    pass


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def fail(message):
    raise EvidenceError(message)


def verify_private_directory(path):
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        fail("evidence directory must be owned by this user with mode 0700")


def list_regular_files(root):
    files = []
    for path in root.rglob("*"):
        info = path.lstat()
        if stat.S_ISLNK(info.st_mode):
            fail("evidence contains a symbolic link")
        if stat.S_ISDIR(info.st_mode):
            if info.st_mode & 0o077:
                fail("evidence subdirectory is not private")
            continue
        if not stat.S_ISREG(info.st_mode):
            fail("evidence contains an unsupported filesystem entry")
        if info.st_uid != os.getuid() or info.st_mode & 0o077:
            fail("evidence file must be owned by this user with mode 0600 or stricter")
        files.append(path.relative_to(root).as_posix())
    return sorted(files)


def verify_checksums(root, files):
    checksum_path = root / "SHA256SUMS"
    if "SHA256SUMS" not in files:
        fail("SHA256SUMS is missing")
    listed = {}
    for line in checksum_path.read_text(encoding="utf-8").splitlines():
        match = SHA_LINE.fullmatch(line)
        if not match:
            fail("SHA256SUMS has an invalid line")
        digest, relative = match.groups()
        candidate = pathlib.PurePosixPath(relative)
        if candidate.is_absolute() or ".." in candidate.parts or relative == "SHA256SUMS" or relative in listed:
            fail("SHA256SUMS contains an unsafe or duplicate path")
        listed[relative] = digest
    expected = set(files) - {"SHA256SUMS"}
    if set(listed) != expected:
        fail("SHA256SUMS file inventory does not match evidence contents")
    for relative, digest in listed.items():
        if sha256((root / relative).read_bytes()) != digest:
            fail("evidence checksum mismatch")


def current_source_identity(repo):
    script = (
        "import { inspectSourceTree } from './tools/codex-ci/source-identity.mjs';"
        "const x=await inspectSourceTree(process.argv[1]);"
        "console.log(JSON.stringify({commitSha:x.commitSha,sourceTreeSha256:x.sourceTreeSha256,fileCount:x.fileCount}));"
    )
    try:
        result = subprocess.run(
            ["node", "--input-type=module", "-e", script, str(repo)],
            cwd=repo,
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return json.loads(result.stdout.strip().splitlines()[-1])
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError, IndexError):
        fail("current repository source identity could not be verified")


def verify_source_manifest(root, report, repo):
    manifest_path = root / "source-manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail("source manifest is missing or malformed")
    if manifest.get("commitSha") != report.get("commitSha"):
        fail("source manifest commit does not match result")
    entries = manifest.get("entries")
    if not isinstance(entries, list) or manifest.get("fileCount") != report.get("sourceFileCount"):
        fail("source manifest inventory does not match result")
    if len({entry.get("path") for entry in entries if isinstance(entry, dict)}) != len(entries):
        fail("source manifest contains duplicate paths")
    canonical = json.dumps(entries, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + b"\n"
    if sha256(canonical) != manifest.get("sourceTreeSha256") or manifest.get("sourceTreeSha256") != report.get("sourceTreeSha256"):
        fail("source manifest fingerprint does not match result")
    actual = current_source_identity(repo)
    if actual.get("commitSha") != report.get("commitSha") or actual.get("sourceTreeSha256") != report.get("sourceTreeSha256"):
        fail("current source no longer matches the tested candidate")


def verify_jobs(report, root, inventory):
    jobs = report.get("jobs")
    if not isinstance(jobs, list):
        fail("job results are missing")
    by_id = {job.get("id"): job for job in jobs if isinstance(job, dict)}
    if len(by_id) != len(jobs) or set(by_id) != set(REQUIRED_JOBS + ADVISORY_JOBS):
        fail("job inventory differs from the required eight-job matrix")

    inventory_jobs = inventory.get("jobs")
    workflow_hashes = inventory.get("workflowHashes")
    if not isinstance(inventory_jobs, list) or not isinstance(workflow_hashes, dict):
        fail("trusted workflow inventory is unavailable")
    expected_by_id = {job.get("id"): job for job in inventory_jobs if isinstance(job, dict)}
    if len(expected_by_id) != len(inventory_jobs) or set(expected_by_id) != set(REQUIRED_JOBS + ADVISORY_JOBS):
        fail("trusted workflow inventory differs from the required job matrix")
    expected_required = [job["id"] for job in inventory_jobs if job.get("required") is True]
    expected_advisory = [job["id"] for job in inventory_jobs if job.get("required") is False]
    if expected_required != REQUIRED_JOBS or expected_advisory != ADVISORY_JOBS:
        fail("trusted workflow inventory differs from the reviewed mandatory policy")
    if report.get("requiredJobIds") != REQUIRED_JOBS or report.get("advisoryJobIds") != ADVISORY_JOBS:
        fail("reported required/advisory job identifiers differ from the trusted inventory")
    if report.get("workflowHashes") != workflow_hashes:
        fail("tested workflow hashes do not match the trusted active workflows")

    expected_total_steps = sum(len(expected_by_id[job_id].get("steps", [])) for job_id in REQUIRED_JOBS)
    if type(report.get("mandatoryStepCount")) is not int or report["mandatoryStepCount"] != expected_total_steps:
        fail("reported mandatory step total differs from the trusted workflow inventory")
    if type(report.get("mandatoryJobsPassed")) is not int or report["mandatoryJobsPassed"] != len(REQUIRED_JOBS):
        fail("mandatory job pass count is incorrect")

    verified_required_jobs = 0
    verified_required_steps = 0
    for job_id in REQUIRED_JOBS:
        job = by_id[job_id]
        expected = expected_by_id[job_id]
        expected_steps = expected.get("steps")
        expected_names = [step.get("name") for step in expected_steps] if isinstance(expected_steps, list) else None
        expected_workflow_hash = workflow_hashes.get(expected.get("workflow"))
        if not isinstance(expected_names, list) or not expected_names or not isinstance(expected_workflow_hash, str):
            fail("trusted workflow inventory has no mandatory steps or workflow hash")
        if job.get("required") is not True or job.get("status") != "PASS":
            fail("a mandatory job is not passing")
        if job.get("workflow") != expected.get("workflow") or job.get("workflowSha256") != expected_workflow_hash:
            fail("mandatory job workflow identity or hash differs from the trusted inventory")
        if job.get("expectedStepNames") != expected_names or type(job.get("expectedStepCount")) is not int or job.get("expectedStepCount") != len(expected_names):
            fail("mandatory job's reported step inventory differs from the trusted workflow inventory")
        steps = job.get("steps")
        if not isinstance(steps, list) or len(steps) != len(expected_names):
            fail("mandatory workflow step count differs from the trusted inventory")
        if any(not isinstance(step, dict) for step in steps):
            fail("mandatory workflow step record is malformed")
        if [step.get("name") for step in steps] != expected_names:
            fail("mandatory workflow step names do not match the trusted inventory")
        for index, step in enumerate(steps, start=1):
            if step.get("status") != "PASS" or step.get("exitCode") != 0:
                fail("a mandatory workflow step is not passing")
            relative = step.get("log")
            expected_log = f"logs/{job_id}/{index:02d}.log"
            if not isinstance(relative, str) or relative != expected_log:
                fail("mandatory step log path is missing or out of scope")
            log_path = root / relative
            try:
                contents = log_path.read_bytes()
            except OSError:
                fail("mandatory step log is missing")
            if sha256(contents) != step.get("outputSha256"):
                fail("mandatory step log hash does not match result")
            if SENSITIVE_LOG.search(contents.decode("utf-8", errors="replace")):
                fail("credential-like material remains in a CI log")
        if not job.get("isolation", {}).get("readonlyRootFilesystem") or job.get("isolation", {}).get("hostMountCount") != 0 or job.get("isolation", {}).get("initReaper") is not True:
            fail("mandatory job isolation evidence is incomplete")
        if job.get("isolation", {}).get("workspaceDockerVolume") is not True or job.get("isolation", {}).get("dockerManagedVolumeCount") != 1:
            fail("mandatory job Docker-managed workspace volume is not verified")
        if job.get("workspaceDockerVolume") is not True or job.get("workspaceVolumeDriver") != "local" or job.get("workspaceVolumeCreated") is not True or job.get("workspaceVolumeDisposed") is not True:
            fail("mandatory job workspace volume lifecycle is not verified")
        if job.get("networkPolicy", {}).get("directEgressBlocked") is not True or job.get("networkPolicy", {}).get("internalOnly") is not True:
            fail("mandatory job network evidence is incomplete")
        if job_id in {"backend", "auth-foundation"}:
            if job.get("postgresServiceCleanup") != "PASS" or job.get("postgresContainerDisposed") is not True or job.get("postgres", {}).get("userUid") != 999 or job.get("postgres", {}).get("serviceHostname") != "postgres":
                fail("disposable PostgreSQL cleanup is not verified")
        verified_required_jobs += 1
        verified_required_steps += len(steps)

    advisory = by_id["live-probe"]
    if advisory.get("required") is not False or advisory.get("status") != "BLOCKED":
        fail("advisory public probe must remain explicitly blocked")
    expected_advisory_job = expected_by_id["live-probe"]
    if advisory.get("workflow") != expected_advisory_job.get("workflow"):
        fail("advisory job workflow identity differs from the trusted inventory")
    if verified_required_jobs != len(REQUIRED_JOBS) or verified_required_steps != expected_total_steps:
        fail("verified mandatory job or step total differs from the trusted workflow inventory")


def verify_network_preflight(report):
    network_preflight = report.get("networkPreflight", {})
    required = ["allowedRegistry", "allowedFontsCss", "allowedFontAssetHost", "allowedEmojiAsset", "deniedUnlistedHost"]
    forbidden_access = ["directIpv4DefaultRoute", "directIpv4TcpReachable", "directIpv6TcpReachable", "hostProxyReachable"]
    if not isinstance(network_preflight, dict) or network_preflight.get("status") != "PASS" or any(network_preflight.get(key) is not True for key in required) or any(network_preflight.get(key) is not False for key in forbidden_access):
        fail("restricted network preflight did not pass")


def verify_evidence(evidence_dir, repo):
    root = pathlib.Path(evidence_dir).resolve(strict=True)
    repository = pathlib.Path(repo).resolve(strict=True)
    verify_private_directory(root)
    files = list_regular_files(root)
    verify_checksums(root, files)
    for relative in files:
        if relative.startswith("logs/") and relative.endswith(".log"):
            if SENSITIVE_LOG.search((root / relative).read_text(encoding="utf-8", errors="replace")):
                fail("credential-like material remains in a CI log")
    try:
        report = json.loads((root / "result.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail("result.json is missing or malformed")
    if report.get("executor") != "codex-agent-docker" or report.get("localOnly") is not True:
        fail("result is not from the expected local Agent CI executor")
    if report.get("githubActionsInvoked") is not False or report.get("runnerRegistered") is not False:
        fail("GitHub Actions or runner registration is recorded as enabled")
    if report.get("sourceTreeMatchesAtFinish") is not True:
        fail("source changed during the CI run")
    base_sha = report.get("baseSha")
    if base_sha is not None and (
        not re.fullmatch(r"[0-9a-f]{40,64}", str(base_sha))
        or report.get("baseShaMatchesAtFinish") is not True
        or report.get("baseContainsHead") is not True
    ):
        fail("recorded main-base identity is malformed, changed, or not an ancestor")
    source_bytes = report.get("sourceBytes")
    workspace_policy = report.get("environment", {}).get("workspacePolicy", {})
    if not isinstance(source_bytes, int) or source_bytes <= 0 or workspace_policy.get("storage") != "per-job Docker-managed local named volume" or workspace_policy.get("mountTarget") != "/home/pwuser" or workspace_policy.get("hostBindMounts") != 0 or workspace_policy.get("volumeNoCopy") is not False or workspace_policy.get("minimumFreeSpaceBytes", 0) < source_bytes + 8 * 1024 ** 3:
        fail("Docker-managed workspace capacity and isolation policy is incomplete")
    cleanup = report.get("cleanup", {})
    required_cleanup = [
        "status", "proxyRemoved", "egressNetworkRemoved",
        "orphanContainersRemoved", "orphanNetworksRemoved", "orphanVolumesRemoved",
        "noRunContainersRemain", "noRunNetworksRemain", "noRunVolumesRemain",
    ]
    if any(cleanup.get(key) is not True and not (key == "status" and cleanup.get(key) == "PASS") for key in required_cleanup):
        fail("Docker cleanup is incomplete or unverified")
    if not isinstance(cleanup.get("proxyCounters"), dict) or cleanup["proxyCounters"].get("active") != 0:
        fail("restricted proxy shutdown counters are missing or active")
    verify_network_preflight(report)
    network = report.get("environment", {}).get("networkPolicy", {})
    if network.get("derivedImageBuilt") is not False or network.get("proxySourceOnlyInDisposableContainer") is not True or not re.fullmatch(r"[0-9a-f]{64}", str(network.get("proxyScriptSha256", ""))):
        fail("restricted proxy source and disposal evidence is incomplete")
    verify_source_manifest(root, report, repository)
    try:
        inventory = expected_inventory(repository)
    except Exception:
        fail("trusted active workflow inventory could not be verified")
    verify_jobs(report, root, inventory)
    return {
        "status": "PASS",
        "mandatoryJobs": len(REQUIRED_JOBS),
        "mandatorySteps": report["mandatoryStepCount"],
        "requiredSkips": 0,
        "testedCommit": report["commitSha"],
        "baseSha": base_sha,
        "sourceTreeSha256": report["sourceTreeSha256"],
        "sourceFileCount": report["sourceFileCount"],
        "checksummedFiles": len(files) - 1,
        "cleanup": "PASS",
        "productionAccess": "NONE",
        "githubActions": "NOT_USED",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["verify"])
    parser.add_argument("--evidence-dir", required=True)
    parser.add_argument("--repo", required=True)
    args = parser.parse_args()
    try:
        result = verify_evidence(args.evidence_dir, args.repo)
    except EvidenceError as error:
        print(json.dumps({"status": "FAIL", "reason": str(error)}))
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
