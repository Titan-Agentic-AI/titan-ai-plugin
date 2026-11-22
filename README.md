# Titan AI plugin for Claude

Amazon seller tools from Titan Network. The plugin connects Claude to Titan AI's
MCP server and adds the `titan-ai` skill, which teaches Claude which tool
answers which question, the exact shape of every write, and how to report a
result. It works in Claude.ai, Claude Code and Cowork.

## Who it is for

Titan Network members with an Amazon seller account linked to Titan Tools. The
first time Claude connects, you sign in with your Titan account in the browser,
over OAuth. There is no API key to copy, and no Amazon password or credential is
ever entered into Claude. Without a linked Amazon account the connection signs
in but returns no seller data.

## Install

On Claude.ai, go to Customize, then Plugins, then Add marketplace, and point it
at `Titan-Agentic-AI/titan-ai-plugin`.

In Claude Code:

```
/plugin marketplace add Titan-Agentic-AI/titan-ai-plugin
/plugin install titan-ai@titan-network
```

In Cowork, install it from the plugin library.

## What you can ask

- "How are my campaigns doing this month?"
- "Show my top-selling ASINs and their current inventory."
- "Which search terms should I add as negatives?"
- "What does the Titan Network playbook say about launching a product with PPC?"

## What the plugin contains, and where your data goes

- One remote MCP server, `https://titanconnect.titannetwork.com/api/mcp`,
  operated by Titan Network. It is the only network destination the plugin
  declares.
- One skill, `skills/titan-ai/`, written in Markdown.

No hook, command, agent, script or local server in this plugin runs on your
machine.

When Claude calls a Titan AI tool, the call and its arguments go to that
server. The server reads your Amazon seller data and Titan Tools records for the
accounts you linked, and returns the result to Claude. We do not receive your
full conversation, but tool arguments can include text Claude takes from your
messages. The server keeps a record of each tool call, including its arguments
and a hash of the result.

The [Privacy Policy](https://titanconnect.titannetwork.com/privacy) explains what
we collect, how long we keep it, who we share it with, and how to end a
connection.

## Tools that make changes

Some tools make live changes:

- Amazon Ads: campaigns, ad groups, keywords, negatives, targets, portfolios,
  bids, budgets and placement modifiers.
- Amazon listings: listing content and price.
- Titan Tools records: tracked keywords, tags and comments, relevancy datasets,
  alerts, supplier records and product costs.

A change applies when the tool is called, and some changes cannot be undone.
Setting a product's costs, for example, replaces the cost history you supply for
that product.

Titan AI's MCP server cannot ask you anything during a call. Whether Claude asks
you before a write depends on the app and your tool permission settings. The
skill tells Claude to use a write tool only when you authorize the specific
change, and to say what it will change before it calls the tool. Read each
proposed change, and keep the write tools out of any always-allow list.

## Support

Email support@titannetwork.com. Documentation is at
[titanconnect.titannetwork.com/docs](https://titanconnect.titannetwork.com/docs).
To report a problem with the plugin itself, open an issue in this repository.

This repository is published from Titan AI's own systems and does not take pull
requests. See [CONTRIBUTING](CONTRIBUTING.md).

## Licence

MIT, see [LICENSE](LICENSE).

The licence covers this repository's contents. It does not grant any right to
the Titan Network or Titan AI names, logos, or other trademarks.
