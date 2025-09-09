#!/usr/bin/env node
import fs from "node:fs";
const fail = (m)=>{ console.error(m); process.exit(1); };
const ok = (m)=>{ console.log(m); };

const dcVersionFile = "mcp/docs/desktop-commander/.dc-version";
const mcpCfg = ".trae/mcp.json";

const dcV = fs.existsSync(dcVersionFile) ? fs.readFileSync(dcVersionFile,"utf8").trim() : null;
if (!dcV) fail("[version-sync] missing .dc-version");

const cfg = JSON.parse(fs.readFileSync(mcpCfg,"utf8"));
const dc = cfg.mcpServers?.find(s => s.name.includes("desktop-commander"));
const npxArg = dc?.command?.find((x)=> String(x).startsWith("@wonderwhy-er/desktop-commander@"));
if (!npxArg) fail("[version-sync] npx pin not found in .trae/mcp.json");
const npxV = npxArg.split("@").pop();
if (npxV !== dcV) fail(`[version-sync] mismatch: .dc-version=${dcV} vs .trae=${npxV}`);
ok(`[version-sync] OK: Desktop Commander ${dcV}`);