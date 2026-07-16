"use strict";

const runtime = require("./runtime-context");
const { DEFAULT_ENV_FILE, EXPECTED_GITHUB_REPO, EXPECTED_GITHUB_USER, FEATURE_BRANCH, SCHEDULER_BRANCH, EXPECTED_COMMIT, PR_TITLE, PR_BODY_PATH, PR_NUMBER, SCHEDULER_PR_NUMBER, INTENDED_PR_FILES, SCHEDULER_PR_FILES, SCHEDULER_PR_COMMITS, targetRepo, dryRun, evidence, actions } = runtime.pick(["DEFAULT_ENV_FILE","EXPECTED_GITHUB_REPO","EXPECTED_GITHUB_USER","FEATURE_BRANCH","SCHEDULER_BRANCH","EXPECTED_COMMIT","PR_TITLE","PR_BODY_PATH","PR_NUMBER","SCHEDULER_PR_NUMBER","INTENDED_PR_FILES","SCHEDULER_PR_FILES","SCHEDULER_PR_COMMITS","targetRepo","dryRun","evidence","actions"]);
const main = runtime.lazy("main");
const cleanField = runtime.lazy("cleanField");
const viewSchedulerPr = runtime.lazy("viewSchedulerPr");
const verifyRepoAccess = runtime.lazy("verifyRepoAccess");
const viewPrReadiness = runtime.lazy("viewPrReadiness");
const inspectPrChecks = runtime.lazy("inspectPrChecks");
const extractPrFiles = runtime.lazy("extractPrFiles");
const summarizeCommits = runtime.lazy("summarizeCommits");
const collectPrLocalEvidence = runtime.lazy("collectPrLocalEvidence");
const classifyPrReadiness = runtime.lazy("classifyPrReadiness");
const classifyPrMergeSafety = runtime.lazy("classifyPrMergeSafety");
const inspectLocalWorkflowDeployTriggers = runtime.lazy("inspectLocalWorkflowDeployTriggers");
const viewPrFinal = runtime.lazy("viewPrFinal");
const inspectSchedulerPrChecks = runtime.lazy("inspectSchedulerPrChecks");
const viewSchedulerPrFinal = runtime.lazy("viewSchedulerPrFinal");
const scanSchedulerMigrationForHardcodedSecrets = runtime.lazy("scanSchedulerMigrationForHardcodedSecrets");
const verifyLocalSchedulerMergeState = runtime.lazy("verifyLocalSchedulerMergeState");
const collectPostMergeLocalEvidence = runtime.lazy("collectPostMergeLocalEvidence");
const collectLocalRepoEvidence = runtime.lazy("collectLocalRepoEvidence");
const createOrSwitchBranch = runtime.lazy("createOrSwitchBranch");
const viewPr = runtime.lazy("viewPr");
const writePrBody = runtime.lazy("writePrBody");
const loadEnvFile = runtime.lazy("loadEnvFile");
const buildGhEnv = runtime.lazy("buildGhEnv");
const run = runtime.lazy("run");
const firstLine = runtime.lazy("firstLine");

