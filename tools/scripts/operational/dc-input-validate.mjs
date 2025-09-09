#!/usr/bin/env node
/**
 * Desktop Commander Input Validation Script
 * Validates and sanitizes inputs for Desktop Commander integration
 * Part of the SafeExec ↔ Desktop Commander Unification Pack v2
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Validation schemas for Desktop Commander inputs
const DC_INPUT_SCHEMAS = {
  version: {
    pattern: /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/,
    description: "Semantic version (e.g., 1.2.3 or 1.2.3-beta.1)"
  },
  
  command: {
    pattern: /^[a-zA-Z0-9._-]+$/,
    maxLength: 100,
    description: "Alphanumeric command name with dots, underscores, hyphens"
  },
  
  argument: {
    pattern: /^[^;|&`$(){}\[\]<>"'\\]+$/,
    maxLength: 500,
    description: "Safe argument without shell metacharacters"
  },
  
  path: {
    validator: (value) => {
      // Normalize path and check if it's within project bounds
      const normalized = path.resolve(PROJECT_ROOT, value);
      return normalized.startsWith(PROJECT_ROOT) && !normalized.includes("..");
    },
    description: "Path within project boundaries"
  },
  
  role: {
    enum: ["admin", "builder", "guest", "test"],
    description: "Valid SafeExec role"
  },
  
  logLevel: {
    enum: ["error", "warn", "info", "debug"],
    description: "Valid log level"
  }
};

// Dangerous patterns that should always be rejected
const DANGEROUS_PATTERNS = [
  /[;&|`$(){}\[\]<>]/,  // Shell metacharacters
  /\.\.[\/\\]/,        // Directory traversal
  /^-/,                 // Leading dashes (potential flags)
  /\x00/,               // Null bytes
  /[\r\n]/,             // Line breaks
  /\\x[0-9a-fA-F]{2}/,  // Hex escapes
  /\\[0-7]{3}/,         // Octal escapes
];

class DCInputValidator {
  constructor(options = {}) {
    this.strict = options.strict || process.env.DC_VALIDATION_STRICT === "true";
    this.logLevel = options.logLevel || "info";
    this.errors = [];
    this.warnings = [];
  }

  log(level, message, data = null) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    if (levels[level] <= levels[this.logLevel]) {
      const timestamp = new Date().toISOString();
      const logData = data ? ` ${JSON.stringify(data)}` : "";
      console.log(`[${timestamp}] DC-VALIDATE ${level.toUpperCase()}: ${message}${logData}`);
    }
  }

  validateInput(value, schema, fieldName = "input") {
    if (value === null || value === undefined) {
      this.errors.push(`${fieldName}: Value is required`);
      return false;
    }

    const stringValue = String(value).trim();
    
    // Check for dangerous patterns first
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(stringValue)) {
        this.errors.push(`${fieldName}: Contains dangerous pattern: ${pattern}`);
        return false;
      }
    }

    // Apply schema validation
    if (schema.pattern && !schema.pattern.test(stringValue)) {
      this.errors.push(`${fieldName}: Does not match pattern. Expected: ${schema.description}`);
      return false;
    }

    if (schema.maxLength && stringValue.length > schema.maxLength) {
      this.errors.push(`${fieldName}: Exceeds maximum length of ${schema.maxLength}`);
      return false;
    }

    if (schema.enum && !schema.enum.includes(stringValue)) {
      this.errors.push(`${fieldName}: Must be one of: ${schema.enum.join(", ")}`);
      return false;
    }

    if (schema.validator && !schema.validator(stringValue)) {
      this.errors.push(`${fieldName}: Custom validation failed. Expected: ${schema.description}`);
      return false;
    }

    return true;
  }

  validateDesktopCommanderConfig(config) {
    this.log("info", "Validating Desktop Commander configuration");
    
    if (!config || typeof config !== "object") {
      this.errors.push("Configuration must be an object");
      return false;
    }

    let isValid = true;

    // Validate version if present
    if (config.version) {
      isValid &= this.validateInput(config.version, DC_INPUT_SCHEMAS.version, "version");
    }

    // Validate commands array
    if (config.commands && Array.isArray(config.commands)) {
      config.commands.forEach((cmd, index) => {
        if (cmd.name) {
          isValid &= this.validateInput(cmd.name, DC_INPUT_SCHEMAS.command, `commands[${index}].name`);
        }
        
        if (cmd.args && Array.isArray(cmd.args)) {
          cmd.args.forEach((arg, argIndex) => {
            isValid &= this.validateInput(arg, DC_INPUT_SCHEMAS.argument, `commands[${index}].args[${argIndex}]`);
          });
        }
        
        if (cmd.workdir) {
          isValid &= this.validateInput(cmd.workdir, DC_INPUT_SCHEMAS.path, `commands[${index}].workdir`);
        }
      });
    }

    // Validate role if present
    if (config.role) {
      isValid &= this.validateInput(config.role, DC_INPUT_SCHEMAS.role, "role");
    }

    // Validate log level if present
    if (config.logLevel) {
      isValid &= this.validateInput(config.logLevel, DC_INPUT_SCHEMAS.logLevel, "logLevel");
    }

    return isValid;
  }

  sanitizeInput(value, schema) {
    if (!value) return value;
    
    let sanitized = String(value).trim();
    
    // Remove null bytes
    sanitized = sanitized.replace(/\x00/g, "");
    
    // Remove line breaks
    sanitized = sanitized.replace(/[\r\n]/g, " ");
    
    // Truncate if too long
    if (schema.maxLength && sanitized.length > schema.maxLength) {
      sanitized = sanitized.substring(0, schema.maxLength);
      this.warnings.push(`Input truncated to ${schema.maxLength} characters`);
    }
    
    return sanitized;
  }

  validateAndSanitize(input, schemaName) {
    const schema = DC_INPUT_SCHEMAS[schemaName];
    if (!schema) {
      this.errors.push(`Unknown schema: ${schemaName}`);
      return null;
    }

    const sanitized = this.sanitizeInput(input, schema);
    const isValid = this.validateInput(sanitized, schema, schemaName);
    
    return isValid ? sanitized : null;
  }

  getResults() {
    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      hasWarnings: this.warnings.length > 0
    };
  }

  reset() {
    this.errors = [];
    this.warnings = [];
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  
  const validator = new DCInputValidator({
    strict: args.includes("--strict"),
    logLevel: args.includes("--verbose") ? "debug" : "info"
  });

  switch (command) {
    case "validate": {
      const configPath = args[1] || ".trae/mcp.json";
      const fullPath = path.resolve(PROJECT_ROOT, configPath);
      
      if (!fs.existsSync(fullPath)) {
        validator.log("error", `Configuration file not found: ${fullPath}`);
        process.exit(1);
      }
      
      try {
        const config = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        const isValid = validator.validateDesktopCommanderConfig(config);
        const results = validator.getResults();
        
        if (results.hasWarnings) {
          results.warnings.forEach(warning => validator.log("warn", warning));
        }
        
        if (!isValid) {
          results.errors.forEach(error => validator.log("error", error));
          validator.log("error", "Desktop Commander configuration validation failed");
          process.exit(1);
        }
        
        validator.log("info", "Desktop Commander configuration is valid");
        break;
      } catch (error) {
        validator.log("error", "Failed to parse configuration file", { error: error.message });
        process.exit(1);
      }
    }
    
    case "sanitize": {
      const input = args[1];
      const schemaName = args[2] || "argument";
      
      if (!input) {
        validator.log("error", "Input value required for sanitization");
        process.exit(1);
      }
      
      const sanitized = validator.validateAndSanitize(input, schemaName);
      const results = validator.getResults();
      
      if (sanitized === null) {
        results.errors.forEach(error => validator.log("error", error));
        process.exit(1);
      }
      
      console.log(sanitized);
      if (results.hasWarnings) {
        results.warnings.forEach(warning => validator.log("warn", warning));
      }
      break;
    }
    
    case "test": {
      validator.log("info", "Running Desktop Commander input validation tests");
      
      const testCases = [
        { input: "1.2.3", schema: "version", shouldPass: true },
        { input: "1.2.3-beta.1", schema: "version", shouldPass: true },
        { input: "invalid-version", schema: "version", shouldPass: false },
        { input: "echo", schema: "command", shouldPass: true },
        { input: "echo; rm -rf /", schema: "command", shouldPass: false },
        { input: "hello world", schema: "argument", shouldPass: true },
        { input: "hello && rm -rf /", schema: "argument", shouldPass: false },
        { input: "builder", schema: "role", shouldPass: true },
        { input: "hacker", schema: "role", shouldPass: false }
      ];
      
      let passed = 0;
      let failed = 0;
      
      for (const testCase of testCases) {
        validator.reset();
        const result = validator.validateAndSanitize(testCase.input, testCase.schema);
        const isValid = result !== null;
        
        if (isValid === testCase.shouldPass) {
          validator.log("debug", `✓ Test passed: ${testCase.input} (${testCase.schema})`);
          passed++;
        } else {
          validator.log("error", `✗ Test failed: ${testCase.input} (${testCase.schema}) - Expected ${testCase.shouldPass ? 'valid' : 'invalid'}`);
          failed++;
        }
      }
      
      validator.log("info", `Tests completed: ${passed} passed, ${failed} failed`);
      process.exit(failed > 0 ? 1 : 0);
    }
    
    case "help":
    default: {
      console.log(`
Desktop Commander Input Validation Script

Usage:
  node dc-input-validate.mjs <command> [options]

Commands:
  validate [config-path]  Validate Desktop Commander configuration (default: .trae/mcp.json)
  sanitize <input> [schema]  Sanitize and validate input string
  test                    Run validation test suite
  help                    Show this help message

Options:
  --strict               Enable strict validation mode
  --verbose              Enable verbose logging

Schemas:
  version, command, argument, path, role, logLevel

Examples:
  node dc-input-validate.mjs validate
  node dc-input-validate.mjs validate .trae/mcp.json --strict
  node dc-input-validate.mjs sanitize "echo hello" command
  node dc-input-validate.mjs test --verbose
`);
      break;
    }
  }
}

// Export for use as module
export { DCInputValidator, DC_INPUT_SCHEMAS, DANGEROUS_PATTERNS };

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("DC Input Validation failed:", error);
    process.exit(1);
  });
}