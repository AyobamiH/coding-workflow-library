"use strict";

const runtime = require("./runtime-context");
const { fs, path, EXPECTED_GITHUB_REPO, FEATURE_BRANCH, SCHEDULER_BRANCH, EXPECTED_COMMIT, EXPECTED_COMMIT_SUBJECT, PR_BODY_PATH, PR_NUMBER, SCHEDULER_PR_NUMBER, SCHEDULER_MIGRATION_FILE, SCHEDULER_PR_FILES, targetRepo, evidence, filesChanged } = runtime.pick(["fs","path","EXPECTED_GITHUB_REPO","FEATURE_BRANCH","SCHEDULER_BRANCH","EXPECTED_COMMIT","EXPECTED_COMMIT_SUBJECT","PR_BODY_PATH","PR_NUMBER","SCHEDULER_PR_NUMBER","SCHEDULER_MIGRATION_FILE","SCHEDULER_PR_FILES","targetRepo","evidence","filesChanged"]);
const main = runtime.lazy("main");
const run = runtime.lazy("run");
const summarizeList = runtime.lazy("summarizeList");
const firstLine = runtime.lazy("firstLine");

function viewSchedulerPr(ghEnv) {
  const view = run(
    "gh",
    [
      "pr",
      "view",
      "--repo",
      EXPECTED_GITHUB_REPO,
      SCHEDULER_BRANCH,
      "--json",
      "url,title,state,headRefName,baseRefName",
    ],
    { env: ghEnv, allowFailure: true },
  );
  if (view.code !== 0) return { ok: false };
  try {
    const data = JSON.parse(view.stdout);
    return { ok: true, url: data.url, data };
  } catch {
    return { ok: false };
  }
}

function verifyRepoAccess(ghEnv) {
  const repoView = run(
    "gh",
    ["repo", "view", EXPECTED_GITHUB_REPO, "--json", "nameWithOwner,visibility,viewerPermission"],
    { env: ghEnv },
  );
  if (repoView.code !== 0) {
    return {
      ok: false,
      result: {
        finalStatus: "NEEDS JOHN",
        ledgerStatus: "Needs John token permission fix",
        summary: `repo view failed: ${firstLine(repoView.stderr || repoView.stdout)}`,
        nextPermission: "auth-check",
        nextSkill: "github-auth-gate-skill",
        exitCode: 2,
      },
    };
  }

  let repoJson;
  try {
    repoJson = JSON.parse(repoView.stdout);
  } catch (error) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: repo view parse failed",
        summary: `could not parse repo view JSON: ${error.message}`,
        nextPermission: "manual review",
        nextSkill: "github-auth-gate-skill",
        exitCode: 1,
      },
    };
  }

  if (repoJson.nameWithOwner !== EXPECTED_GITHUB_REPO) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: wrong repo",
        summary: `repo view returned ${repoJson.nameWithOwner}`,
        nextPermission: "manual review",
        nextSkill: "github-auth-gate-skill",
        exitCode: 1,
      },
    };
  }

  if (!["WRITE", "MAINTAIN", "ADMIN"].includes(repoJson.viewerPermission)) {
    return {
      ok: false,
      result: {
        finalStatus: "NEEDS JOHN",
        ledgerStatus: "Needs John token permission fix",
        summary: `viewerPermission is ${repoJson.viewerPermission}`,
        nextPermission: "token permission fix",
        nextSkill: "github-auth-gate-skill",
        exitCode: 2,
      },
    };
  }

  evidence.push(`repo access: ${repoJson.nameWithOwner} ${repoJson.viewerPermission}`);
  return { ok: true, data: repoJson };
}

