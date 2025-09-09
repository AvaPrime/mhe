#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const POLICY_PATH = process.env.SAFEEXEC_POLICY || "mcp/safe-exec/policy.json";
const LOCK_PATH = process.env.POLICY_LOCK_PATH || ".policy-lock.json";
const GIT_REPO = process.env.GIT_REPO || process.cwd();
const STRICT_MODE = process.env.POLICY_STRICT_MODE === "true";

function hashPolicy(policy) {
  const normalized = JSON.stringify(policy, Object.keys(policy).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function readPolicy() {
  if (!fs.existsSync(POLICY_PATH)) {
    throw new Error(`Policy file not found: ${POLICY_PATH}`);
  }
  return JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
}

function readLock() {
  if (!fs.existsSync(LOCK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeLock(lock) {
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2));
}

function getGitCommit() {
  try {
    const result = spawn("git", ["rev-parse", "HEAD"], { 
      cwd: GIT_REPO, 
      stdio: "pipe", 
      encoding: "utf8" 
    });
    return result.stdout?.toString().trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function getGitBranch() {
  try {
    const result = spawn("git", ["branch", "--show-current"], { 
      cwd: GIT_REPO, 
      stdio: "pipe", 
      encoding: "utf8" 
    });
    return result.stdout?.toString().trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function validatePolicyDrift() {
  const policy = readPolicy();
  const currentHash = hashPolicy(policy);
  const lock = readLock();
  
  if (!lock) {
    console.log("[policy-lock] No lock file found, creating baseline...");
    const newLock = {
      hash: currentHash,
      timestamp: new Date().toISOString(),
      commit: getGitCommit(),
      branch: getGitBranch(),
      policy_path: POLICY_PATH
    };
    writeLock(newLock);
    return { status: "created", lock: newLock };
  }
  
  if (lock.hash === currentHash) {
    console.log("[policy-lock] Policy unchanged ✓");
    return { status: "unchanged", lock };
  }
  
  console.warn("[policy-lock] Policy drift detected!");
  console.warn(`  Locked hash: ${lock.hash}`);
  console.warn(`  Current hash: ${currentHash}`);
  console.warn(`  Locked at: ${lock.timestamp} (${lock.commit})`);
  
  if (STRICT_MODE) {
    console.error("[policy-lock] STRICT MODE: Blocking execution due to policy drift");
    process.exit(1);
  }
  
  return { status: "drift", lock, current_hash: currentHash };
}

function updateLock() {
  const policy = readPolicy();
  const currentHash = hashPolicy(policy);
  const newLock = {
    hash: currentHash,
    timestamp: new Date().toISOString(),
    commit: getGitCommit(),
    branch: getGitBranch(),
    policy_path: POLICY_PATH
  };
  writeLock(newLock);
  console.log("[policy-lock] Lock updated");
  return newLock;
}

function showStatus() {
  const policy = readPolicy();
  const currentHash = hashPolicy(policy);
  const lock = readLock();
  
  console.log("Policy Lock Status:");
  console.log(`  Policy: ${POLICY_PATH}`);
  console.log(`  Current hash: ${currentHash}`);
  
  if (lock) {
    console.log(`  Locked hash: ${lock.hash}`);
    console.log(`  Locked at: ${lock.timestamp}`);
    console.log(`  Git commit: ${lock.commit}`);
    console.log(`  Git branch: ${lock.branch}`);
    console.log(`  Status: ${lock.hash === currentHash ? "✓ CLEAN" : "⚠ DRIFT"}`);
  } else {
    console.log(`  Status: ⚠ NO LOCK`);
  }
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case "validate":
    validatePolicyDrift();
    break;
  case "update":
    updateLock();
    break;
  case "status":
    showStatus();
    break;
  default:
    console.log("Usage: policy-lock.mjs [validate|update|status]");
    console.log("  validate - Check for policy drift (exit 1 if STRICT_MODE and drift detected)");
    console.log("  update   - Update lock file with current policy hash");
    console.log("  status   - Show current policy lock status");
    process.exit(1);
}