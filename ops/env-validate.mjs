#!/usr/bin/env node
import fs from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
const schema = JSON.parse(fs.readFileSync("ops/env.schema.json","utf8"));
const ajv = new Ajv({ allErrors:true, strict:false });
addFormats(ajv);
const validate = ajv.compile(schema);

const env = {};
for (const k of Object.keys(schema.properties)) env[k] = process.env[k];

const ok = validate(env);
if (!ok) {
  console.error("[env] invalid:", ajv.errorsText(validate.errors, { separator: "\n" }));
  process.exit(78); // EX_CONFIG
}
console.log("[env] OK");