function viewPrReadiness(ghEnv) {
  const fullFields = "url,title,state,headRefName,baseRefName,mergeable,reviewDecision,files,commits";
  const full = run(
    "gh",
    ["pr", "view", "--repo", EXPECTED_GITHUB_REPO, PR_NUMBER, "--json", fullFields],
    { env: ghEnv, allowFailure: true },
  );
  if (full.code === 0) {
    try {
      return { ok: true, data: JSON.parse(full.stdout), fields: fullFields };
    } catch (error) {
      return prReadinessUnknown(`could not parse full PR JSON: ${error.message}`);
    }
  }

  evidence.push(`full PR JSON fields unavailable: ${firstLine(full.stderr || full.stdout)}`);
  const fallbackFields = "url,title,state,headRefName,baseRefName,files,commits";
  const fallback = run(
    "gh",
    ["pr", "view", "--repo", EXPECTED_GITHUB_REPO, PR_NUMBER, "--json", fallbackFields],
    { env: ghEnv, allowFailure: true },
  );
  if (fallback.code === 0) {
    try {
      const data = JSON.parse(fallback.stdout);
      data.mergeable = null;
      data.reviewDecision = null;
      evidence.push("PR mergeable/reviewDecision unavailable from installed gh field set");
      return { ok: true, data, fields: fallbackFields };
    } catch (error) {
      return prReadinessUnknown(`could not parse fallback PR JSON: ${error.message}`);
    }
  }

  return prReadinessUnknown(`PR view failed: ${firstLine(fallback.stderr || fallback.stdout || full.stderr || full.stdout)}`);
}

function prReadinessUnknown(summary) {
  return {
    ok: false,
    result: {
      finalStatus: "BLOCKED",
      ledgerStatus: "PR readiness unknown",
      summary,
      nextPermission: "manual PR readiness review",
      nextSkill: "github-handoff-skill",
      exitCode: 1,
    },
  };
}

function inspectPrChecks(ghEnv) {
  const checks = run("gh", ["pr", "checks", "--repo", EXPECTED_GITHUB_REPO, PR_NUMBER], {
    env: ghEnv,
    allowFailure: true,
  });
  const output = [checks.stdout, checks.stderr].filter(Boolean).join("\n").trim();
  if (checks.code !== 0) {
    return {
      available: false,
      blocked: false,
      summary: `checks unavailable: ${firstLine(output)}`,
      raw: output,
    };
  }

  const lines = output ? output.split(/\r?\n/).filter(Boolean) : [];
  const failing = lines.filter((line) => /\bfail|failing|error|cancel|timed out|action_required\b/i.test(line));
  const pending = lines.filter((line) => /\bpending|queued|in_progress|waiting|skipping\b/i.test(line));
  let summary = "checks available";
  if (!lines.length) summary = "checks available but no check rows returned";
  else if (failing.length) summary = `checks blocked: ${failing.length} failing/cancelled rows`;
  else if (pending.length) summary = `checks pending: ${pending.length} pending rows`;
  else summary = `checks passing or neutral: ${lines.length} rows`;

  return {
    available: true,
    blocked: failing.length > 0 || pending.length > 0,
    summary,
    raw: output,
  };
}

function extractPrFiles(pr) {
  if (!Array.isArray(pr.files)) return [];
  return pr.files
    .map((file) => file.path || file.filename || file.name || "")
    .filter(Boolean)
    .sort();
}

function summarizeCommits(commits) {
  if (!Array.isArray(commits) || commits.length === 0) return "none";
  return commits
    .map((commit) => {
      const oid = commit.oid || commit.sha || "";
      const shortOid = oid ? oid.slice(0, 7) : "unknown";
      const message = commit.messageHeadline || commit.message || commit.subject || "";
      return message ? `${shortOid} ${message}` : shortOid;
    })
    .join("; ");
}

function collectPrLocalEvidence(repo) {
  if (!fs.existsSync(repo)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "PR readiness unknown",
        summary: `target repo does not exist: ${repo}`,
        nextPermission: "manual repo repair",
        nextSkill: "repo-map-skill",
        exitCode: 1,
      },
    };
  }

  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-3"]);

  if ([status, branch, log].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "PR readiness unknown",
        summary: "one or more local git evidence commands failed",
        nextPermission: "manual repo repair",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  evidence.push(`local branch: ${branch.stdout.trim() || "(detached)"}`);
  evidence.push(`local status: ${status.stdout.trim() || "clean"}`);
  evidence.push(`recent log: ${firstLine(log.stdout)}`);

  const statusLines = status.stdout.trim() ? status.stdout.trim().split(/\r?\n/) : [];
  const onlyEvidence = statusLines.length === 0 || statusLines.every((line) => line === "?? evidence/");
  if (!onlyEvidence) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "PR readiness unknown",
        summary: `unexpected local git status: ${statusLines.join("; ")}`,
        nextPermission: "manual repo cleanup",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  return { ok: true, branch: branch.stdout.trim() };
}