function runGithubHandoff() {
  const envFile = loadEnvFile(DEFAULT_ENV_FILE);
  const ghToken = envFile.GH_TOKEN || process.env.GH_TOKEN || "";
  const githubTokenPresent = Boolean(envFile.GITHUB_TOKEN || process.env.GITHUB_TOKEN);
  const ghTokenPresent = Boolean(ghToken);
  evidence.push(`GH_TOKEN presence: ${ghTokenPresent ? "set" : "not set"}`);
  evidence.push(`GITHUB_TOKEN presence: ${githubTokenPresent ? "set" : "not set"}`);

  if (!ghTokenPresent) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token replacement",
      summary: "GH_TOKEN is not set in runtime env",
      nextPermission: "auth-check",
      nextSkill: "github-auth-gate-skill",
      exitCode: 2,
    };
  }

  const ghEnv = buildGhEnv(ghToken);
  const user = run("gh", ["api", "user", "--jq", ".login"], { env: ghEnv });
  if (user.code !== 0 || user.stdout.trim() !== EXPECTED_GITHUB_USER) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token replacement",
      summary: `GH_TOKEN user check failed: ${firstLine(user.stderr || user.stdout)}`,
      nextPermission: "auth-check",
      nextSkill: "github-auth-gate-skill",
      exitCode: 2,
    };
  }
  evidence.push(`GH_TOKEN user: ${EXPECTED_GITHUB_USER}`);

  const repoView = run(
    "gh",
    ["repo", "view", EXPECTED_GITHUB_REPO, "--json", "nameWithOwner,visibility,viewerPermission"],
    { env: ghEnv },
  );
  if (repoView.code !== 0) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token permission fix",
      summary: `repo view failed: ${firstLine(repoView.stderr || repoView.stdout)}`,
      nextPermission: "auth-check",
      nextSkill: "github-auth-gate-skill",
      exitCode: 2,
    };
  }

  let repoJson;
  try {
    repoJson = JSON.parse(repoView.stdout);
  } catch (error) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: repo view parse failed",
      summary: `could not parse repo view JSON: ${error.message}`,
      nextPermission: "manual review",
      nextSkill: "github-auth-gate-skill",
      exitCode: 1,
    };
  }

  if (repoJson.nameWithOwner !== EXPECTED_GITHUB_REPO) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: wrong repo",
      summary: `repo view returned ${repoJson.nameWithOwner}`,
      nextPermission: "manual review",
      nextSkill: "github-auth-gate-skill",
      exitCode: 1,
    };
  }

  if (!["WRITE", "MAINTAIN", "ADMIN"].includes(repoJson.viewerPermission)) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token permission fix",
      summary: `viewerPermission is ${repoJson.viewerPermission}`,
      nextPermission: "token permission fix",
      nextSkill: "github-auth-gate-skill",
      exitCode: 2,
    };
  }
  evidence.push(`repo access: ${repoJson.nameWithOwner} ${repoJson.viewerPermission}`);

  const local = collectLocalRepoEvidence(targetRepo);
  if (!local.ok) return local.result;

  if (dryRun) {
    actions.push(`would create or switch branch ${FEATURE_BRANCH}`);
    actions.push(`would push only ${FEATURE_BRANCH}`);
    actions.push("would create PR into main, or confirm existing PR");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Auth pass for GitHub handoff",
      summary: "dry-run passed; no branch, push, or PR mutation was performed",
      nextPermission: "github-handoff",
      nextSkill: "github-handoff-skill",
      prUrl: null,
      branch: local.branch,
      exitCode: 0,
    };
  }

  const branchResult = createOrSwitchBranch();
  if (!branchResult.ok) return branchResult.result;
  actions.push(branchResult.action);

  const branchContainsCommit = run("git", ["-C", targetRepo, "merge-base", "--is-ancestor", EXPECTED_COMMIT, "HEAD"]);
  if (branchContainsCommit.code !== 0) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: feature branch missing expected commit",
      summary: `${FEATURE_BRANCH} does not contain ${EXPECTED_COMMIT}`,
      nextPermission: "manual branch repair",
      nextSkill: "github-handoff-skill",
      exitCode: 1,
    };
  }

  const setupGit = run("gh", ["auth", "setup-git", "--hostname", "github.com"], {
    env: ghEnv,
    allowFailure: true,
  });
  actions.push(`gh auth setup-git: ${setupGit.code === 0 ? "ok" : "nonfatal failure"}`);

  const push = run("git", ["-C", targetRepo, "push", "-u", "origin", FEATURE_BRANCH], {
    env: { ...ghEnv, GIT_TERMINAL_PROMPT: "0" },
  });
  if (push.code !== 0) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: feature branch push failed",
      summary: firstLine(push.stderr || push.stdout),
      nextPermission: "manual push repair",
      nextSkill: "github-handoff-skill",
      exitCode: 1,
    };
  }
  actions.push(`pushed origin/${FEATURE_BRANCH}`);

  const existingPr = viewPr(ghEnv);
  if (existingPr.ok) {
    actions.push(`confirmed existing PR ${existingPr.url}`);
    return {
      finalStatus: "PR opened, not merged",
      ledgerStatus: "PR opened, not merged",
      summary: "existing PR confirmed; no duplicate PR created",
      nextPermission: "approve PR merge",
      nextSkill: "github-handoff-skill",
      prUrl: existingPr.url,
      branch: FEATURE_BRANCH,
      exitCode: 0,
    };
  }

  writePrBody();
  const createPr = run(
    "gh",
    [
      "pr",
      "create",
      "--repo",
      EXPECTED_GITHUB_REPO,
      "--base",
      "main",
      "--head",
      FEATURE_BRANCH,
      "--title",
      PR_TITLE,
      "--body-file",
      PR_BODY_PATH,
    ],
    { env: ghEnv },
  );
  if (createPr.code !== 0) {
    const afterFailure = viewPr(ghEnv);
    if (afterFailure.ok) {
      return {
        finalStatus: "PR opened, not merged",
        ledgerStatus: "PR opened, not merged",
        summary: "PR exists after create failure; treating as confirmed",
        nextPermission: "approve PR merge",
        nextSkill: "github-handoff-skill",
        prUrl: afterFailure.url,
        branch: FEATURE_BRANCH,
        exitCode: 0,
      };
    }

    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: PR creation failed",
      summary: firstLine(createPr.stderr || createPr.stdout),
      nextPermission: "manual PR repair",
      nextSkill: "github-handoff-skill",
      exitCode: 1,
    };
  }

  const prUrl = createPr.stdout.trim();
  actions.push(`created PR ${prUrl}`);
  return {
    finalStatus: "PR opened, not merged",
    ledgerStatus: "PR opened, not merged",
    summary: "feature branch pushed and PR created",
    nextPermission: "approve PR merge",
    nextSkill: "github-handoff-skill",
    prUrl,
    branch: FEATURE_BRANCH,
    exitCode: 0,
  };
}

