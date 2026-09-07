#!/usr/bin/env node
/**
 * Structural gate for the mirror.
 *
 * This repository is a copy, so the interesting failure is not "is the JSON
 * well formed" but "did the copy drift from the identifiers members have
 * persisted". A member who ran `/plugin install titan-ai@titan-network` has
 * that string saved in their own Claude Code config, outside this repo, and a
 * rename here does not relabel their install: it breaks it, silently.
 *
 * The monorepo pins the same identifiers in
 * scripts/check-identifier-parity.test.mjs. This is the mirror-side half, so a
 * hand-edit here fails before anyone installs it.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PLUGIN_KEY = 'titan-ai';
const MARKETPLACE_KEY = 'titan-network';
const MCP_SERVER_KEY = 'titan-ai';
const HOSTNAME = 'titanconnect.titannetwork.com';
const SKILL_NAME = 'titan-ai';

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const read = (p) => {
  const full = join(ROOT, p);
  if (!existsSync(full)) {
    failures.push(`missing required file: ${p}`);
    return null;
  }
  return readFileSync(full, 'utf8');
};

const pluginRaw = read('.claude-plugin/plugin.json');
const marketRaw = read('.claude-plugin/marketplace.json');
const mcpRaw = read('.mcp.json');
const skillRaw = read(`skills/${SKILL_NAME}/SKILL.md`);
for (const f of ['ACTIONS.md', 'WIRE_FORMATS.md', 'WORKFLOWS.md']) {
  read(`skills/${SKILL_NAME}/${f}`);
}

if (pluginRaw) {
  const plugin = JSON.parse(pluginRaw);
  check(plugin.name === PLUGIN_KEY, `plugin.json name is "${plugin.name}", expected "${PLUGIN_KEY}"`);
  check(typeof plugin.version === 'string', 'plugin.json has no version string');
}

if (marketRaw && pluginRaw) {
  const market = JSON.parse(marketRaw);
  const plugin = JSON.parse(pluginRaw);
  check(market.name === MARKETPLACE_KEY, `marketplace.json name is "${market.name}", expected "${MARKETPLACE_KEY}"`);
  const entry = (market.plugins ?? [])[0];
  check(entry?.name === PLUGIN_KEY, `marketplace plugin entry is "${entry?.name}", expected "${PLUGIN_KEY}"`);
  // The install string members hold is plugin@marketplace; both halves live here.
  check(
    entry?.version === plugin.version,
    `marketplace entry version "${entry?.version}" disagrees with plugin.json "${plugin.version}"`,
  );
}

if (mcpRaw) {
  const mcp = JSON.parse(mcpRaw);
  check(
    Object.prototype.hasOwnProperty.call(mcp.mcpServers ?? {}, MCP_SERVER_KEY),
    `.mcp.json has no mcpServers["${MCP_SERVER_KEY}"] entry`,
  );
  check(mcpRaw.includes(HOSTNAME), `.mcp.json no longer points at ${HOSTNAME}`);
}

if (skillRaw) {
  // The frontmatter name, not the folder, is what Claude keys an installed
  // skill on. They must agree.
  check(
    new RegExp(`^name:\\s*${SKILL_NAME}\\s*$`, 'm').test(skillRaw),
    `SKILL.md frontmatter name is not "${SKILL_NAME}"`,
  );
  check(
    new RegExp(`^allowed-tools:\\s*mcp__${MCP_SERVER_KEY}__\\*\\s*$`, 'm').test(skillRaw),
    `SKILL.md allowed-tools glob does not match the mcpServers key "${MCP_SERVER_KEY}"`,
  );
}

if (failures.length) {
  console.error('Mirror validation FAILED:\n');
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    '\nThis repository is a mirror of apps/titan-connect/claude-code-plugin in the\n' +
      'Titan monorepo. Fix it there and re-sync; do not hand-edit this copy.',
  );
  process.exit(1);
}
console.log('Mirror validation passed: identifiers intact, all required files present.');