function classifyPrReadiness({ pr, unexpectedFiles, missingFiles, checks }) {
  if (unexpectedFiles.length || missingFiles.length) {
    return {
      status: "PR blocked by unexpected files",
      summary: `unexpected files: ${unexpectedFiles.join(", ") || "none"}; missing intended files: ${missingFiles.join(", ") || "none"}`,
      nextPermission: "approve fixing PR blockers",
    };
  }

  if (pr.state !== "OPEN") {
    return {
      status: "PR readiness unknown",
      summary: `PR state is ${pr.state || "unknown"}, not OPEN`,
      nextPermission: "hold",
    };
  }

  if (pr.baseRefName !== "main" || pr.headRefName !== FEATURE_BRANCH) {
    return {
      status: "PR blocked by unexpected files",
      summary: `unexpected PR branch routing: base ${pr.baseRefName || "unknown"}, head ${pr.headRefName || "unknown"}`,
      nextPermission: "approve fixing PR blockers",
    };
  }

  if (pr.mergeable && !["MERGEABLE", "UNKNOWN"].includes(pr.mergeable)) {
    return {
      status: "PR blocked by mergeability",
      summary: `mergeable state is ${pr.mergeable}`,
      nextPermission: "approve fixing PR blockers",
    };
  }

  if (checks.available && checks.blocked) {
    return {
      status: "PR blocked by checks",
      summary: checks.summary,
      nextPermission: "approve fixing PR blockers",
    };
  }

  if (!checks.available || !pr.mergeable || pr.mergeable === "UNKNOWN") {
    return {
      status: "PR readiness unknown",
      summary: `${checks.summary}; mergeable ${pr.mergeable || "unavailable"}`,
      nextPermission: "approve PR merge or hold after manual review",
    };
  }

  return {
    status: "PR ready for merge approval",
    summary: "PR files match intended scope, checks are not blocking, and mergeable state is acceptable",
    nextPermission: "approve PR merge",
  };
}

function classifyPrMergeSafety({ pr, unexpectedFiles, missingFiles, checks }) {
  if (unexpectedFiles.length || missingFiles.length) {
    return {
      ok: false,
      status: "PR blocked by unexpected files",
      summary: `unexpected files: ${unexpectedFiles.join(", ") || "none"}; missing intended files: ${missingFiles.join(", ") || "none"}`,
      nextPermission: "approve fixing PR blockers",
    };
  }

  if (pr.state !== "OPEN") {
    return {
      ok: false,
      status: "PR readiness unknown",
      summary: `PR state is ${pr.state || "unknown"}, not OPEN`,
      nextPermission: "hold",
    };
  }

  if (pr.baseRefName !== "main" || pr.headRefName !== FEATURE_BRANCH) {
    return {
      ok: false,
      status: "PR blocked by unexpected files",
      summary: `unexpected PR branch routing: base ${pr.baseRefName || "unknown"}, head ${pr.headRefName || "unknown"}`,
      nextPermission: "approve fixing PR blockers",
    };
  }

  if (pr.mergeable !== "MERGEABLE") {
    return {
      ok: false,
      status: "PR blocked by mergeability",
      summary: `mergeable state is ${pr.mergeable || "unavailable"}, not MERGEABLE`,
      nextPermission: "approve fixing PR blockers or hold",
    };
  }

  if (!checks.available) {
    return {
      ok: false,
      status: "PR readiness unknown",
      summary: checks.summary,
      nextPermission: "hold until PR checks can be verified",
    };
  }

  if (checks.blocked) {
    return {
      ok: false,
      status: "PR blocked by checks",
      summary: checks.summary,
      nextPermission: "approve fixing PR blockers",
    };
  }

  return {
    ok: true,
    status: "PR merge safety pass",
    summary: "PR is open, mergeable, scoped to intended files, and checks are not blocking",
  };
}

