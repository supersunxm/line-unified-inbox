#!/usr/bin/env python3
"""Verify and package source-matched Codex Local CI evidence."""

import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile


REQUIRED_IDS = [
    "backend", "frontend", "ci-gate", "web-adaptive-auth",
    "auth-foundation", "web-registration", "enforce", "validate",
]
SECRET_PATTERNS = [
    re.compile(rb"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"),
    re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b"),
    re.compile(rb"\bBearer\s+[A-Za-z0-9._~+/-]{12,}=?", re.I),
    re.compile(rb"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    re.compile(rb"\bAKIA[0-9A-Z]{16}\b"),
]


def fail(message):
    raise ValueError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def load_json(path):
    try:
        return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        fail(f"Cannot read JSON evidence file {pathlib.Path(path).name}: {error}")


def expected_inventory(repo):
    code = (
        "import { expectedJobs, inspectWorkflowInventory } from './tools/codex-ci/workflow-inventory.mjs';"
        "const i=await inspectWorkflowInventory(process.cwd());"
        "if(i.errors.length)throw Error(i.errors.join('; '));"
        "console.log(JSON.stringify({workflowHashes:i.workflowHashes,jobs:i.jobs}));"
    )
    try:
        output = subprocess.check_output(
            ["node", "--input-type=module", "-e", code],
            cwd=repo, stderr=subprocess.PIPE, text=True,
        )
        inventory = json.loads(output)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        fail(f"Cannot load reviewed Local CI inventory: {error}")
    if [job["id"] for job in inventory["jobs"] if job["required"]] != REQUIRED_IDS:
        fail("Repository mandatory job inventory differs from the reviewed policy")
    return inventory


def canonical_manifest_hash(entries):
    encoded = json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n"
    return sha256(encoded.encode("utf-8"))


def safe_log_path(evidence_dir, job_id, index, recorded, portable):
    relative = pathlib.Path("logs") / job_id / f"{index:02d}.log"
    path = evidence_dir / relative
    if path.is_symlink() or not path.is_file():
        fail(f"Missing or unsafe per-step log: {job_id}:{index}")
    if portable:
        if recorded != relative.as_posix():
            fail(f"Portable evidence has an unexpected log path: {job_id}:{index}")
    else:
        try:
            if pathlib.Path(recorded).resolve(strict=True) != path.resolve(strict=True):
                fail(f"Raw result log path does not match its evidence directory: {job_id}:{index}")
        except OSError:
            fail(f"Raw result log path is unavailable: {job_id}:{index}")
    return path


def verify_checksums(evidence_dir):
    sums = evidence_dir / "SHA256SUMS"
    if not sums.exists():
        return 0
    expected = {}
    for line in sums.read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  ([A-Za-z0-9._/-]+)", line)
        if not match:
            fail("Malformed SHA256SUMS entry")
        digest, name = match.groups()
        path = pathlib.PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts or name == "SHA256SUMS" or name in expected:
            fail("Unsafe or duplicate SHA256SUMS path")
        expected[name] = digest
    actual = {
        path.relative_to(evidence_dir).as_posix()
        for path in evidence_dir.rglob("*")
        if path.is_file() and path.name != "SHA256SUMS"
    }
    if actual != set(expected):
        fail("SHA256SUMS file inventory mismatch")
    for name, digest in expected.items():
        if sha256((evidence_dir / name).read_bytes()) != digest:
            fail(f"Evidence checksum mismatch: {name}")
    return len(expected)


def verify_evidence(evidence_dir, inventory):
    evidence_dir = pathlib.Path(evidence_dir).resolve()
    result = load_json(evidence_dir / "result.json")
    manifest = load_json(evidence_dir / "source-manifest.json")
    portable = (evidence_dir / "verification.json").exists()
    checksum_count = verify_checksums(evidence_dir)

    if result.get("schemaVersion") != 1:
        fail("Unsupported Local CI result schema")
    if result.get("githubActionsInvoked") is not False or result.get("runnerRegistered") is not False:
        fail("Local evidence does not prove hosted Actions and runner registration were unused")
    if result.get("sourceTreeMatchesAtFinish") is not True:
        fail("Source fingerprint changed while Local CI was running")
    if result.get("localDecision", {}).get("localRequiredChecks") != "PASS":
        fail("Local CI did not report all mandatory jobs passing")
    if result.get("localDecision", {}).get("githubRequiredChecksEquivalent") is not False:
        fail("Local CI evidence must not claim GitHub Required Checks")
    if result.get("commitSha") != manifest.get("commitSha"):
        fail("Test result and source manifest commit identities differ")
    if result.get("sourceTreeSha256") != manifest.get("sourceTreeSha256"):
        fail("Test result and source manifest fingerprints differ")
    entries = manifest.get("entries")
    if not isinstance(entries, list) or canonical_manifest_hash(entries) != result.get("sourceTreeSha256"):
        fail("Canonical source manifest checksum mismatch")
    if [entry.get("path") for entry in entries] != sorted(entry.get("path") for entry in entries):
        fail("Source manifest paths are not canonically ordered")

    jobs = result.get("jobs")
    if not isinstance(jobs, list) or len({job.get("id") for job in jobs}) != len(jobs):
        fail("Job results are missing or duplicated")
    required = [job for job in jobs if job.get("required") is True]
    if [job.get("id") for job in required] != REQUIRED_IDS:
        fail("All eight mandatory job records must be present in policy order")
    expected_by_id = {job["id"]: job for job in inventory["jobs"]}
    workflow_hashes = result.get("workflowHashes")
    if workflow_hashes != inventory["workflowHashes"]:
        fail("Tested workflow checksums differ from the verified repository workflows")

    total_steps = 0
    verified_logs = 0
    for job in required:
        expected = expected_by_id[job["id"]]
        if job.get("workflow") != expected["workflow"] or job.get("status") != "PASS":
            fail(f"Mandatory job failed or workflow identity changed: {job.get('id')}")
        if job.get("guestCreated") is not True or job.get("guestDisposed") is not True:
            fail(f"Mandatory job guest cleanup is unverified: {job['id']}")
        if job.get("workflowSha256") != workflow_hashes.get(expected["workflow"]):
            fail(f"Job workflow checksum mismatch: {job['id']}")
        environment = job.get("environment") or {}
        if environment.get("arch") != "arm64" or environment.get("platform") != "linux" or not str(environment.get("node", "")).startswith("v22."):
            fail(f"Mandatory job toolchain identity is incomplete: {job['id']}")
        if job.get("steps") is None or len(job["steps"]) != len(expected["steps"]):
            fail(f"Mandatory workflow step count differs: {job['id']}")
        for index, (step, expected_step) in enumerate(zip(job["steps"], expected["steps"]), start=1):
            if step.get("name") != expected_step["name"]:
                fail(f"Mandatory step order or name differs: {job['id']}:{index}")
            if step.get("status") != "PASS" or step.get("exitCode") != 0:
                fail(f"Mandatory step did not pass with exit code zero: {job['id']}:{index}")
            if step.get("skipped") is True or step.get("status") == "SKIPPED":
                fail(f"Mandatory step was skipped: {job['id']}:{index}")
            digest = step.get("outputSha256")
            if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
                fail(f"Missing mandatory step output checksum: {job['id']}:{index}")
            log_path = safe_log_path(evidence_dir, job["id"], index, step.get("log", ""), portable)
            log_bytes = log_path.read_bytes()
            if sha256(log_bytes) != digest:
                fail(f"Mandatory step log checksum mismatch: {job['id']}:{index}")
            if any(pattern.search(log_bytes) for pattern in SECRET_PATTERNS):
                fail(f"Credential-like content found in mandatory step log: {job['id']}:{index}")
            total_steps += 1
            verified_logs += 1

        if expected["postgres"]:
            postgres = job.get("postgres") or {}
            if postgres.get("status") != "READY" or postgres.get("image") != "postgres:16":
                fail(f"Disposable PostgreSQL 16 result is missing: {job['id']}")
            if job.get("rootlessContainerCleanup") != "PASS":
                fail(f"Rootless PostgreSQL container cleanup is unverified: {job['id']}")

    if total_steps != sum(len(expected_by_id[job_id]["steps"]) for job_id in REQUIRED_IDS):
        fail("Mandatory step total differs from the active workflow inventory")
    cleanup = result.get("cleanup") or {}
    if cleanup.get("createdGuestCount") != 8 or cleanup.get("disposedGuestCount") != 8:
        fail("All eight disposable CI guests must be confirmed disposed")
    if (cleanup.get("baseAfterRun") or {}).get("status") != "Stopped":
        fail("The credential-free Local CI base was not confirmed stopped")
    if cleanup.get("rootlessDockerSocketWasGuestLocal") is not True:
        fail("Guest-local rootless Docker boundary is unverified")
    if cleanup.get("githubRunnerRegistration") != "NOT_USED":
        fail("Evidence must confirm no GitHub runner registration")

    summary = {
        "evidence": "VERIFIED",
        "mandatoryJobs": len(required),
        "mandatorySteps": total_steps,
        "requiredSkips": 0,
        "verifiedStepLogs": verified_logs,
        "sourceTreeSha256": result["sourceTreeSha256"],
        "testedCommit": result["commitSha"],
        "cleanup": cleanup,
        "bundleChecksumFiles": checksum_count,
        "githubRequiredChecks": "ABSENT_FROM_LOCAL_EVIDENCE",
        "hostedActionsInvoked": False,
    }
    if portable:
        recorded = load_json(evidence_dir / "verification.json")
        for key in ("sourceTreeSha256", "testedCommit", "mandatoryJobs", "mandatorySteps", "requiredSkips", "verifiedStepLogs"):
            if recorded.get(key) != summary[key]:
                fail(f"Portable verification record mismatch: {key}")
    return summary


def git_output(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.PIPE)


def git_text(repo, *args):
    return git_output(repo, *args).decode("utf-8").strip()


def omitted_path(path):
    parts = pathlib.PurePosixPath(path).parts
    omitted = {".git", "node_modules", ".next", "dist", "coverage", ".turbo", ".cache", "playwright-report", "test-results", ".codex-ci-evidence"}
    if path in {"AI_PROGRESS.md", "DECISIONS.md"} or any(part in omitted for part in parts):
        return True
    if re.search(r"(^|/)(\.DS_Store|npm-debug\.log|yarn-debug\.log|pnpm-debug\.log)$", path):
        return True
    return False


def credential_path(path):
    if re.search(r"\.(example|sample|template)$", path, re.I):
        return False
    return re.search(r"(^|/)(\.env(?:\.[^/]*)?|[^/]+\.(?:pem|p12|pfx|key))$", path, re.I) is not None


def verify_git_source(evidence_dir, repo, expected_base, expected_head, allow_operational_docs=False):
    evidence_dir = pathlib.Path(evidence_dir).resolve()
    repo = pathlib.Path(repo).resolve()
    result = load_json(evidence_dir / "result.json")
    manifest = load_json(evidence_dir / "source-manifest.json")
    actual_head = git_text(repo, "rev-parse", "HEAD")
    if actual_head != expected_head:
        fail("Checked-out and expected published HEAD identities must match exactly")
    tested_commit = result.get("commitSha")
    if not isinstance(tested_commit, str) or not re.fullmatch(r"[0-9a-f]{40,64}", tested_commit):
        fail("Tested commit identity is malformed")
    if not re.fullmatch(r"[0-9a-f]{40,64}", expected_base):
        fail("Expected base must be a full commit SHA")
    for ancestor in (tested_commit, expected_head):
        try:
            subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", expected_base, ancestor], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            fail("Expected base is not an ancestor of the tested or published commit")
    if tested_commit != expected_head:
        if not allow_operational_docs:
            fail("Tested commit and published HEAD differ; operational-doc-only advancement was not authorized")
        try:
            subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", tested_commit, expected_head], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            fail("Tested commit must be an ancestor of published HEAD")
        try:
            commits = git_text(repo, "rev-list", "--reverse", f"{tested_commit}..{expected_head}").splitlines()
        except subprocess.CalledProcessError as error:
            fail(f"Cannot inspect commits after tested source: {error}")
        if not commits:
            fail("Tested and published commits differ without an inspectable commit range")
        for commit in commits:
            parents = git_text(repo, "rev-list", "--parents", "-n", "1", commit).split()
            if len(parents) != 2:
                fail("Operational-doc advancement must contain only single-parent commits")
            changed = git_output(repo, "diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", commit).decode("utf-8").splitlines()
            if not changed or any(path not in {"AI_PROGRESS.md", "DECISIONS.md"} for path in changed):
                fail("Post-test commit contains changes outside AI_PROGRESS.md or DECISIONS.md")
    if git_output(repo, "status", "--porcelain=v1", "--untracked-files=all"):
        fail("Published source checkout must be clean during verification")
    tree = git_text(repo, "rev-parse", f"{expected_head}^{{tree}}")
    records = git_output(repo, "ls-tree", "-r", "-z", "--full-tree", expected_head).split(b"\0")
    objects = {}
    for record in records:
        if not record:
            continue
        metadata, path_bytes = record.split(b"\t", 1)
        mode_raw, kind, oid = metadata.split(b" ", 2)
        path = path_bytes.decode("utf-8")
        if omitted_path(path):
            continue
        if credential_path(path):
            fail(f"Tracked credential-like path prevents source verification: {path}")
        if kind != b"blob":
            fail(f"Unsupported Git source entry type: {path}")
        objects[path] = (mode_raw.decode("ascii"), oid.decode("ascii"))

    entries = manifest.get("entries")
    if not isinstance(entries, list):
        fail("Source manifest entries are malformed")
    by_path = {entry.get("path"): entry for entry in entries}
    if len(by_path) != len(entries) or set(by_path) != set(objects):
        fail("Source manifest path inventory differs from the published Git tree")
    canonical_entries = []
    proc = subprocess.Popen(["git", "-C", str(repo), "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        for path in sorted(objects):
            mode, oid = objects[path]
            proc.stdin.write((oid + "\n").encode("ascii"))
            proc.stdin.flush()
            header = proc.stdout.readline().split()
            if len(header) != 3 or header[1] != b"blob":
                fail(f"Cannot read published Git blob: {path}")
            size = int(header[2])
            content = proc.stdout.read(size)
            if len(content) != size or proc.stdout.read(1) != b"\n":
                fail(f"Truncated published Git blob: {path}")
            symlink = mode == "120000"
            entry = by_path[path]
            expected_mode = 0o777 if symlink else (0o755 if mode == "100755" else 0o644)
            if entry.get("type") != ("symlink" if symlink else "file") or entry.get("mode") != expected_mode or entry.get("sha256") != sha256(content):
                fail(f"Published source content or mode differs from manifest: {path}")
            if symlink:
                if "size" in entry:
                    fail(f"Symlink source manifest has an unexpected size: {path}")
            elif entry.get("size") != size:
                fail(f"Published source size differs from manifest: {path}")
            canonical_entries.append(entry)
    finally:
        if proc.stdin:
            proc.stdin.close()
    if proc.wait() != 0:
        fail("Git blob verification did not complete cleanly")
    if canonical_manifest_hash(canonical_entries) != result.get("sourceTreeSha256"):
        fail("Published Git source fingerprint differs from tested Local CI source")
    verified = {"publishedHead": expected_head, "testedCommit": tested_commit, "baseCommit": expected_base, "gitTree": tree, "sourceManifestEntriesVerifiedAgainstPublishedGit": len(canonical_entries)}
    verification_path = evidence_dir / "verification.json"
    if verification_path.exists():
        record = load_json(verification_path)
        for key, value in verified.items():
            if record.get(key) != value:
                fail(f"Portable source verification record mismatch: {key}")
        if record.get("sourceTreeSha256") != result.get("sourceTreeSha256") or record.get("testedCommit") != tested_commit:
            fail("Portable tested source identity differs from the verified commit")
        if record.get("githubRequiredChecksEquivalent") is not False or "Unsigned" not in record.get("provenance", ""):
            fail("Portable evidence must state its unsigned, non-GitHub provenance")
    return verified


def portable_result(result):
    result = json.loads(json.dumps(result))
    result.pop("evidenceDir", None)
    result.pop("hostDiagnosticPaths", None)
    for job in result.get("jobs", []):
        for index, step in enumerate(job.get("steps", []), start=1):
            step["log"] = (pathlib.PurePosixPath("logs") / job["id"] / f"{index:02d}.log").as_posix()
    return result


def bundle_evidence(evidence_dir, repo, expected_base, expected_head, output, allow_operational_docs=False):
    evidence_dir = pathlib.Path(evidence_dir).resolve()
    repo = pathlib.Path(repo).resolve()
    inventory = expected_inventory(repo)
    summary = verify_evidence(evidence_dir, inventory)
    source = verify_git_source(evidence_dir, repo, expected_base, expected_head, allow_operational_docs)
    output = pathlib.Path(output).resolve()
    output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = pathlib.Path(tempfile.mkdtemp(prefix="local-ci-evidence-", dir=output.parent))
    try:
        result = load_json(evidence_dir / "result.json")
        (temporary / "result.json").write_text(json.dumps(portable_result(result), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        shutil.copyfile(evidence_dir / "source-manifest.json", temporary / "source-manifest.json")
        shutil.copyfile(pathlib.Path(__file__).resolve(), temporary / "evidence.py")
        for job in result.get("jobs", []):
            for index, step in enumerate(job.get("steps", []), start=1):
                source_log = safe_log_path(evidence_dir, job["id"], index, step.get("log", ""), False)
                target_log = temporary / "logs" / job["id"] / f"{index:02d}.log"
                target_log.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                shutil.copyfile(source_log, target_log)
        verification = {
            **summary,
            **source,
            "githubRequiredChecksEquivalent": False,
            "provenance": "Unsigned trusted-host Local CI evidence; not GitHub Checks",
            "productionWrites": False,
        }
        (temporary / "verification.json").write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        operational_flag = " --allow-operational-docs" if allow_operational_docs else ""
        readme = (
            "Portable Local CI evidence bundle. Original execution artifacts remain unchanged in the raw evidence directory.\n"
            "All included mandatory per-step logs are the redacted runner outputs and match the SHA-256 values in result.json.\n"
            "Verify the transport checksum first, install the pinned parser with npm ci --prefix tools/codex-ci, then run: python3 evidence.py verify --evidence-dir . "
            f"--repo /path/to/line-unified-inbox --base {expected_base} --head {expected_head}{operational_flag}\n"
            "Local PASS is not a GitHub Check and does not establish branch protection or merge authorization.\n"
            "Evidence has no detached signature; hashes establish consistency and integrity after handoff, not signed runner provenance.\n"
        )
        (temporary / "README.txt").write_text(readme, encoding="utf-8")
        files = sorted(path for path in temporary.rglob("*") if path.is_file())
        sums = "".join(f"{sha256(path.read_bytes())}  {path.relative_to(temporary).as_posix()}\n" for path in files)
        (temporary / "SHA256SUMS").write_text(sums, encoding="utf-8")
        bundle_inventory = expected_inventory(repo)
        verify_evidence(temporary, bundle_inventory)
        verify_git_source(temporary, repo, expected_base, expected_head, allow_operational_docs)
        if output.exists():
            fail("Evidence archive output already exists; refusing to overwrite it")
        with tarfile.open(output, "w:gz") as archive:
            archive.add(temporary, arcname="local-ci-evidence")
        checksum_path = output.with_name(output.name + ".sha256")
        os.chmod(output, 0o600)
        checksum_path.write_text(f"{sha256(output.read_bytes())}  {output.name}\n", encoding="utf-8")
        os.chmod(checksum_path, 0o600)
        return {"bundle": str(output), "sha256": sha256(output.read_bytes()), "verification": verification}
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("verify", "bundle"):
        sub = subparsers.add_parser(command)
        sub.add_argument("--evidence-dir", required=True)
        sub.add_argument("--repo", required=True)
        sub.add_argument("--base", required=True)
        sub.add_argument("--head", required=True)
        sub.add_argument("--allow-operational-docs", action="store_true", help="allow only post-test commits that change AI_PROGRESS.md or DECISIONS.md")
        if command == "bundle":
            sub.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "bundle":
            output = bundle_evidence(args.evidence_dir, args.repo, args.base, args.head, args.output, args.allow_operational_docs)
        else:
            inventory = expected_inventory(pathlib.Path(args.repo).resolve())
            summary = verify_evidence(args.evidence_dir, inventory)
            source = verify_git_source(args.evidence_dir, args.repo, args.base, args.head, args.allow_operational_docs)
            output = {**summary, **source, "githubRequiredChecksEquivalent": False}
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, subprocess.SubprocessError, KeyError, TypeError) as error:
        print(f"Local CI evidence verification failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
