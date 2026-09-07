# Contributing

This repository is a read-only mirror.

The plugin is developed in the Titan monorepo at
`apps/titan-connect/claude-code-plugin/`. Every file here, apart from this one,
`README.md` and `.github/`, is copied from there byte for byte and is
overwritten on the next sync. A change made directly here is lost.

To change the plugin or the skill, open a pull request against the monorepo. The
identifier-parity gate there (`scripts/check-identifier-parity.test.mjs`) pins
the plugin key, the `mcpServers` key, the hostname and the skill name across
every file that carries them, so a partial rename fails CI rather than shipping.

To report a problem without monorepo access, open an issue here.