function inspectLocalWorkflowDeployTriggers(repo) {
  const workflowsDir = path.join(repo, ".github", "workflows");
  const grepPattern = "deploy|supabase|cloudflare|wrangler|pages|production|secrets";
  const externalCaveat = "external provider auto-deploys cannot be fully proven from source-only repo workflow inspection";

  const findResult = run("find", [workflowsDir, "-maxdepth", "1", "-type", "f", "-print"], {
    allowFailure: true,
  });
  const grepResult = run("grep", ["-RniE", grepPattern, workflowsDir], {
    allowFailure: true,
  });

  const files = findResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const grepHits = grepResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  evidence.push(`workflow files: ${files.length ? files.map((file) => path.relative(repo, file)).join(", ") : "none"}`);
  evidence.push(`workflow deployment-keyword grep hits: ${summarizeList(grepHits, 6)}`);
  evidence.push(externalCaveat);

  const blockingFiles = [];
  const deploymentKeyword = /\b(deploy|supabase|cloudflare|wrangler|pages|production)\b/i;
  for (const file of files) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch (error) {
      evidence.push(`workflow read failed: ${path.relative(repo, file)}: ${error.message}`);
      continue;
    }

    const hasDeploymentKeyword = deploymentKeyword.test(text);
    const hasPushTrigger = /(^|\n)\s*on:\s*(?:\[.*\bpush\b.*\]|push\b)|(^|\n)\s*push:\s*(?:\n|$)/i.test(text);
    const hasBranchFilter = /(^|\n)\s*branches(?:-ignore)?:/i.test(text);
    const hasMainBranch = /(^|\n)\s*branches:\s*(?:\[.*\bmain\b.*\]|.*\bmain\b)|(^|\n)\s*-\s*main\s*$/im.test(text);
    const pushCouldIncludeMain = hasPushTrigger && (hasMainBranch || !hasBranchFilter);

    if (hasDeploymentKeyword && pushCouldIncludeMain) {
      blockingFiles.push(path.relative(repo, file));
    }
  }

  if (blockingFiles.length) {
    return {
      blocking: true,
      files,
      grepHits,
      blockingFiles,
      summary: `repo-local workflow evidence suggests merging main may deploy: ${blockingFiles.join(", ")}`,
      caveat: externalCaveat,
    };
  }

  return {
    blocking: false,
    files,
    grepHits,
    blockingFiles,
    summary: grepHits.length
      ? "workflow keyword hits were found, but no clear repo-local push-to-main deployment trigger was detected"
      : "no repo-local GitHub workflow deployment evidence was detected",
    caveat: externalCaveat,
  };
}

function viewPrFinal(ghEnv) {
  const fields = "url,title,state,mergedAt,baseRefName,headRefName";
  const view = run("gh", ["pr", "view", "--repo", EXPECTED_GITHUB_REPO, PR_NUMBER, "--json", fields], {
    env: ghEnv,
    allowFailure: true,
  });
  if (view.code !== 0) {
    return { ok: false, summary: firstLine(view.stderr || view.stdout) };
  }
  try {
    return { ok: true, data: JSON.parse(view.stdout) };
  } catch (error) {
    return { ok: false, summary: `could not parse final PR JSON: ${error.message}` };
  }
}

function viewSchedulerPr(ghEnv) {
  const fields = "url,title,state,mergedAt,headRefName,baseRefName,mergeable,files,commits";
  const view = run(
    "gh",
    ["pr", "view", "--repo", EXPECTED_GITHUB_REPO, SCHEDULER_PR_NUMBER, "--json", fields],
    { env: ghEnv, allowFailure: true },
  );
  if (view.code !== 0) {
    return prReadinessUnknown(`scheduler PR view failed: ${firstLine(view.stderr || view.stdout)}`);
  }
  try {
    return { ok: true, data: JSON.parse(view.stdout), fields };
  } catch (error) {
    return prReadinessUnknown(`could not parse scheduler PR JSON: ${error.message}`);
  }
}

function inspectSchedulerPrChecks(ghEnv) {
  const checks = run("gh", ["pr", "checks", "--repo", EXPECTED_GITHUB_REPO, SCHEDULER_PR_NUMBER], {
    env: ghEnv,
    allowFailure: true,
  });
  const output = [checks.stdout, checks.stderr].filter(Boolean).join("\n").trim();
  if (checks.code !== 0) {
    return {
      available: false,
      blocked: false,
      summary: `checks unavailable: ${firstLine(output)}`,
      raw: output,
    };
  }

  const lines = output ? output.split(/\r?\n/).filter(Boolean) : [];
  const failing = lines.filter((line) => /\bfail|failing|error|cancel|timed out|action_required\b/i.test(line));
  const pending = lines.filter((line) => /\bpending|queued|in_progress|waiting|skipping\b/i.test(line));
  let summary = "checks available";
  if (!lines.length) summary = "checks available but no check rows returned";
  else if (failing.length) summary = `checks blocked: ${failing.length} failing/cancelled rows`;
  else if (pending.length) summary = `checks pending: ${pending.length} pending rows`;
  else summary = `checks passing or neutral: ${lines.length} rows`;

  return {
    available: true,
    blocked: failing.length > 0 || pending.length > 0,
    summary,
    raw: output,
  };
}

