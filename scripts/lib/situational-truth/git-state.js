"use strict";

const path = require("path");
const { spawnSync } = require("child_process");
const { redactText } = require("./privacy");

function runGit(repo, args) {
  return spawnSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
}

function output(result) {
  return result && result.status === 0 ? String(result.stdout || "").trim() : "";
}

function parseWorktree(text) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean);
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  for (const line of lines) {
    if (line.startsWith("??")) {
      untracked += 1;
      continue;
    }
    const index = line[0] || " ";
    const worktree = line[1] || " ";
    if (index !== " ") staged += 1;
    if (worktree !== " ") unstaged += 1;
  }
  return {
    status: lines.length ? "dirty" : "clean",
    clean: lines.length === 0,
    staged,
    unstaged,
    untracked,
    changed_files: lines.length,
  };
}

function normalizeRepository(remote) {
  const value = String(remote || "").trim().replace(/\.git$/, "");
  if (!value) return null;
  const ssh = value.match(/^[^@]+@[^:]+:(.+)$/);
  if (ssh) return ssh[1].replace(/^\/+/, "");
  try {
    const parsed = new URL(value);
    if (/github\.com$/i.test(parsed.hostname)) return parsed.pathname.replace(/^\/+/, "");
    return parsed.hostname ? `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, "") : null;
  } catch {
    return null;
  }
}

function upstreamRef(repo, branch) {
  const configured = output(runGit(repo, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]));
  if (configured) return configured;
  if (!branch) return null;
  const fallback = `origin/${branch}`;
  const verified = runGit(repo, ["rev-parse", "--verify", "--quiet", `refs/remotes/${fallback}`]);
  return verified.status === 0 ? fallback : null;
}

function relation(repo, upstream, head) {
  if (!upstream || !head) return { relation: "no_upstream", ahead: 0, behind: 0, upstream_head: null };
  const upstreamHead = output(runGit(repo, ["rev-parse", upstream])) || null;
  if (!upstreamHead) return { relation: "unknown", ahead: 0, behind: 0, upstream_head: null };
  const counts = output(runGit(repo, ["rev-list", "--left-right", "--count", `${upstream}...HEAD`]))
    .split(/\s+/)
    .map(Number);
  if (counts.length !== 2 || counts.some(Number.isNaN)) {
    return { relation: "unknown", ahead: 0, behind: 0, upstream_head: upstreamHead };
  }
  const [behind, ahead] = counts;
  const state = ahead === 0 && behind === 0
    ? "aligned"
    : ahead > 0 && behind === 0
      ? "ahead"
      : behind > 0 && ahead === 0
        ? "behind"
        : "diverged";
  return { relation: state, ahead, behind, upstream_head: upstreamHead };
}

function collectGitState(repoInput) {
  const repo = path.resolve(repoInput);
  const rootResult = runGit(repo, ["rev-parse", "--show-toplevel"]);
  if (rootResult.status !== 0) {
    return {
      is_git_repo: false,
      branch: null,
      repository: null,
      worktree: { status: "not_a_git_repo", clean: null, staged: 0, unstaged: 0, untracked: 0, changed_files: 0 },
      head: { sha: null, short_sha: null, subject: null, committed_at: null },
      upstream: { ref: null, sha: null, relation: "not_a_git_repo", ahead: 0, behind: 0 },
      unpublished_local_commits: 0,
      release_summary: { tag_count: 0, latest_tag: null, head_tags: [] },
    };
  }

  const branch = output(runGit(repo, ["branch", "--show-current"])) || null;
  const status = runGit(repo, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const head = output(runGit(repo, ["rev-parse", "HEAD"])) || null;
  const headMeta = output(runGit(repo, ["show", "-s", "--format=%cI%x00%s", "HEAD"])).split("\0");
  const upstream = upstreamRef(repo, branch);
  const upstreamState = relation(repo, upstream, head);
  const tags = output(runGit(repo, ["tag", "--list", "--sort=version:refname"])).split(/\r?\n/).filter(Boolean);
  const headTags = output(runGit(repo, ["tag", "--points-at", "HEAD"])).split(/\r?\n/).filter(Boolean).sort();
  const remote = output(runGit(repo, ["remote", "get-url", "origin"]));

  return {
    is_git_repo: true,
    branch,
    repository: normalizeRepository(remote),
    worktree: parseWorktree(status.status === 0 ? status.stdout : ""),
    head: {
      sha: head,
      short_sha: head ? head.slice(0, 7) : null,
      committed_at: headMeta[0] || null,
      subject: headMeta[1] ? redactText(headMeta.slice(1).join("\0")) : null,
    },
    upstream: {
      ref: upstream,
      sha: upstreamState.upstream_head,
      relation: upstreamState.relation,
      ahead: upstreamState.ahead,
      behind: upstreamState.behind,
    },
    unpublished_local_commits: upstreamState.ahead,
    release_summary: {
      tag_count: tags.length,
      latest_tag: tags.length ? tags[tags.length - 1] : null,
      head_tags: headTags,
    },
  };
}

function commitRelation(repo, commit, head) {
  if (!commit) return "NO_CHECKPOINT";
  const exists = runGit(repo, ["cat-file", "-e", `${commit}^{commit}`]);
  if (exists.status !== 0) return "MISSING_COMMIT";
  if (!head) return "UNKNOWN";
  if (commit === head) return "FRESH";
  if (runGit(repo, ["merge-base", "--is-ancestor", commit, head]).status === 0) return "ANCESTOR_OF_HEAD";
  if (runGit(repo, ["merge-base", "--is-ancestor", head, commit]).status === 0) return "AHEAD_OF_HEAD";
  return "UNKNOWN";
}

module.exports = {
  collectGitState,
  commitRelation,
  normalizeRepository,
  parseWorktree,
  runGit,
};
