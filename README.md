# Titan AI MCP for Claude Code

Amazon seller tools for AI agents, from Titan Network. Your PPC data, listings,
alerts, and the Titan knowledge base, available in Claude Code.

Requires a Titan Tools account. Sign-in happens in your browser on first
connect, over OAuth. There is no API key to copy or paste.

## Install

```
/plugin marketplace add Titan-Agentic-AI/titan-ai-plugin
/plugin install titan-ai@titan-network
```

Or use the one-command installer, which does the same thing and signs you in:

```
curl -fsSL https://titanconnect.titannetwork.com/api/install-claude | bash
```

## What you get

A connection to the Titan AI MCP server at
`titanconnect.titannetwork.com/api/mcp`, plus the `titan-ai` skill that teaches
Claude how to use it: which tool answers which question, the wire formats for
every write, and the rule that answers are grounded in Titan Network material
rather than general knowledge.

Ask things like "how are my campaigns doing", "show my top-selling ASINs", or
"optimize my PPC spend".

## Renamed from titan-connect

This plugin was called `titan-connect` until September 2026. If you installed it
before then, `/plugin install titan-connect@titan-network` no longer resolves
and the old install stops loading. Reinstall with the commands above.

The server URL has not changed, but Claude Code treats `titan-ai` as a new
server, so you sign in again on first use.

## These tools spend real money

Some tools change a live Amazon Ads account. Claude Code prompts you before each
one. Nothing rolls back automatically, so read each proposal, and keep the Titan
action tools out of any always-allow list.

## Licence

MIT, see [LICENSE](LICENSE).

The licence covers this repository's contents. It does not grant any right to
the Titan Network or Titan AI names, logos, or other trademarks.

## Source of truth

This repository is a mirror. The plugin is developed in the Titan monorepo at
`apps/titan-connect/claude-code-plugin/`, and every file here is copied from
there byte for byte. Send changes to the monorepo, not to this repository.

Documentation for members lives at
[titannetwork.com docs](https://titanconnect.titannetwork.com/docs/claude-code).