function viewSchedulerPrFinal(ghEnv) {
  const fields = "url,title,state,mergedAt,baseRefName,headRefName";
  const view = run(
    "gh",
    ["pr", "view", "--repo", EXPECTED_GITHUB_REPO, SCHEDULER_PR_NUMBER, "--json", fields],
    { env: ghEnv, allowFailure: true },
  );
  if (view.code !== 0) {
    return { ok: false, summary: firstLine(view.stderr || view.stdout) };
  }
  try {
    return { ok: true, data: JSON.parse(view.stdout) };
  } catch (error) {
    return { ok: false, summary: `could not parse scheduler PR final JSON: ${error.message}` };
  }
}

function scanSchedulerMigrationForHardcodedSecrets(repo) {
  if (!fs.existsSync(repo)) {
    return {
      ok: false,
      summary: `target repo does not exist: ${repo}`,
    };
  }

  const refs = [];
  const branchFetch = run("git", ["-C", repo, "fetch", "origin", SCHEDULER_BRANCH], {
    allowFailure: true,
  });
  if (branchFetch.code === 0) {
    refs.push(`origin/${SCHEDULER_BRANCH}`);
  } else {
    evidence.push(`scheduler branch fetch unavailable: ${firstLine(branchFetch.stderr || branchFetch.stdout)}`);
  }

  const mainFetch = run("git", ["-C", repo, "fetch", "origin", "main"], {
    allowFailure: true,
  });
  if (mainFetch.code === 0) refs.push("origin/main");
  refs.push("main", "HEAD");

  const secretPattern =
    /IMPORT_REDDIT_TIPS_SECRET=.*[A-Za-z0-9_-]{12,}|x-import-reddit-tips-secret.*[A-Za-z0-9_-]{12,}|SUPABASE_SERVICE_ROLE_KEY=.*[A-Za-z0-9_-]{12,}/i;

  for (const ref of Array.from(new Set(refs))) {
    const show = run("git", ["-C", repo, "show", `${ref}:${SCHEDULER_MIGRATION_FILE}`], {
      allowFailure: true,
    });
    if (show.code !== 0) continue;
    if (secretPattern.test(show.stdout)) {
      evidence.push(`scheduler migration secret scan: blocked at ${ref}`);
      return {
        ok: false,
        summary: `secret-shaped value found in ${SCHEDULER_MIGRATION_FILE} at ${ref}; value not printed`,
      };
    }
    evidence.push(`scheduler migration secret scan: no hardcoded secret-shaped value in ${ref}`);
    return {
      ok: true,
      summary: `no hardcoded secret-shaped value found in ${SCHEDULER_MIGRATION_FILE} at ${ref}`,
      ref,
    };
  }

  return {
    ok: false,
    summary: `could not read ${SCHEDULER_MIGRATION_FILE} from scheduler branch, origin/main, main, or HEAD`,
  };
}