function runPrReadiness() {
  if (dryRun) {
    actions.push("would load <RUNTIME_ENV_FILE> without printing token values");
    actions.push("would isolate GH_TOKEN from GITHUB_TOKEN");
    actions.push(`would verify auth user ${EXPECTED_GITHUB_USER}`);
    actions.push(`would verify repo access to ${EXPECTED_GITHUB_REPO}`);
    actions.push(`would inspect PR ${PR_NUMBER} metadata, files, commits, mergeability, and review decision`);
    actions.push(`would run gh pr checks --repo ${EXPECTED_GITHUB_REPO} ${PR_NUMBER}`);
    actions.push(`would confirm intended files: ${INTENDED_PR_FILES.join(", ")}`);
    actions.push("would capture local repo branch, recent commits, and dirty state");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "PR opened, not merged",
      summary: "dry-run passed; PR readiness evidence would be collected and merge would remain blocked",
      nextPermission: "pr-readiness",
      nextSkill: "github-handoff-skill",
      exitCode: 0,
    };
  }

  const envFile = loadEnvFile(DEFAULT_ENV_FILE);
  const ghToken = envFile.GH_TOKEN || process.env.GH_TOKEN || "";
  const githubTokenPresent = Boolean(envFile.GITHUB_TOKEN || process.env.GITHUB_TOKEN);
  const ghTokenPresent = Boolean(ghToken);
  evidence.push(`GH_TOKEN presence: ${ghTokenPresent ? "set" : "not set"}`);
  evidence.push(`GITHUB_TOKEN presence: ${githubTokenPresent ? "set" : "not set"}`);

  if (!ghTokenPresent) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token replacement",
      summary: "GH_TOKEN is not set in runtime env",
      nextPermission: "auth-check",
      nextSkill: "github-auth-gate-skill",
      exitCode: 2,
    };
  }

  const ghEnv = buildGhEnv(ghToken);
  const user = run("gh", ["api", "user", "--jq", ".login"], { env: ghEnv });
  if (user.code !== 0 || user.stdout.trim() !== EXPECTED_GITHUB_USER) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token replacement",
      summary: `GH_TOKEN user check failed: ${firstLine(user.stderr || user.stdout)}`,
      nextPermission: "auth-check",
      nextSkill: "github-auth-gate-skill",
      exitCode: 2,
    };
  }
  evidence.push(`GH_TOKEN user: ${EXPECTED_GITHUB_USER}`);

  const repoAccess = verifyRepoAccess(ghEnv);
  if (!repoAccess.ok) return repoAccess.result;

  const prView = viewPrReadiness(ghEnv);
  if (!prView.ok) return prView.result;
  const pr = prView.data;
  const changedFiles = extractPrFiles(pr);
  const unexpectedFiles = changedFiles.filter((file) => !INTENDED_PR_FILES.includes(file));
  const missingFiles = INTENDED_PR_FILES.filter((file) => !changedFiles.includes(file));
  const commits = Array.isArray(pr.commits) ? pr.commits : [];

  evidence.push(`PR URL: ${pr.url || "unknown"}`);
  evidence.push(`PR state: ${pr.state || "unknown"}`);
  evidence.push(`PR base/head: ${pr.baseRefName || "unknown"}/${pr.headRefName || "unknown"}`);
  evidence.push(`PR mergeable: ${pr.mergeable || "unavailable"}`);
  evidence.push(`PR review decision: ${pr.reviewDecision || "unavailable"}`);
  evidence.push(`PR files: ${changedFiles.length ? changedFiles.join(", ") : "none"}`);
  evidence.push(`PR commits: ${summarizeCommits(commits)}`);

  const checks = inspectPrChecks(ghEnv);
  evidence.push(`PR checks: ${checks.summary}`);

  const local = collectPrLocalEvidence(targetRepo);
  if (!local.ok) return local.result;

  const readiness = classifyPrReadiness({ pr, unexpectedFiles, missingFiles, checks });
  return {
    finalStatus: readiness.status,
    ledgerStatus: readiness.status,
    summary: readiness.summary,
    nextPermission: readiness.nextPermission,
    nextSkill: "github-handoff-skill",
    prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${PR_NUMBER}`,
    branch: local.branch,
    prMetadata: pr,
    checks,
    changedFiles,
    unexpectedFiles,
    missingFiles,
    commits,
    exitCode: 0,
  };
}

function runPrMerge() {
  const workflowScan = inspectLocalWorkflowDeployTriggers(targetRepo);

  if (dryRun) {
    actions.push("would load <RUNTIME_ENV_FILE> without printing token values");
    actions.push("would isolate GH_TOKEN from GITHUB_TOKEN");
    actions.push(`would verify auth user ${EXPECTED_GITHUB_USER}`);
    actions.push(`would verify repo access to ${EXPECTED_GITHUB_REPO}`);
    actions.push(`would inspect PR ${PR_NUMBER} metadata, files, commits, and mergeability`);
    actions.push(`would run gh pr checks --repo ${EXPECTED_GITHUB_REPO} ${PR_NUMBER}`);
    actions.push("would merge with gh pr merge --merge only if all safety gates pass");
    actions.push("would not pass --delete-branch, deploy, run migrations, or call production endpoints");

    if (workflowScan.blocking) {
      return {
        finalStatus: "NEEDS JOHN: merge may trigger deployment",
        ledgerStatus: "NEEDS JOHN: merge may trigger deployment",
        summary: workflowScan.summary,
        nextPermission: "approve deployment-aware merge plan or hold",
        nextSkill: "github-handoff-skill",
        autoDeploy: workflowScan,
        exitCode: 2,
      };
    }

    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "PR ready for merge approval",
      summary: "dry-run passed; PR merge safety checks would run and no merge was performed",
      nextPermission: "pr-merge",
      nextSkill: "github-handoff-skill",
      autoDeploy: workflowScan,
      exitCode: 0,
    };
  }

  const envFile = loadEnvFile(DEFAULT_ENV_FILE);
  const ghToken = envFile.GH_TOKEN || process.env.GH_TOKEN || "";
  const githubTokenPresent = Boolean(envFile.GITHUB_TOKEN || process.env.GITHUB_TOKEN);
  const ghTokenPresent = Boolean(ghToken);
  evidence.push(`GH_TOKEN presence: ${ghTokenPresent ? "set" : "not set"}`);
  evidence.push(`GITHUB_TOKEN presence: ${githubTokenPresent ? "set" : "not set"}`);

  if (!ghTokenPresent) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token replacement",
      summary: "GH_TOKEN is not set in runtime env",
      nextPermission: "auth-check",
      nextSkill: "github-auth-gate-skill",
      autoDeploy: workflowScan,
      exitCode: 2,
    };
  }

  const ghEnv = buildGhEnv(ghToken);
  const user = run("gh", ["api", "user", "--jq", ".login"], { env: ghEnv });
  if (user.code !== 0 || user.stdout.trim() !== EXPECTED_GITHUB_USER) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token replacement",
      summary: `GH_TOKEN user check failed: ${firstLine(user.stderr || user.stdout)}`,
      nextPermission: "auth-check",
      nextSkill: "github-auth-gate-skill",
      autoDeploy: workflowScan,
      exitCode: 2,
    };
  }
  evidence.push(`GH_TOKEN user: ${EXPECTED_GITHUB_USER}`);

  const repoAccess = verifyRepoAccess(ghEnv);
  if (!repoAccess.ok) return { ...repoAccess.result, autoDeploy: workflowScan };

  if (workflowScan.blocking) {
    return {
      finalStatus: "NEEDS JOHN: merge may trigger deployment",
      ledgerStatus: "NEEDS JOHN: merge may trigger deployment",
      summary: workflowScan.summary,
      nextPermission: "approve deployment-aware merge plan or hold",
      nextSkill: "github-handoff-skill",
      autoDeploy: workflowScan,
      exitCode: 2,
    };
  }

  const prView = viewPrReadiness(ghEnv);
  if (!prView.ok) return { ...prView.result, autoDeploy: workflowScan };

  const pr = prView.data;
  const changedFiles = extractPrFiles(pr);
  const unexpectedFiles = changedFiles.filter((file) => !INTENDED_PR_FILES.includes(file));
  const missingFiles = INTENDED_PR_FILES.filter((file) => !changedFiles.includes(file));
  const commits = Array.isArray(pr.commits) ? pr.commits : [];

  evidence.push(`PR URL: ${pr.url || "unknown"}`);
  evidence.push(`PR state: ${pr.state || "unknown"}`);
  evidence.push(`PR base/head: ${pr.baseRefName || "unknown"}/${pr.headRefName || "unknown"}`);
  evidence.push(`PR mergeable: ${pr.mergeable || "unavailable"}`);
  evidence.push(`PR files: ${changedFiles.length ? changedFiles.join(", ") : "none"}`);
  evidence.push(`PR commits: ${summarizeCommits(commits)}`);

  const checks = inspectPrChecks(ghEnv);
  evidence.push(`PR checks: ${checks.summary}`);

  const safety = classifyPrMergeSafety({ pr, unexpectedFiles, missingFiles, checks });
  if (!safety.ok) {
    return {
      finalStatus: safety.status,
      ledgerStatus: safety.status,
      summary: safety.summary,
      nextPermission: safety.nextPermission,
      nextSkill: "github-handoff-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      autoDeploy: workflowScan,
      exitCode: 2,
    };
  }

  const merge = run("gh", ["pr", "merge", "--repo", EXPECTED_GITHUB_REPO, PR_NUMBER, "--merge"], {
    env: ghEnv,
  });
  if (merge.code !== 0) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: PR merge failed",
      summary: firstLine(merge.stderr || merge.stdout),
      nextPermission: "manual PR merge repair",
      nextSkill: "github-handoff-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      autoDeploy: workflowScan,
      exitCode: 1,
    };
  }
  actions.push(`merged PR ${PR_NUMBER} with --merge; remote branch was not deleted by this runner`);

  const finalView = viewPrFinal(ghEnv);
  const finalPrMetadata = finalView.ok ? finalView.data : null;
  if (finalView.ok) {
    evidence.push(`PR final state: ${finalPrMetadata.state || "unknown"}`);
    evidence.push(`PR mergedAt: ${finalPrMetadata.mergedAt || "unavailable"}`);
  } else {
    evidence.push(`PR final view unavailable: ${finalView.summary}`);
  }

  const local = collectPostMergeLocalEvidence(targetRepo);
  if (!local.ok) {
    return {
      ...local.result,
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${PR_NUMBER}`,
      prMetadata: pr,
      finalPrMetadata,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      autoDeploy: workflowScan,
    };
  }

  return {
    finalStatus: "Merged, not deployed",
    ledgerStatus: "Merged, not deployed",
    summary: "PR was merged into main; no deployment, migration, production endpoint call, branch deletion, or Supabase mutation was run",
    nextPermission: "approve deployment planning",
    nextSkill: "deployment-planning / supabase-runtime-verification planning",
    prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${PR_NUMBER}`,
    prMetadata: pr,
    finalPrMetadata,
    checks,
    changedFiles,
    unexpectedFiles,
    missingFiles,
    commits,
    autoDeploy: workflowScan,
    localState: local.data,
    exitCode: 0,
  };
}

function runSchedulerPrMerge(active = {}) {
  if (dryRun) {
    actions.push("would load <RUNTIME_ENV_FILE> without printing token values");
    actions.push("would isolate GH_TOKEN from GITHUB_TOKEN");
    actions.push(`would verify auth user ${EXPECTED_GITHUB_USER}`);
    actions.push(`would verify repo access to ${EXPECTED_GITHUB_REPO}`);
    actions.push(`would inspect scheduler PR #${SCHEDULER_PR_NUMBER} metadata, files, commits, and mergeability`);
    actions.push(`would run gh pr checks --repo ${EXPECTED_GITHUB_REPO} ${SCHEDULER_PR_NUMBER}`);
    actions.push(`would confirm scheduler PR files: ${SCHEDULER_PR_FILES.join(", ")}`);
    actions.push(`would confirm scheduler PR commits: ${SCHEDULER_PR_COMMITS.join(", ")}`);
    actions.push("would scan the scheduler migration for hardcoded secret-shaped values without printing matches");
    actions.push("would merge with gh pr merge --merge only if PR #12 is still open and all safety gates pass");
    actions.push("would not pass --delete-branch, deploy, run migrations, execute SQL, mutate schedulers, or call production endpoints");

    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Scheduler migration PR opened, not merged",
      summary: "dry-run passed; scheduler PR #12 readiness/merge gate would run and stop before any Supabase mutation",
      nextPermission: "scheduler-pr-merge",
      nextSkill: "github-handoff-skill / scheduler PR #12 readiness and merge gate",
      exitCode: 0,
    };
  }

  const activeStatus = cleanField(active.currentStatus).toLowerCase();
  const alreadyRecordedMerged = activeStatus === "scheduler migration draft merged, supabase mutation still gated";

  if (alreadyRecordedMerged) {
    actions.push("ledger already records PR #12 as merged; verifying local merge evidence and migration scan without requiring GitHub auth");

    const localMerge = verifyLocalSchedulerMergeState(targetRepo);
    if (!localMerge.ok) return localMerge.result;

    const secretScan = scanSchedulerMigrationForHardcodedSecrets(targetRepo);
    if (!secretScan.ok) {
      return {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: scheduler migration secret scan failed",
        summary: secretScan.summary,
        nextPermission: "manual scheduler migration review",
        nextSkill: "security-hardening-review-skill",
        changedFiles: localMerge.changedFiles || [],
        commits: SCHEDULER_PR_COMMITS.map((oid) => ({ oid })),
        localState: localMerge.localState,
        exitCode: 1,
      };
    }

    return {
      finalStatus: "Scheduler migration draft merged, not applied",
      ledgerStatus: "Scheduler migration draft merged, not applied",
      summary: "ledger and local main already show PR #12 merged with the expected scheduler files; migration secret scan passed; no GitHub merge or Supabase mutation was run",
      nextPermission: "approve remote secret setup and function deploy planning",
      nextSkill: "cloudflare-deploy-skill / reviewed Supabase secret setup and scheduler application plan",
      prUrl: `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      changedFiles: localMerge.changedFiles,
      unexpectedFiles: localMerge.unexpectedFiles,
      missingFiles: localMerge.missingFiles,
      commits: SCHEDULER_PR_COMMITS.map((oid) => ({ oid })),
      checks: {
        available: true,
        blocked: false,
        summary: "previous ledger evidence recorded Cloudflare Pages passing; live check was not rerun because GitHub auth is unavailable",
      },
      localState: localMerge.localState,
      exitCode: 0,
    };
  }

  const envFile = loadEnvFile(DEFAULT_ENV_FILE);
  const ghToken = envFile.GH_TOKEN || process.env.GH_TOKEN || "";
  const githubTokenPresent = Boolean(envFile.GITHUB_TOKEN || process.env.GITHUB_TOKEN);
  const ghTokenPresent = Boolean(ghToken);
  evidence.push(`GH_TOKEN presence: ${ghTokenPresent ? "set" : "not set"}`);
  evidence.push(`GITHUB_TOKEN presence: ${githubTokenPresent ? "set" : "not set"}`);

  if (!ghTokenPresent) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token replacement",
      summary: "GH_TOKEN is not set in runtime env",
      nextPermission: "auth-check",
      nextSkill: "github-auth-gate-skill",
      exitCode: 2,
    };
  }

  const ghEnv = buildGhEnv(ghToken);
  const user = run("gh", ["api", "user", "--jq", ".login"], { env: ghEnv });
  if (user.code !== 0 || user.stdout.trim() !== EXPECTED_GITHUB_USER) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John token replacement",
      summary: `GH_TOKEN user check failed: ${firstLine(user.stderr || user.stdout)}`,
      nextPermission: "auth-check",
      nextSkill: "github-auth-gate-skill",
      exitCode: 2,
    };
  }
  evidence.push(`GH_TOKEN user: ${EXPECTED_GITHUB_USER}`);

  const repoAccess = verifyRepoAccess(ghEnv);
  if (!repoAccess.ok) return repoAccess.result;

  const prView = viewSchedulerPr(ghEnv);
  if (!prView.ok) return prView.result;

  const pr = prView.data;
  const changedFiles = extractPrFiles(pr);
  const unexpectedFiles = changedFiles.filter((file) => !SCHEDULER_PR_FILES.includes(file));
  const missingFiles = SCHEDULER_PR_FILES.filter((file) => !changedFiles.includes(file));
  const commits = Array.isArray(pr.commits) ? pr.commits : [];
  const commitOids = commits.map((commit) => String(commit.oid || commit.sha || ""));
  const missingCommits = SCHEDULER_PR_COMMITS.filter((expected) =>
    !commitOids.some((oid) => oid.startsWith(expected)),
  );
  const unexpectedCommitCount = commits.length !== SCHEDULER_PR_COMMITS.length;

  evidence.push(`scheduler PR URL: ${pr.url || "unknown"}`);
  evidence.push(`scheduler PR state: ${pr.state || "unknown"}`);
  evidence.push(`scheduler PR base/head: ${pr.baseRefName || "unknown"}/${pr.headRefName || "unknown"}`);
  evidence.push(`scheduler PR mergeable: ${pr.mergeable || "unavailable"}`);
  evidence.push(`scheduler PR files: ${changedFiles.length ? changedFiles.join(", ") : "none"}`);
  evidence.push(`scheduler PR commits: ${summarizeCommits(commits)}`);

  const checks = inspectSchedulerPrChecks(ghEnv);
  evidence.push(`scheduler PR checks: ${checks.summary}`);

  const secretScan = scanSchedulerMigrationForHardcodedSecrets(targetRepo);
  if (!secretScan.ok) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: scheduler migration secret scan failed",
      summary: secretScan.summary,
      nextPermission: "manual scheduler migration review",
      nextSkill: "security-hardening-review-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      exitCode: 1,
    };
  }

  if (unexpectedFiles.length || missingFiles.length) {
    return {
      finalStatus: "PR blocked by unexpected files",
      ledgerStatus: "PR blocked by unexpected files",
      summary: `unexpected files: ${unexpectedFiles.join(", ") || "none"}; missing intended files: ${missingFiles.join(", ") || "none"}`,
      nextPermission: "approve fixing scheduler PR blockers",
      nextSkill: "github-handoff-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      exitCode: 2,
    };
  }

  if (missingCommits.length || unexpectedCommitCount) {
    return {
      finalStatus: "PR blocked by unexpected commits",
      ledgerStatus: "PR blocked by unexpected commits",
      summary: `missing commits: ${missingCommits.join(", ") || "none"}; commit count ${commits.length}, expected ${SCHEDULER_PR_COMMITS.length}`,
      nextPermission: "approve fixing scheduler PR blockers",
      nextSkill: "github-handoff-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      exitCode: 2,
    };
  }

  if (pr.state === "MERGED") {
    const finalView = viewSchedulerPrFinal(ghEnv);
    const finalPrMetadata = finalView.ok ? finalView.data : pr;
    const local = collectPostMergeLocalEvidence(targetRepo);
    if (!local.ok) {
      return {
        ...local.result,
        prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
        prMetadata: pr,
        finalPrMetadata,
        checks,
        changedFiles,
        unexpectedFiles,
        missingFiles,
        commits,
      };
    }

    actions.push("scheduler PR #12 was already merged before this runner invocation; no merge command was run");
    if (finalView.ok) {
      evidence.push(`scheduler PR final state: ${finalPrMetadata.state || "unknown"}`);
      evidence.push(`scheduler PR mergedAt: ${finalPrMetadata.mergedAt || "unavailable"}`);
    }

    return {
      finalStatus: "Scheduler migration draft merged, not applied",
      ledgerStatus: "Scheduler migration draft merged, not applied",
      summary: "PR #12 is already merged and the expected files, commits, checks, and migration secret scan were verified; no Supabase mutation was run",
      nextPermission: "approve remote secret setup and function deploy planning",
      nextSkill: "cloudflare-deploy-skill / reviewed Supabase secret setup and scheduler application plan",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      finalPrMetadata,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      localState: local.data,
      exitCode: 0,
    };
  }

  if (pr.state !== "OPEN") {
    return {
      finalStatus: "PR readiness unknown",
      ledgerStatus: "PR readiness unknown",
      summary: `scheduler PR state is ${pr.state || "unknown"}, not OPEN or MERGED`,
      nextPermission: "hold",
      nextSkill: "github-handoff-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      exitCode: 2,
    };
  }

  if (pr.baseRefName !== "main" || pr.headRefName !== SCHEDULER_BRANCH) {
    return {
      finalStatus: "PR blocked by unexpected files",
      ledgerStatus: "PR blocked by unexpected files",
      summary: `unexpected scheduler PR branch routing: base ${pr.baseRefName || "unknown"}, head ${pr.headRefName || "unknown"}`,
      nextPermission: "approve fixing scheduler PR blockers",
      nextSkill: "github-handoff-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      exitCode: 2,
    };
  }

  if (pr.mergeable !== "MERGEABLE") {
    return {
      finalStatus: "PR blocked by mergeability",
      ledgerStatus: "PR blocked by mergeability",
      summary: `scheduler PR mergeable state is ${pr.mergeable || "unavailable"}, not MERGEABLE`,
      nextPermission: "approve fixing scheduler PR blockers or hold",
      nextSkill: "github-handoff-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      exitCode: 2,
    };
  }

  if (!checks.available || checks.blocked) {
    return {
      finalStatus: checks.available ? "PR blocked by checks" : "PR readiness unknown",
      ledgerStatus: checks.available ? "PR blocked by checks" : "PR readiness unknown",
      summary: checks.summary,
      nextPermission: checks.available ? "approve fixing scheduler PR blockers" : "hold until scheduler PR checks can be verified",
      nextSkill: "github-handoff-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      exitCode: 2,
    };
  }

  const merge = run("gh", ["pr", "merge", "--repo", EXPECTED_GITHUB_REPO, SCHEDULER_PR_NUMBER, "--merge"], {
    env: ghEnv,
  });
  if (merge.code !== 0) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: scheduler PR merge failed",
      summary: firstLine(merge.stderr || merge.stdout),
      nextPermission: "manual scheduler PR merge repair",
      nextSkill: "github-handoff-skill",
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
      exitCode: 1,
    };
  }
  actions.push("merged scheduler PR #12 with --merge; remote branch was not deleted by this runner");

  const finalView = viewSchedulerPrFinal(ghEnv);
  const finalPrMetadata = finalView.ok ? finalView.data : null;
  if (finalView.ok) {
    evidence.push(`scheduler PR final state: ${finalPrMetadata.state || "unknown"}`);
    evidence.push(`scheduler PR mergedAt: ${finalPrMetadata.mergedAt || "unavailable"}`);
  } else {
    evidence.push(`scheduler PR final view unavailable: ${finalView.summary}`);
  }

  const local = collectPostMergeLocalEvidence(targetRepo);
  if (!local.ok) {
    return {
      ...local.result,
      prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
      prMetadata: pr,
      finalPrMetadata,
      checks,
      changedFiles,
      unexpectedFiles,
      missingFiles,
      commits,
    };
  }

  return {
    finalStatus: "Scheduler migration draft merged, not applied",
    ledgerStatus: "Scheduler migration draft merged, not applied",
    summary: "scheduler PR #12 was merged; no remote secret setup, deployment, migration application, SQL, scheduler mutation, or production endpoint call was run",
    nextPermission: "approve remote secret setup and function deploy planning",
    nextSkill: "cloudflare-deploy-skill / reviewed Supabase secret setup and scheduler application plan",
    prUrl: pr.url || `https://github.com/${EXPECTED_GITHUB_REPO}/pull/${SCHEDULER_PR_NUMBER}`,
    prMetadata: pr,
    finalPrMetadata,
    checks,
    changedFiles,
    unexpectedFiles,
    missingFiles,
    commits,
    localState: local.data,
    exitCode: 0,
  };
}

module.exports = {
  runGithubHandoff,
  runPrReadiness,
  runPrMerge,
  runSchedulerPrMerge,
};
