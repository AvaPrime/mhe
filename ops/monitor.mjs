#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LEVEL = (process.env.MON_LEVEL || "warn").toLowerCase(); // info|warn|error
const SAFEEXEC_LOG = process.env.SAFEEXEC_LOG || path.join(process.cwd(), ".logs", "safeexec.log.jsonl");
const DC_SERVICE = process.env.DC_SERVICE || "desktop-commander";
const DC_COMPOSE = process.env.DC_COMPOSE || "docker/desktop-commander/docker-compose.yml";

const severities = { info: 0, warn: 1, error: 2, reject: 2, exit: 1, fatal: 2 };
const need = (lvl) => (sev) => (severities[sev] ?? 0) >= (["info","warn","error"].indexOf(lvl));

function watchSafeExec() {
  if (!fs.existsSync(SAFEEXEC_LOG)) return console.log("[monitor] SafeExec log not found:", SAFEEXEC_LOG);
  console.log("[monitor] Watching SafeExec:", SAFEEXEC_LOG);
  let pos = 0;
  const printIf = need(LEVEL);
  fs.watch(SAFEEXEC_LOG, { persistent: true }, () => {
    const s = fs.statSync(SAFEEXEC_LOG);
    if (s.size <= pos) return;
    const rs = fs.createReadStream(SAFEEXEC_LOG, { start: pos, end: s.size, encoding: "utf8" });
    let buf = "";
    rs.on("data", (ch)=> buf += ch);
    rs.on("end", ()=>{
      pos = s.size;
      for (const line of buf.split("\n").filter(Boolean)) {
        try {
          const ev = JSON.parse(line);
          const sev = ev.kind === "reject" ? "reject" : ev.kind === "exit" && ev.code ? "warn" : "info";
          if (printIf(sev)) console.log(`[safeexec:${sev}]`, ev.kind, ev.cmd||"", (ev.args||[]).join(" "), ev.code??"");
        } catch {}
      }
    });
  });
}

function watchDesktopCommander() {
  console.log("[monitor] Tailing Desktop Commander (compose):", DC_COMPOSE, DC_SERVICE);
  const p = spawn("docker", ["compose","-f",DC_COMPOSE,"logs","-f",DC_SERVICE], { stdio: "inherit" });
  p.on("exit", (c)=> console.log("[monitor] docker logs exited:", c));
}

watchSafeExec();
watchDesktopCommander();