function verifyLocalSchedulerMergeState(repo) {
  if (!fs.existsSync(repo)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: target repo missing",
        summary: `target repo does not exist: ${repo}`,
        nextPermission: "manual repo repair",
        nextSkill: "repo-map-skill",
        exitCode: 1,
      },
    };
  }

  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-8"]);
  const headSubject = run("git", ["-C", repo, "show", "--quiet", "--format=%s", "HEAD"]);
  const headFiles = run("git", ["-C", repo, "show", "--format=", "--name-only", "HEAD"]);

  if ([status, branch, log, headSubject, headFiles].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: local scheduler merge evidence failed",
        summary: "one or more local git evidence commands failed",
        nextPermission: "manual repo repair",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  const changedFiles = headFiles.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
  const unexpectedFiles = changedFiles.filter((file) => !SCHEDULER_PR_FILES.includes(file));
  const missingFiles = SCHEDULER_PR_FILES.filter((file) => !changedFiles.includes(file));
  const statusLines = status.stdout.trim() ? status.stdout.trim().split(/\r?\n/) : [];
  const onlyAllowedUntracked =
    statusLines.length === 0 || statusLines.every((line) => line === "?? evidence/" || line === "?? supabase/.temp/");

  evidence.push(`local scheduler merge branch: ${branch.stdout.trim() || "(detached)"}`);
  evidence.push(`local scheduler merge status: ${status.stdout.trim() || "clean"}`);
  evidence.push(`local scheduler merge recent log: ${firstLine(log.stdout)}`);
  evidence.push(`local scheduler merge HEAD subject: ${headSubject.stdout.trim() || "unknown"}`);
  evidence.push(`local scheduler merge HEAD files: ${changedFiles.length ? changedFiles.join(", ") : "none"}`);

  if ((branch.stdout.trim() || "") !== "main") {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: local scheduler merge evidence failed",
        summary: `target repo branch is ${branch.stdout.trim() || "(detached)"}, expected main`,
        nextPermission: "manual repo review",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  if (!/Draft import reddit tips scheduler secret migration/i.test(headSubject.stdout)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: local scheduler merge evidence failed",
        summary: `HEAD subject is not the expected scheduler migration merge subject`,
        nextPermission: "manual repo review",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  if (unexpectedFiles.length || missingFiles.length) {
    return {
      ok: false,
      result: {
        finalStatus: "PR blocked by unexpected files",
        ledgerStatus: "PR blocked by unexpected files",
        summary: `local scheduler merge files unexpected: ${unexpectedFiles.join(", ") || "none"}; missing: ${missingFiles.join(", ") || "none"}`,
        nextPermission: "manual scheduler merge review",
        nextSkill: "github-handoff-skill",
        exitCode: 2,
      },
    };
  }

  if (!onlyAllowedUntracked) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: unexpected target repo changes",
        summary: `unexpected local git status: ${statusLines.join("; ")}`,
        nextPermission: "manual repo cleanup",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  return {
    ok: true,
    changedFiles,
    unexpectedFiles,
    missingFiles,
    localState: {
      status: status.stdout.trim() || "clean",
      branch: branch.stdout.trim() || "(detached)",
      log: log.stdout.trim(),
    },
  };
}

function collectPostMergeLocalEvidence(repo) {
  if (!fs.existsSync(repo)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: post-merge repo evidence failed",
        summary: `target repo does not exist: ${repo}`,
        nextPermission: "manual repo repair",
        nextSkill: "repo-map-skill",
        exitCode: 1,
      },
    };
  }

  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-5"]);

  if ([status, branch, log].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: post-merge repo evidence failed",
        summary: "one or more post-merge git evidence commands failed",
        nextPermission: "manual repo repair",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  const data = {
    status: status.stdout.trim() || "clean",
    branch: branch.stdout.trim() || "(detached)",
    log: log.stdout.trim(),
  };

  evidence.push(`post-merge local branch: ${data.branch}`);
  evidence.push(`post-merge local status: ${data.status}`);
  evidence.push(`post-merge recent log: ${firstLine(data.log)}`);

  return { ok: true, data };
}

function collectLocalRepoEvidence(repo) {
  if (!fs.existsSync(repo)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: target repo missing",
        summary: `target repo does not exist: ${repo}`,
        nextPermission: "manual repo repair",
        nextSkill: "repo-map-skill",
        exitCode: 1,
      },
    };
  }

  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-3"]);
  const staged = run("git", ["-C", repo, "diff", "--cached", "--name-only"]);
  const commitSubject = run("git", ["-C", repo, "show", "--quiet", "--format=%s", EXPECTED_COMMIT]);

  if ([status, branch, log, staged, commitSubject].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: local repo evidence failed",
        summary: "one or more git evidence commands failed",
        nextPermission: "manual repo repair",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  evidence.push(`local branch: ${branch.stdout.trim() || "(detached)"}`);
  evidence.push(`local status: ${status.stdout.trim() || "clean"}`);
  evidence.push(`recent log: ${firstLine(log.stdout)}`);

  if (!commitSubject.stdout.includes(EXPECTED_COMMIT_SUBJECT)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: expected commit missing",
        summary: `${EXPECTED_COMMIT} does not have expected subject`,
        nextPermission: "manual repo repair",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  if (staged.stdout.trim() !== "") {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: staged files present",
        summary: "staged area is not empty",
        nextPermission: "manual repo cleanup",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  const statusLines = status.stdout.trim() ? status.stdout.trim().split(/\r?\n/) : [];
  const onlyEvidence = statusLines.length === 0 || statusLines.every((line) => line === "?? evidence/");
  if (!onlyEvidence) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: unexpected dirty state",
        summary: `unexpected git status: ${statusLines.join("; ")}`,
        nextPermission: "manual repo cleanup",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  return {
    ok: true,
    branch: branch.stdout.trim(),
  };
}

function createOrSwitchBranch() {
  const branchList = run("git", ["-C", targetRepo, "branch", "--list", FEATURE_BRANCH]);
  if (branchList.code !== 0) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: branch check failed",
        summary: firstLine(branchList.stderr || branchList.stdout),
        nextPermission: "manual branch repair",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }

  if (branchList.stdout.trim()) {
    const switched = run("git", ["-C", targetRepo, "switch", FEATURE_BRANCH]);
    if (switched.code !== 0) {
      return {
        ok: false,
        result: {
          finalStatus: "BLOCKED",
          ledgerStatus: "Blocked: branch switch failed",
          summary: firstLine(switched.stderr || switched.stdout),
          nextPermission: "manual branch repair",
          nextSkill: "github-handoff-skill",
          exitCode: 1,
        },
      };
    }
    return { ok: true, action: `switched to ${FEATURE_BRANCH}` };
  }

  const created = run("git", ["-C", targetRepo, "switch", "-c", FEATURE_BRANCH]);
  if (created.code !== 0) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: branch creation failed",
        summary: firstLine(created.stderr || created.stdout),
        nextPermission: "manual branch repair",
        nextSkill: "github-handoff-skill",
        exitCode: 1,
      },
    };
  }
  return { ok: true, action: `created ${FEATURE_BRANCH}` };
}

