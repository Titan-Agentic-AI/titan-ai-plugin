# Titan AI MCP plugin

Amazon seller tools for AI agents, from Titan Network. Your PPC data, listings,
alerts, and the Titan knowledge base, available in Claude.ai, Claude Code and
Claude Cowork.

Requires a Titan Tools account. Sign-in happens in your browser on first
connect, over OAuth. There is no API key to copy or paste.

## Install

```
/plugin marketplace add Titan-Agentic-AI/titan-ai-plugin
/plugin install titan-ai@titan-network
```

On Claude.ai, go to Customize, then Plugins, then Add marketplace, and point it
at this repository.

In Cowork, install it from the plugin library.

Or, for Claude Code, use the one-command installer, which does the same thing
and signs you in:

```
curl -fsSL https://titanconnect.titannetwork.com/api/install-claude | bash
```

## Using another MCP client

If your client does not take plugins, connect the Titan AI MCP server directly
and add the skill separately. The
[setup guides](https://ai.titannetwork.com/docs/connect-a-client) cover both
steps per client.

## What you get

A connection to the Titan AI MCP server at
`titanconnect.titannetwork.com/api/mcp`, plus the `titan-ai` skill that teaches
Claude how to use it: which tool answers which question, the wire formats for
every write, and the rule that answers are grounded in Titan Network material
rather than general knowledge.

Ask things like "how are my campaigns doing", "show my top-selling ASINs", or
"optimize my PPC spend".

## These tools spend real money

Some tools change a live Amazon Ads account. Claude Code prompts you before each
one. Nothing rolls back automatically, so read each proposal, and keep the Titan
action tools out of any always-allow list.

## Licence

MIT, see [LICENSE](LICENSE).

The licence covers this repository's contents. It does not grant any right to
the Titan Network or Titan AI names, logos, or other trademarks.

## About Titan AI

Titan AI is the agentic platform Amazon sellers run their business on: seller
data, PPC analytics and campaign actions, a knowledge base built from what has
actually worked for Titan Network members, and agents that act on all of it.
Most of that work happens in Titan AI itself, at
[ai.titannetwork.com](https://ai.titannetwork.com).

This plugin is one way in. It brings the same tools and the same judgement into
Claude's ecosystem, so you can stay in Claude Code or Cowork and still work
against your live account.

The plugin is published from Titan AI's own systems, so it tracks the platform
and does not take changes here. To request one, or to report a problem, open an
issue.

## Docs

* [Start here](https://ai.titannetwork.com/docs/overview)
* [Claude Code setup](https://ai.titannetwork.com/docs/claude-code)
* [Cowork setup](https://ai.titannetwork.com/docs/cowork)
* [Other MCP clients](https://ai.titannetwork.com/docs/connect-a-client)