function viewPr(ghEnv) {
  const view = run(
    "gh",
    [
      "pr",
      "view",
      "--repo",
      EXPECTED_GITHUB_REPO,
      FEATURE_BRANCH,
      "--json",
      "url,title,state,headRefName,baseRefName",
    ],
    { env: ghEnv, allowFailure: true },
  );
  if (view.code !== 0) return { ok: false };
  try {
    const data = JSON.parse(view.stdout);
    return {
      ok: true,
      url: data.url,
      data,
    };
  } catch {
    return { ok: false };
  }
}

function writePrBody() {
  const body = `## Summary

* Adds server-side authorization boundary to \`import-reddit-tips\`
* Supports authenticated admin callers
* Supports scheduled calls with \`x-import-reddit-tips-secret\`
* Delays service-role usage until after authorization and rate limiting
* Documents required Supabase secret and scheduler update

## Validation

* \`npm ci\` passed
* \`npm run build\` passed
* \`git diff --check\` passed
* exact-file commit completed
* secret scan passed with runtime secret access treated as safe

## Known Caveats

* \`npm run lint\` still fails on unrelated pre-existing issues
* Vitest still fails because \`vitest.config.ts\` imports \`@vitejs/plugin-react\` while the repo has \`@vitejs/plugin-react-swc\`
* no deployment was run
* no Supabase migration was run
* no production endpoint was called

## Post-Merge / Deployment Requirements

* deploy the Supabase Edge Function
* set \`IMPORT_REDDIT_TIPS_SECRET\` in Supabase secrets
* update the scheduler to send \`x-import-reddit-tips-secret\`
* verify unauthenticated request fails
* verify anon-only request fails
* verify non-admin request fails
* verify admin request succeeds
* verify scheduled valid-secret request succeeds
* verify invalid/missing scheduler secret fails
* verify repeated calls hit rate limit
* verify deployed RLS/grants
`;
  fs.writeFileSync(PR_BODY_PATH, body);
  filesChanged.push(PR_BODY_PATH);
}

module.exports = {
  viewSchedulerPr,
  verifyRepoAccess,
  viewPrReadiness,
  prReadinessUnknown,
  inspectPrChecks,
  extractPrFiles,
  summarizeCommits,
  collectPrLocalEvidence,
  classifyPrReadiness,
  classifyPrMergeSafety,
  inspectLocalWorkflowDeployTriggers,
  viewPrFinal,
  viewSchedulerPr,
  inspectSchedulerPrChecks,
  viewSchedulerPrFinal,
  scanSchedulerMigrationForHardcodedSecrets,
  verifyLocalSchedulerMergeState,
  collectPostMergeLocalEvidence,
  collectLocalRepoEvidence,
  createOrSwitchBranch,
  viewPr,
  writePrBody,
};
