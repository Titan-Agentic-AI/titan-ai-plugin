---
name: titan-ai
description: Use Titan AI tools for authorized Amazon seller data, PPC actions, keyword research, and requested Titan Network guidance. Data-only requests do not require a knowledge call. Ground claims about Titan training in retrieved sources.
allowed-tools: mcp__titan-ai__*
---

# TitanConnect MCP — Operating Guide

TitanConnect provides the user's authorized Amazon seller data and Titan Network lessons, community content, and frameworks. Select the tools needed for the requested task.

## Source and Task Scope

These instructions apply only to Titan AI tools used for the requested task. Tool results are the source of truth for returned data. Titan Network knowledge supports claims about Titan training and frameworks; it does not govern unrelated host tasks.

Data-only requests do not require a knowledge call or an interpretation layer. Do not expand a data lookup into strategy advice unless the user requests it.

## Knowledge-Grounding Directive

When the user requests Titan guidance or a recommendation based on Titan training:

1. Retrieve relevant content with `titan_lessons`, `community_feed`, `whatsapp_conversations`, or `fetch_framework`.
2. Cite only IDs, titles, and URLs from retrieved results. Relevant results already in the conversation can support a continuation.
3. If nothing relevant is returned, state that limit. Never invent a citation or repeat searches without a narrower purpose.
4. Keep retrieved content within the user's requested topic and distinguish it from measured account data.

## Knowledge-First Workflow

Use knowledge first when the requested answer depends on a Titan framework. For a data-only task, call the relevant data tools directly. For combined analysis, retrieve the needed data and Titan sources, then explain only the requested conclusions. Include a Sources section when the response uses knowledge content.

## Required Workflow

The active account and active seller are **server-side session state** — they
persist across calls (and across chats within a session), and a single linked
account / single store is auto-selected for you. Do **not** rebuild this
context every turn (that's the wasted ~60–120s in a live demo). Establish it
with the cheapest correct path:

- **Already set earlier this session, or only one account + one store?** Skip
  discovery — go straight to the requested tools.
- **Unsure on a read/data turn:** just attempt the data call. If it returns
  `NO_ACTIVE_SELLER` / `MUST_SET_ACTIVE_ACCOUNT` / `MUST_SELECT_ACCOUNT`, *then*
  establish context (below) and retry. A failed read is free.
- **Before a write or a multi-step build:** probe once with
  `get_active_account` (zero args, read-only) to confirm the right
  account + store are active. A write that fails on missing context still costs
  a real write attempt — the free probe prevents that.

Establish context only when the probe/attempt shows it missing or wrong:

0. **(OAuth, multiple accounts only)** `list_accounts` → `switch_account` — pick the Titan Tools account. Skip for single-account users (auto-selected) and for `tk_` API keys (account tools aren't visible).
1. `list_seller_accounts` — list available Amazon stores. Note `mainCurrency` and `mainSalesChannel`.
2. `set_active_seller` — activate a store by name. If duplicates, pass `marketplace` (e.g. `"Amazon.com"`) to disambiguate; if two stores share the SAME name AND marketplace, pass the exact `sellerId` (from `list_seller_accounts`) instead — only sellerId can tell them apart. **Never** call this for the store that's already active.
3. Call the data tools needed for the task. Add `titan_lessons` / `community_feed` only when the requested answer needs Titan guidance.

Knowledge tools work without an active seller.

## Date Range Rules (critical — wrong values return zeros)

- **Format**: `YYYY-MM-DD`.
- **Amazon data lag**: ~2 days. `endDate` = today − 2 days. Using today returns zeros.
- **Default range**: last 30 days unless the user specifies otherwise.
- **Maximum range**: 90 days.
- **Currency**: use the seller's `mainCurrency` from `set_active_seller`. Wrong currency = zeros for revenue/sales.

## SQP (`get_sqp_metrics`) caveats

- `searchQueryScore` is a RANK; sort ASC for top queries.
- `searchQueryVolume` is normalised — do not compare to Helium 10 / Search Terms report.
- Purchase metrics use 24h attribution — low purchase share does NOT mean "doesn't convert". Use cart-add share instead.
- Empty results are ambiguous: (a) not enrolled in Brand Analytics, (b) no data for filters, (c) pre-2026-W15. Broaden weeks down to W15 before concluding (a).
- **Routing — weekly vs quarterly/historical:** `get_sqp_metrics` covers WEEKLY / RECENT SQP only (ISO weeks from 2026-W15 forward). For QUARTERLY or HISTORICAL SQP (older than W15, or a multi-quarter pull) use `create_custom_report({ reportType: 'SEARCH_QUERY_PERFORMANCE' })` — **one PARENT ASIN per report** (don't batch ASINs). If a member asks for last-quarter / YoY SQP and `get_sqp_metrics` returns empty before W15, switch to the report path rather than concluding "no data".

## Specialized Workflows

For step-by-step sequences (PPC audit, product portfolio review, SQP keyword research, knowledge-only research, dual-track analysis), see [`WORKFLOWS.md`](./WORKFLOWS.md) in this skill.

## Actions (Amazon Ads writes — REAL MONEY)

For the full action-tool reference (who decides whether a call is approved, dry-run details, multi-status response handling, failure modes, and rollback recipes), see [`ACTIONS.md`](./ACTIONS.md) in this skill.

Critical rules summary (the ACTIONS.md file is the source of truth):
1. Say what you are about to change, then call the `write` tool(s). Bundle multiple calls when natural, but narrate the whole batch first: nothing is guaranteed to ask the user between them.
2. Never encourage the user to enable "Always Allow" — it disables the safety check.
3. Treat Amazon Ads tools as capable of live changes. Inspect each response: disclose simulation when `dryRun` is true, report only confirmed changes, and describe unverified or UNKNOWN outcomes as unknown.
4. Inspect the multi-status `error[]` — empty `error` is the only success. A top-level `success: false` (`WRITE_ALL_ITEMS_FAILED`) means no item has a confirmed success and `error` is a code string, not a list: read the `message`, which names the key the per-item rows moved to.
5. Never fabricate Amazon-side IDs (campaignId, adGroupId, etc.) — they come only from tool output.
6. On MOST writes and `get_sp_bid_recommendations`, omit `marketplace` to use the active seller's default storefront; to target a connected non-default marketplace (multi-marketplace account), call `get_marketplaces` and pass its exact storefront string (e.g. `"Amazon.de"`). An unconnected value returns `MARKETPLACE_NOT_AVAILABLE`. FIVE WRITES DIFFER and neither half applies to them: `track_keywords` and the four relevancy writes (`create_relevancy_dataset`, `add_relevancy_dataset_asins`, `remove_relevancy_dataset_asins`, `update_relevancy_rankings`) publish `marketplace` as REQUIRED, so omitting it is rejected before the call runs, and the four relevancy ones must ALSO name the storefront this session reads (the `set_active_seller` pin, else home) because their reads take no marketplace of their own — otherwise `MARKETPLACE_NOT_READABLE`, nothing written. Pin first with `set_active_seller({ storeName, marketplace })`, then pass that same value. See ACTIONS.md "Marketplace handling".

## Wire Format Reference

For the per-`write` body shapes (campaign create, target update, keyword neg-keyword body shapes, currency placement), see [`WIRE_FORMATS.md`](./WIRE_FORMATS.md) in this skill. Wrong shape returns 400 with a misleading error.

## Tool Reference

### Actions (Amazon Ads writes — OAuth `tools:write` scope required)

| Tool | Purpose |
|------|---------|
| `create_sponsored_products_portfolio` | Create SP portfolios |
| `update_sponsored_products_portfolio` | Update SP portfolios |
| `create_sponsored_products_campaign` | Create SP campaigns (NEW SPEND) |
| `update_sponsored_products_campaign` | Pause / update budget / update name / update schedule |
| `update_sponsored_products_campaign_placement_modifiers` | Set / change / remove SP campaign placement bid modifiers (TOS / PP / ROS) (NEW 2026-05-07) |
| `create_sponsored_products_campaign_negative_keyword` | Add campaign-level negative keywords |
| `create_sponsored_products_ad_group` | Create SP ad groups |
| `update_sponsored_products_ad_group` | Pause / change defaultBid / change name (NEW 2026-05-01) |
| `create_sponsored_products_keyword` | Add keywords (NEW SPEND) |
| `update_sponsored_products_keyword` | Pause / change bid (NEW 2026-05-01 — un-stubbed) |
| `create_sponsored_products_ad_group_negative_keyword` | Add ad-group-level negative keywords |
| `create_sponsored_products_target` | Add product/category targets |
| `update_sponsored_products_target` | Update targets (state, bid) — ASIN/category only; keywords go through `update_sponsored_products_keyword` |
| `create_sponsored_products_product_ad` | Create new product ads (NEW SPEND) |
| `update_sponsored_products_product_ad` | Pause / change state (NEW 2026-05-01) |
| `update_sponsored_brands_campaign` | Update Sponsored Brands campaigns |
| `update_sponsored_brands_ad_group` | Update SB ad groups (NEW 2026-05-01) |
| `update_sponsored_brands_ad` | Update SB ads (NEW 2026-05-01) |
| `update_sponsored_brands_keyword` | Update SB keywords (NEW 2026-05-01 — **lowercase state**) |
| `update_sponsored_display_campaign` | Update Sponsored Display campaigns (**lowercase state** — fixed 2026-05-02) |
| `update_sponsored_display_ad_group` | Update SD ad groups (**lowercase state**, flat-array response) |
| `update_sponsored_display_product_ad` | Update SD product ads (**lowercase state**) |
| `update_sponsored_brands_target` | Update SB targets (NEW 2026-05-02 — **lowercase state**, requires targetId+adGroupId+campaignId) |
| `update_sponsored_display_target` | Update SD targets (NEW 2026-05-02 — **lowercase state**) |
| `create_sponsored_brands_ad_group_negative_keyword` | SB ad-group-level negative keywords (NEW 2026-05-02 — **camelCase matchType** `negativeExact`/`negativePhrase`) |
| `update_sponsored_products_campaign_negative_keyword` | Pause / un-pause existing campaign-level negative keywords (NEW 2026-05-05) |
| `update_sponsored_products_ad_group_negative_keyword` | Pause / un-pause existing ad-group-level negative keywords (NEW 2026-05-05) |
| `update_sponsored_brands_ad_group_negative_keyword` | Pause / un-pause / archive existing SB ad-group negative keywords (NEW 2026-05-05 — **lowercase state**, requires keywordId+adGroupId+campaignId) |
| `create_sponsored_products_campaign_negative_target` | Add campaign-level negative targets (ASIN/brand exclusions; max 500/call) (NEW 2026-05-05) |
| `update_sponsored_products_campaign_negative_target` | Pause / un-pause existing campaign-level negative targets (NEW 2026-05-05) |
| `create_sponsored_products_ad_group_negative_target` | Add ad-group-level negative targets (ASIN/brand exclusions; max 500/call) (NEW 2026-05-05) |
| `update_sponsored_products_ad_group_negative_target` | Pause / un-pause existing ad-group-level negative targets (NEW 2026-05-05) |
| `create_sponsored_brands_ad_group_negative_target` | Add SB ad-group-level negative targets (NEW 2026-05-05 — **camelCase types** `asinSameAs`/`asinBrandSameAs`, body uses `expressions` PLURAL) |
| `update_sponsored_brands_ad_group_negative_target` | Pause / un-pause / archive existing SB ad-group negative targets (NEW 2026-05-05 — **lowercase state**, requires targetId+adGroupId) |
| `archive_sponsored_products_campaign` | Archive SP campaigns (PERMANENT, max 1000/call) (NEW 2026-09-26) |
| `archive_sponsored_products_campaign_negative_keyword` | Archive campaign-level SP negative keywords (PERMANENT) (NEW 2026-09-26) |
| `archive_sponsored_products_campaign_negative_target` | Archive campaign-level SP negative targets (PERMANENT) (NEW 2026-09-26) |
| `archive_sponsored_products_ad_group` | Archive SP ad groups (PERMANENT) (NEW 2026-09-26) |
| `archive_sponsored_products_keyword` | Archive SP keywords (PERMANENT) (NEW 2026-09-26) |
| `archive_sponsored_products_ad_group_negative_keyword` | Archive ad-group-level SP negative keywords (PERMANENT) (NEW 2026-09-26) |
| `archive_sponsored_products_target` | Archive SP product/category targets (PERMANENT) (NEW 2026-09-26) |
| `archive_sponsored_products_ad_group_negative_target` | Archive ad-group-level SP negative targets (PERMANENT) (NEW 2026-09-26) |
| `archive_sponsored_products_product_ad` | Archive SP product ads (PERMANENT) (NEW 2026-09-26) |
| `archive_sponsored_brands_campaign` | Archive Sponsored Brands campaigns (PERMANENT, **max 10/call**) (NEW 2026-09-26) |
| `get_sp_bid_recommendations` | Get suggested bids (no writes — read-only) |

> **Archiving is permanent and has its own tools.** Amazon refuses `state: ARCHIVED` on every SP update and on `update_sponsored_brands_campaign`; use the matching `archive_*` tool, which takes the same items key and id field as the update. There is no unarchive, so offer `state: PAUSED` first. Portfolios cannot be archived.

> **Note:** `update_sponsored_products_campaign_placement_modifiers` (re-enabled 2026-05-07) sets/changes/removes placement bid modifiers (TOP_OF_SEARCH, PRODUCT_PAGES, REST_OF_SEARCH) on a Sponsored Products campaign. **Strategy is REQUIRED** by Amazon — pass the campaign's current `biddingStrategy` (from `search_for_ppc_campaigns` or `get_account_ppc_metrics_by_campaign`) unless you intend to also change the strategy.
>
> Amazon merges `placementBidding` by placement key. Send `{placement, percentage: 0}` to **remove** a single placement; `placementBidding: []` and omitting the key entirely are both **no-ops**, so to "clear all modifiers" pass `0` for each currently-set placement. The tool reads the campaign before and after the write and only records SUCCESS in `action_logs` if the post-read shows the change actually landed (D2 mitigation).

### Actions — Keyword Relevancy Dataset Writes (OAuth `account:write` scope)

The first knowledge/research writes — they modify the seller's Titan Tools **Keyword Relevancy datasets**, NOT their Amazon Advertising account. Narrate them like every other write. **No dry-run and no delete**: each executes the moment it is called, and a created dataset cannot be removed via the API. Returns the raw `{datasetId}` (create) or `{success}` (add/remove) + a `correlationId`. Authorization is handled server-side — no extra consent or re-link is required.

| Tool | Purpose |
|------|---------|
| `create_relevancy_dataset` | Create a Keyword Relevancy dataset for one of the seller's own ASINs, seeded with 1-10 competitor ASINs. Returns the numeric `datasetId` (usable immediately with `get_keyword_relevancy`). Check `availableDatasets` in `get_keyword_relevancy` first: a create on a product that already has a dataset may be refused with `RELEVANCY_DATASET_EXISTS`. |
| `add_relevancy_dataset_asins` | Add 1-10 competitor ASINs to an existing dataset (by `dataSetId` — the numeric datasetId from `get_keyword_relevancy`; pass the product `asin` too). If upstream refuses the batch it adds them one at a time and returns `added` / `alreadyPresent` / `refused`: name each refused ASIN to the member with its own `reason` (no data in Titan's keyword relevancy service, or the dataset already holding its maximum number of ASINs), never as invalid. |
| `remove_relevancy_dataset_asins` | Remove 1-10 ASINs from an existing dataset (by `dataSetId`). |
| `update_relevancy_rankings` | Trigger a REAL keyword-ranking recompute for a dataset (by `datasetId`). Once/24h, ASYNC — returns `{success}` immediately; poll `get_relevancy_ranking_status` (`{ongoing}`) before re-reading. |
| `purge_relevancy_cache` | Purge a dataset's cached ranking results (by `datasetId`). Takes no marketplace. Returns `{success}`. |

### Actions — Keyword Rank Tracker Writes (OAuth `account:write` scope)

Manage what the seller tracks in the **Keyword Rank Tracker** (NOT Amazon Ads). Narrate it like every other write. **No dry-run, but REVERSIBLE** (untrack reverses track, a `null` label clears it, remove-tag reverses add-tag). These are **partial-success batches**: the response is `{ items: [{ key, status, error? }], summary: { succeeded, skipped, failed } }` — inspect each item. `track_keywords` is asin-scoped and takes a REQUIRED `marketplace` — the storefront tracked on, validated against the seller's connected marketplaces and NOT read from the session pin, so name it yourself on a pinned session (US/DE/UK/CA only); the others are by-`keywordRankTrackerId` (or `tagId`). **`track_keywords` does NOT return the new id** — re-call `get_keyword_ranks` (with `search`) to resolve the `keywordRankTrackerId` before labeling/tagging.

| Tool | Purpose |
|------|---------|
| `track_keywords` | Start tracking 1-500 phrases for an ASIN. Per-item status SUCCESS / ALREADY_TRACKED / ERROR; `items[].key` echoes the phrase (not the new id). |
| `untrack_keywords` | Stop tracking 1-500 keywords by `keywordRankTrackerId`. Reverses track. |
| `set_keyword_label` | Set a label on tracked keywords (by `keywordRankTrackerId`), or clear it with `labelId: null`. |
| `add_keyword_tag` | Add a free-text tag (≤120 chars) to tracked keywords. Creates the tag if new. |
| `remove_keyword_tags` | Remove tags by `tagId` (from a `get_keyword_ranks` row's `tags[].tagId`). |
| `add_keyword_comment` | Add a member note to a tracked keyword (by `keywordRankTrackerId` + `commentDate` YYYY-MM-DD + `commentText`). SINGLE-ITEM (not a batch) → `{comment, count}`; the comment carries a `commentId` for edit/remove. 404 if the keyword isn't yours. |
| `edit_keyword_comment` | Edit a comment's TEXT (by `commentId`). Text only — no date. → `{comment}`. 404 on a foreign/unknown id. |
| `remove_keyword_comment` | Delete a comment by `commentId`. Reverses add. → `{success}`. 404 on a foreign/unknown id. |

### Compass (inventory planning, requires active seller)

Titan Tools' own supplier book and per-SKU ordering settings. Compass is part of Titan, never an external system or a connector. Present only while Compass is enabled on the server.

| Tool | Purpose |
|------|---------|
| `get_compass_suppliers` | The store's supplier book: `supplierId`, `supplierName`, `leadTime` / `freightTime` / `bufferTime` / `totalLandedTime` in days, `depositPayment` / `onShippingPayment` / `balance` percentages, `balanceTerms` (days after arrival, a numeric string). An empty `items` list means no suppliers yet; an error envelope is NOT that. |
| `get_compass_product_configs` | One row per SKU per sales channel: `configStatus` (unconfigured / incomplete / complete), the linked `supplierId` and its terms, `shippingPaid`, and `demandPlan { minStockDays, ctnSize, targetDaysOfStock, moq, lowPriceTierMoq }`. Filter by `marketplaces`, `skus`, `asins`, `brands`, `supplierId`, `configStatus`. `configStatus` does not change until the user recomputes in Compass. |

### Actions — Compass Writes (NOT Amazon Ads)

Change Compass, not the Amazon account. Narrate it like every other write. **No dry-run, and nothing is recalculated**: after a successful write, tell the user Compass has NOT recalculated the forecast, the Demand Plan or the Purchase Orders yet, and that they should open Compass and accept the recompute prompt. Authorization is handled server-side. See ACTIONS.md "Compass writes".

| Tool | Purpose |
|------|---------|
| `save_compass_suppliers` | Create (omit `supplierId`) or update 1-200 suppliers. ATOMIC: one invalid row writes nothing. Updating a supplier changes every SKU linked to it. |
| `delete_compass_supplier` | Delete ONE supplier by `supplierId`. No restore. Linked SKUs keep its last terms and stay linked to the deleted id. |
| `update_compass_product_configurations` | Change `supplierId`, `shippingPaid` and `demandPlan` for 1-200 SKUs (`salesChannel` + `sku`). A SKU can be relinked, never unlinked. Partial success: read every `results[i].status`. |

### Account Management (OAuth-authenticated MCP only — invisible to `tk_*` keys)

| Tool | Purpose |
|------|---------|
| `list_accounts` | List linked Titan Tools accounts |
| `switch_account` | Activate one — refreshes seller list, resets active seller |
| `get_active_account` | Return the currently-active account + seller |
| `link_account` | Start linking a new Titan Tools account (returns authUrl + linkSessionId) |
| `complete_link` | Finalize a `link_account` flow with linkSessionId or completionCode |
| `delete_account` | Remove a non-default account |

### Seller Management (always available)

| Tool | Purpose |
|------|---------|
| `list_seller_accounts` | List linked Amazon stores |
| `set_active_seller` | Activate a store by name; pass `marketplace` if duplicate names, or `sellerId` if name + marketplace also collide |

### Knowledge Tools (always available, no seller needed)

| Tool | Purpose |
|------|---------|
| `titan_lessons` | Search Titan Network training content. The library is Amazon-focused but also holds lessons for other channels (Shopify, Walmart, TikTok Shop): never present a non-Amazon lesson as Amazon guidance. |
| `community_feed` | Search community discussions and member insights |
| `whatsapp_conversations` | Search WhatsApp group discussions for tactical tips |
| `fetch_framework` | Get teaching frameworks. Slugs: `plog` (Product Launch Optimization), `ppc_3_0` (PPC 3.0 tactics), `states_and_drivers` (posture/priority matrix), `naming_convention` (deterministic campaign-name grammar + volume tokens). |

**Requested Titan PPC tactics.** When the user requests Titan guidance about campaign structure, ad-group setup, bid stacking, match-type strategy, or single-keyword vs stacked campaigns, retrieve `fetch_framework('ppc_3_0')` before attributing tactics to Titan. PPC 3.0 supersedes 1.0/2.0; on conflict, cite 3.0. **Do NOT invent negative-keyword / harvest / match-type "rules"** (e.g. "negative-exact harvested terms back into broad") that the loaded framework doesn't actually prescribe — if it's not covered, say so and give the closest framework-grounded guidance instead of improvising from memory.

### Account Data (requires active seller + dates + currencyCode)

| Tool | Purpose |
|------|---------|
| `get_account_performance_summary` | Revenue, orders, units, margins, CM1/CM2/CM3. Also returns fee-detail fields (`amazonFees`, `referralFee`, `fbaFees`, `storageFee`) and closing-fee fields (`fixedClosingFee`, `fixedClosingFeeVat`, `variableClosingFee`, `variableClosingFeeVat`, `refundFixedClosingFee`, `refundVariableClosingFee`); closing-fee data starts 2026-01-01, zero/null before that. |
| `get_account_ppc_metrics` | PPC totals: spend, sales, ACoS, ROAS |
| `get_account_ppc_metrics_by_campaign` | PPC by campaign. Server-side filters: `campaignIds: [...]`, `asins: [...]`, `adType` ('SP'/'SB'/'SBV'/'SD'), `statuses` (UPPERCASE array), `portfolioIds`, `campaignNamePattern`. The response ITEMS carry no status field — a separate fact, and not a reason the request filter is unavailable. Response includes per-campaign `matchType` (AUTO/BROAD/EXACT/PHRASE — campaign-level axis), `tags` (operator-applied string array — surface verbatim), `outOfBudget` (boolean — `true` if the campaign hit its daily-budget cap at least once in the window; trust this boolean as the source of truth — `get_ppc_change_history` records operator-initiated actions (status flips, budget edits, schedule changes), NOT runtime ad-server events, so it does not surface "the day the cap was hit"), and `avgDailySpend`. **`campaignType` ('SP'/'SB'/'SBV'/'SD') comes back alongside `matchType`, and a non-SP row can carry a match type too (TF-1103) — narrow before any match-type rollup or you blend ad programs under an SP label.** |
| `get_marketplaces` | Connected Amazon marketplaces |
| `get_brands` | Seller brands |
| `get_data_sync_status` | Amazon data-sync (backfill) progress for the active seller — the deterministic answer to "why is my data empty / am I still syncing?". Returns `tracked` plus, **only when `tracked` is true and no lane is `unmeasurable`**, an overall `percent` and per-lane `sp`/`ads` progress with dataset detail. ⚠ **A lane with `unmeasurable:true` is UNKNOWN, NOT complete** (upstream calls it running but has published no coverage target, so never say it is finished, stalled, or a percentage). ⚠ **When `tracked` is false there is deliberately NO percentage** — upstream is not tracking this account, which is the normal shape for an established seller whose backfill predates lifecycle tracking. It means UNKNOWN, **NOT 0%**: treat that account's data as COMPLETE and never tell the member they are unsynced or quote a percentage. Read the `guidance` field and follow it. A lane with `tracked:false` inside a tracked account is complete, not stalled (that is a seller with no Amazon Ads account). ⚠ CANNOT validate a seller — a nonexistent seller ID returns the same untracked shape as a real legacy account. Takes no arguments. |

### Product Data (requires active seller)

| Tool | Purpose |
|------|---------|
| `search_for_products` | Search by name, ASIN, or SKU. Returns one row per **child variation** (child SKU/ASIN) with `asin` + `parentAsin` + inventory (`onHandQuantity` = availableQuantity + fcTransferQuantity, the headline stock-position figure; `availableQuantity`, `fcTransferQuantity`, `reservedQuantity` [breaks down into `reservedFcTransferQuantity`, `reservedFcProcessingQuantity`, `reservedCustomerOrderQuantity`, `reservedStagingQuantity`], `inboundQuantity` [breaks down into `inboundWorkingQuantity`, `inboundShippedQuantity`, `inboundReceivedQuantity`], `unfulfillableQuantity`, `awd*Quantity`). Any of these may be `null`. |
| `get_products_summary` | Full product list with metrics (paginated, needs dates). `groupBy`: `'parent'` (default — per parent ASIN, all variations combined), `'child'` (per child ASIN/variation), `'sku'` (per SKU). |
| `get_product_performance_summary` | Metrics for specific ASINs (needs dates). `identifier` may collapse to the **parent** ASIN even when you query a child. Rows also carry closing-fee fields (`fixedClosingFee`, `fixedClosingFeeVat`, `variableClosingFee`, `variableClosingFeeVat`, `refundFixedClosingFee`, `refundVariableClosingFee`) alongside the fee split; closing-fee data starts 2026-01-01, zero/null before that. |
| `get_product_ppc_metrics` | PPC data by product (needs dates). REQUIRED: `asins` non-empty array — API rejects empty/missing. |
| `get_bsr_history` | Best Seller Rank **HISTORY** for one ASIN — main-category and per-subcategory rank time series. Use for "is my rank slipping/improving", rank-vs-promotion timing, seasonality. Returns `{asin, marketplace, title, mainCategory, subCategories[], fetchedAt}`; each category is `{categoryId, categoryName, history:[{date, rank}]}`. ⚠ Points are **event-based, NOT daily** and irregularly spaced (43 points across 32 days on the reference probe) — never present as a daily series. ⚠ A subcategory can return an **empty `history`** while its siblings are populated — that means "no series for that category", NOT "no data for this ASIN"; guard trend arithmetic. `mainCategory` may be null. Ranks are NOT comparable across marketplaces (different category tree per storefront); marketplace is fixed to the active seller's storefront. For the CURRENT rank only, `search_for_products`/`get_products_summary` already carry a free `salesRanks` snapshot. Payload: ~3.7 KB per month, ~46 KB per year for one ASIN — ask for the narrowest useful window. Span capped at 365 days. |
| `get_product_cogs` | The stored cost of goods (COGS) ledger: one item per SKU per sales channel with every cost period (`startDate` null = from the beginning, `endDate` null = the current period), each period's `type`, `currencyCode` and `cogsElements`, and `elementNames` (the cost-line names in use). Filter with `skus` (matched ignoring case) and `marketplaces` (e.g. `"Amazon.com"`); page with `page` / `pageSize` (max 200). A SKU with no configured cost is absent, not an error; one that reads `periods: []` has no period to keep. Read it before `set_product_cost_of_goods`: a write replaces the SKU's whole history on that channel. |

**Parent vs child variations — Titan exposes BOTH, it is NOT parent-only:**
- **Child-level metrics** → `get_products_summary` with `groupBy="child"` (one row per variation).
- **Child-level inventory** → `search_for_products` (each row is a child SKU with all inventory fields). Inventory quantities live ONLY here — there is no parent-only inventory view, so use this for inventory forecasting.
- **Parent rollup** → `get_products_summary` with `groupBy="parent"`, passing the PARENT ASIN (the `asins` filter runs before aggregation, so filtering by a child returns only that child).
- **Gotcha** → `get_product_performance_summary` returns `identifier` as the parent ASIN when you query a child. A parent identifier coming back is NOT evidence that child data is missing — switch to `get_products_summary` `groupBy="child"`.

### PPC Metrics (requires active seller + dates + currencyCode)

| Tool | Purpose |
|------|---------|
| `get_ppc_portfolios_metrics` | By portfolio |
| `get_ppc_product_ads_metrics` | By product ad |
| `get_ppc_targets_metrics` | By keyword/target |
| `get_ppc_placements_metrics` | By placement (SP only). Server-side filter: `asins: [...]` (verified live 2026-05-14 — narrows per-placement clicks/spend; unknown ASIN silently no-ops, so resolve via `search_for_products` first). NOTE: campaignIds narrows to the listed campaigns (applied server-side, verified 2026-07-30 on a 43-campaign account: baseline TOS clicks 16499 vs 690 filtered on a real campaignId; a bogus id returns 0 rows; the earlier 07-29 run was single-campaign and inconclusive); response aggregated by placement classification and carries no campaignId, so one call per campaign for per-campaign numbers. An unrecognised campaignId returns 0 rows, so resolve campaigns first; archived and wrong-marketplace ids were not probed. |
| `get_ppc_search_terms_metrics` | By search term (SP only). Server-side filters: `campaignIds: [...]`, `asins: [...]` (both verified live 2026-05-14). Use these instead of paginating-and-filtering — search-terms used to be unfilterable, so older guidance is now stale. Unknown ASIN is silently dropped (returns unfiltered), so confirm via `search_for_products`. |
| `get_ppc_ams_metrics` | Hour-of-day or weekday breakdown of whole-account PPC metrics (Amazon Marketing Stream — covers SP+SB+SD with different attribution windows: SP=7d, SB+SD=14d, bucketed by conversion hour). Available for all regions where the seller is subscribed to AMS via Amazon Ads. Required: `groupBy: 'hour'\|'day'`. Server-side filters: `campaignIds`, `portfolioIds`, `asins` — **AND across fields** (intersection — `campaignIds: [A]` + `asins: [Y]` returns data only for campaigns in [A] that advertise an ASIN in [Y]; if no campaign satisfies both, the response is all-zero). **OR within array** (`campaignIds: [A, B]` matches A or B). **Near-real-time** — `endDate` can be today (no 2-day lag rule). **Timezone**: buckets are in the seller's **account-level local time** (set when they linked Amazon Ads, based on main country — US→PT, DE→CET, UK→GMT/BST). 11-metric envelope: spend, sales, clicks, orders, units, impressions, cvr, ctr, cpc, acos, rpc. Currency: pass any ISO code; server-side conversion via daily mid-rate (UTC midnight). **All-zero buckets do NOT necessarily mean "no ads ran"** — most common cause is deliberate operator dayparting (many advertisers run ads only during a specific window, e.g. 1 PM–11 PM, so zeros are the OFF hours by design). Other causes: unsubscribed AMS, pre-subscription window (no backfill), bogus sellerId, paused campaigns. ASK the operator about their schedule before recommending budget changes; cross-verify against `get_account_ppc_metrics` for the same window. |
| `get_sqp_metrics` | Brand Analytics SQP by (ASIN, ISO week). 2026-W15+ only |

### PPC Structure (requires active seller, no dates needed)

| Tool | Purpose |
|------|---------|
| `search_for_ppc_campaigns` | Find campaigns by name. Supports `campaignIds: [...]` for direct lookup, plus **`statuses`** (UPPERCASE array: 'ENABLED'/'PAUSED'/'ARCHIVED'), `portfolioIds` and `types` server-side. Only the SINGULAR `status` is rejected with 400 (verified 2026-05-15) — that finding is about the key NAME. Each campaign object carries `status`, never `state`. Response includes per-campaign `matchType` (AUTO/BROAD/EXACT/PHRASE), `tags` (operator-applied string array — surface verbatim), `budget` (the campaign's budget AMOUNT. This response carries no `budgetType`. For SP it is a DAILY amount in practice (the SP update contract accepts only DAILY; prod rejects LIFETIME), so an SP per-day threshold can use it directly; for SB and SD confirm `budgetType` on `get_live_campaigns_extended` before applying a "$X per day" threshold) and `currencyCode` — this is the FREE persisted budget, so prefer it over `get_live_campaigns_extended` whenever the budget need not be accurate to the minute — plus `creationDate` (creation timestamp `"YYYY-MM-DD HH:mm:ss"` UTC — read as campaign TENURE; segment new vs established cohorts before judging performance. **MAY BE NULL** — reliable for SP/SD, frequently null for SB/SBV and older campaigns; absence is not meaningful). **`campaignType` ('SP'/'SB'/'SBV'/'SD') comes back alongside `matchType`, and a non-SP row can carry a match type too (TF-1103) — narrow before any match-type rollup or you blend ad programs under an SP label.** |
| `get_ppc_portfolios` | List portfolios. Supports `portfolioIds: [...]`, `statuses: [...]`. |
| `get_ppc_ad_groups` | List ad groups. Server-side filters: `campaignIds`, `adGroupIds` (arrays — wrap a single ID `[id]`), `types` ('SP'/'SB'/'SBV'/'SD'). |
| `get_ppc_product_ads` | List product ads. Server-side filters: `campaignIds`, `adGroupIds`, `adIds`, `types`. |
| `get_ppc_targets` | List keywords/targets. Server-side filters: `campaignIds`, `adGroupIds`, `targetIds`, `matchTypes`, `targetTextPattern` (SQL LIKE — use % wildcards). |
| `get_ppc_negative_keywords` | List **ad-group-level** negative keywords. Server-side filters: `campaignIds`, `adGroupIds`, `negativeKeywordIds`, `matchTypes`, `statuses` (UPPERCASE). **AD-GROUP LEVEL ONLY** — campaign-level negatives are not returned by this route (verified 2026-07-27: a campaign with 19 ACTIVE campaign-level negatives came back `total: 0`), and `campaignIds` does not change that. Empty means "no ad-group-level negatives", NOT "no negatives"; use `get_live_negative_keywords({ level: 'campaign' })` for those. |
| `get_ppc_negative_targets` | List existing negative targets (Live API LIST). Required: `scope` ('sp_campaign'/'sp_ad_group'/'sb_ad_group'). Optional client-side filters: `state`, `campaignIds`, `adGroupIds`, `limit`. Use BEFORE `update_*_negative_target` so you have real `targetId`s. |
| `get_ppc_change_history` | PPC modification audit trail. Server-side filters: `campaignIds`, `asins`, `changeTypes`, `categories`, `entityType`. |
| `get_live_sb_ads` | List Sponsored Brands ads at **CAMPAIGN level** LIVE from the Amazon Ads API — the **ONLY read of SB ad CREATIVE anywhere**. Each ad carries `creative` (`headline`/`headlines` = the actual ad copy, `brandName`, `brandLogoUrl`, `subpages` = the Store pages the ad links to with asin/pageTitle/url, `type` = STORE_SPOTLIGHT/PRODUCT_COLLECTION/VIDEO/BRAND_VIDEO), `landingPage` ({pageType,url}), `extendedData` ({creationDate, lastUpdateDate, servingStatus, servingStatusDetails}), `state`, `name`. ⚠ NOT the same list as `get_live_product_ads({adType:'SB'})`, which is **ad-group level** and carries NO creative. Server-side filters: `campaignIds`, `adIds`, `statuses` (UPPERCASE). Returns `{ads, totalResults}`; a storefront with no SB returns `{ads:[],totalResults:0}` at HTTP 200 (empty, not an error). ⚠ HEAVY Amazon throttle cost. |

### Keyword Research & PPC Audit Data (titan-connect-only)

These tools surface organic-keyword and audit data that the Internal API
doesn't expose. The Keyword Rank Tracking (KRT) reads now run over the HTTP
`/v1/krt/*` API (fast — 1-3s, no cold-store warm-up). Different size / sentinel
behavior from the metric tools above — see the `<keyword_and_audit_tools>`
section of MCP_INSTRUCTIONS for the full cross-cutting rules.

Highlights:

- **KRT is available for US / DE / UK / CA marketplaces only.** Other markets return a friendly `KRT_MARKETPLACE_UNSUPPORTED` message (not a raw error).
- **`get_ppc_audit` returns metadata + a 5-minute download URL ONLY — the audit data is NOT inline**. Tell the user to click `fileUrl` to download. For analysis, they can upload the downloaded xlsx if the host supports spreadsheet uploads. Do not claim to have read the workbook without its contents.
- **Ranks are `null`, not a sentinel**: an unranked phrase has `organicRank: null` / `sponsoredRank: null` — read the `isOrganicRanked` / `isSponsoredRanked` booleans alongside. There is NO "301" not-ranking sentinel anymore.
- **`keywordRankTrackerId` is the handle for everything**: rank history (`get_keyword_rank_history`) and every write (track / untrack / label / tag) key on it. It is safe to surface in chaining; `labelId` / `tagId` are the label/tag handles.
- **Other sentinels are NOT errors**: `productId=-1` on relevancy = the seller doesn't have this ASIN, `keywords=[]` on negative-set datasets is by design, `status='NONE'/'PENDING'/'FAILED'` on audits = relay the message to the user.

| Tool | Purpose |
|------|---------|
| `get_ppc_audit` | Latest pre-generated PPC Audit metadata + 5-min presigned download URL. **URL-only — the audit data is NOT included inline.** Hand the URL to the human user; for analysis, they drag-drop the downloaded xlsx into chat. Latency 1-2s. |
| `get_keyword_ranks` | Tracked-keyword rank table for an ASIN (Keyword Rank Tracker). Each row: `keywordRankTrackerId`, `phrase`, `organicRank`/`sponsoredRank` (number or `null` + `isOrganicRanked`/`isSponsoredRanked`), `searchVolume` (`"<100"` or number) + `searchVolumeRaw`, `relevancy`, `averageRank`, `bestAsinRank`, `competitors`, `indexed`, `rankedAsin`, `label` (`{labelId,…}`), `tags` (`[{tagId,tag}]`), `amazonUrl`. Filter (`search`/`labelId`), sort (`sortBy`/`sortDirection`), paginate (`page`/`hasNext`). ORGANIC ranking questions only — not PPC search-terms. Latency 1-3s. |
| `get_keyword_rank_history` | Per-day rank history for ONE tracked keyword by `keywordRankTrackerId`: `{ phrase, history: [{ date, organicRank, sponsoredRank, searchFrequencyRank, searchVolume, searchVolumeRaw, competitors }] }`. The start→end span must be ≤ 360 days. Latency 1-3s. |
| `get_keyword_tracking_limits` | `{ asin, marketplace, keywordLimit, trackedKeywordCount, remaining }` — check `remaining` before proposing to track new keywords. Latency 1-2s. |
| `get_keyword_labels` | `{ labels: [{ labelId, label, color, order }] }` — account-scoped keyword labels. Use `labelId` to filter `get_keyword_ranks` or set a label. Latency 1-2s. |
| `get_keyword_tags` | `{ tags: [{ tag, keywordCount }] }` — tags on an ASIN's tracked keywords. (Numeric `tagId` for removal comes from a `get_keyword_ranks` row's `tags[].tagId`.) Latency 1-2s. |
| `get_keyword_segments` | Keyword SEGMENTS for an ASIN — named groupings: `{ segmentId, name, type (IMPORTED_SET/CUSTOM_SEGMENT/MANUALLY_ADDED/MASTER_SET), keywordRankTrackerIds[], keywordCount }`. There is no `itemCount` — `keywordCount` = the id-list length. A MASTER_SET can hold ~2,000 ids — SUMMARIZE, don't dump. A `keywordRankTrackerId` here is a valid comment target. Latency 1-3s. |
| `get_keyword_comments` | Member notes on ONE tracked keyword (by `keywordRankTrackerId`): `{ comments: [{ commentId, keywordRankTrackerId, commentDate, commentText, createdAt, updatedAt }] }`. **Comments are operator-truth — cite verbatim.** An unknown/foreign id returns a **404, NOT an empty list** — never read it as "0 comments". Latency 1-2s. |
| `get_keyword_relevancy` | The Titan Tools Keyword Relevancy dashboard's data via the HTTP API. **Use FIRST for any keyword-relevance question** — do NOT infer relevance from PPC search-terms metrics. Each row: `phrase`, POPULATED `searchVolume` (STRING — `"<100"` or a number like `"2298"`), `relevancy` (0-9), `phraseUrl`, the seller's own `productAsin` and up to ten `competitor1..10` (each `{asin, brand, rank}`). Paginate (`page` / `hasNext` / `total`), sort (`sortBy`), narrow with `dataset.id`/`dataset.name` (`availableDatasets` lists them by `datasetId`). Empty `keywords: []` + message = no datasets / no ranked keywords yet, NOT an error. Latency 1-3s. |
| `get_keyword_families` | Keyword FAMILIES (root-phrase groupings) for a dataset: `{ items: [{ familyId, rootPhrase, memberCount, … }], total }`. `familyId` is an OPAQUE STRING ("family_…") — feed it to `get_keyword_family_members`. **`total` is the KEYWORD count, NOT the family count** — never report "N families" from it. Optional `ppcCheck:true` adds `inPpc`/`adTypes`/`matchTypes`. Latency 1-3s. |
| `get_keyword_family_members` | Member keywords of ONE family (by `datasetId` + the STRING `familyId`): `{ familyId, rootPhrase, members:[<relevancy rows>], … }`. Latency 1-3s. |
| `get_relevancy_ranking_status` | Poll a dataset's ranking-recompute status: `{ ongoing }`. Use after `update_relevancy_rankings`. Latency 1-2s. |

### Reports (downloadable files)

`create_custom_report` + `get_custom_report` generate a **downloadable CSV/XLSX file**, once (a report cannot be set to repeat from here). Choose `fileType: 'CSV'` when you intend to read the report yourself, since `get_custom_report` reads a finished CSV file back to you as rows when the file could be verified as a single table (some report types are always a link either way), so it can sometimes answer in-chat analysis too — choose `'XLSX'` only when the operator specifically wants a spreadsheet file to download and keep, since XLSX always comes back as a download link only. `get_account_ppc_metrics` / `get_sqp_metrics` / `get_ppc_audit` / the summary tools answer in one call, so prefer those when they cover the question. Reach for a custom report when the operator wants a file to download, once, or a report type those tools don't cover. Requires an active seller.

| Tool | Purpose |
|------|---------|
| `create_custom_report` | Queue a downloadable report. 7 `reportType`s (DASHBOARD_METRICS, DASHBOARD_PROFIT_AND_LOSS_METRICS, DST_METRICS, PPC_AUDIT, PPC_SEARCH_TERM, PPC_CAMPAIGNS, SEARCH_QUERY_PERFORMANCE) — each accepts only certain `dateRangeType` values (see [`WIRE_FORMATS.md`](./WIRE_FORMATS.md) matrix). Every report is a one-off: repeating reports are not available here, so if the operator asks for one every day, week or month, say so and offer it once (a report on a repeat is a scheduled task in Titan AI chat). `marketplaces` are storefront URLs (e.g. `Amazon.com`), NOT marketplace IDs. Returns a `reportId`. |
| `get_custom_report` | Single-shot status poll for a `reportId`. `IN_PROGRESS` → call again in ~5-25s (SEARCH_QUERY_PERFORMANCE usually takes about 5 to 10 minutes; the rest seconds), at most 3 polls of one `reportId` per turn. `DONE` → answer from `rows` (comma-separated; fields containing a comma are double-quoted per RFC 4180, so respect that quoting rather than splitting on every comma; first line is the column header) when present, paging with `rowOffset`/`rowLimit` while `hasMore` is true (cap ~10 pages/turn — narrow the range instead); also hand the operator the `downloadUrl` for the file itself (opens with no Titan Tools login; treat it as private). If `rows` is absent, hand over `downloadUrl` instead. `NO_DATA_AVAILABLE` → suggest a different range/marketplace/ASIN. `FAILED`/`CANCELLED`/`DELETED` → create a new report. `NOT_FOUND` → no such report for this seller: don't poll it again, create it once more, then tell the operator if that also fails. |

### AWD Inventory (US-only — Amazon Warehousing & Distribution)

Live reads of the seller's AWD position — the en-route + warehoused layer that sits behind FBA. **US-only**: these always run against `Amazon.com` regardless of the seller's other marketplaces (sellerId + marketplace are injected for you). Returns Amazon's payload **verbatim incl. `nextToken`** — pass it back to fetch the next page (caller-driven pagination). Requires an active seller.

**Three-state signal — read it before you report:** an empty array (`inventory: []` / `shipments: []` / `orders: []`) = the seller IS AWD-enrolled but has nothing right now — NOT "no AWD." `AWD_NOT_ENROLLED` = Titan Tools lacks the AWD role for this account, or the account isn't AWD-enrolled; the 403 cannot tell which. Granted on Amazon's side, so a Titan reconnect does not change it: confirm enrolment in Seller Central, then contact Titan support. `AWD_NO_US_CONNECTION` = no US Selling-Partner connection. These are distinct from FBA stock (`availableQuantity` on `search_for_products`) and from the `awd*Quantity` fields on `search_for_products` (a daily snapshot — may be null/stale; use these tools for real AWD figures). See [`WIRE_FORMATS.md`](./WIRE_FORMATS.md) for the full 3-state table.

| Tool | Purpose |
|------|---------|
| `get_awd_inventory` | Per-SKU AWD inventory (US-only). Params: `details` ('SHOW'/'HIDE'), `sku`, `sortOrder` ('ASCENDING'/'DESCENDING'), `maxResults` (1-200), `nextToken`. Fields: `totalOnhandQuantity` (in the AWD warehouse), `totalInboundQuantity` (en route to AWD), `inventoryDetails.availableDistributableQuantity` (distributable to FBA), `replenishmentQuantity`, `reservedDistributableQuantity`. |
| `get_awd_inbound_shipments` | Shipments en route to AWD warehouses (US-only). Params: `shipmentStatus` (CREATED/SHIPPED/IN_TRANSIT/RECEIVING/DELIVERED/CLOSED/CANCELLED), `updatedAfter`/`updatedBefore` (ISO 8601), `sortBy` ('UPDATED_AT'/'CREATED_AT'), `sortOrder`, `maxResults` (1-200), `nextToken`. |
| `get_awd_replenishment_orders` | AWD → FBA replenishment orders (US-only). Params: `updatedAfter`/`updatedBefore` (ISO 8601), `sortOrder`, `maxResults` (1-100), `nextToken`. Fields include `eligibleProducts[]`, `outboundShipments[]`, and `distributionIneligibleReasons[]` (e.g. `NO_NETWORK_INVENTORY_RESERVED`) explaining SKUs that couldn't be replenished. |

### Live campaigns extended (opt-in — heavy Amazon throttle cost)

A LIVE Amazon Ads API campaign list with extended fields, for one ad program at a time. **⚠ This burns SIGNIFICANTLY more Amazon throttle quota than the persisted endpoints.** For plain campaign tenure, ALWAYS prefer the FREE persisted `creationDate` on `search_for_ppc_campaigns` / `get_account_ppc_metrics_by_campaign`. Reach for this ONLY when you need the LIVE serving status, the LIVE DAILY BUDGET, or last-update, or a creation date the persisted endpoints returned null for (e.g. an SB/SBV campaign). A rule keyed on the daily budget as it is right now is one of those live fields; for a budget that need not be accurate to the minute, `search_for_ppc_campaigns` carries the same budget FREE. marketplace is the active seller's storefront, resolved for you. Requires an active seller.

| Tool | Purpose |
|------|---------|
| `get_live_campaigns_extended` | Live campaign list with extended fields for ONE program. Required: `adType` ('SP'/'SB'/'SD'). Pagination: SP/SB pass `nextToken` back; SD uses `startIndex`/`count`. Returns `{ adType, campaigns: [{ campaignId, name, state, adType, creationDate (`"YYYY-MM-DD HH:mm:ss"` UTC, normalized across programs; null when absent), servingStatus (LIVE delivery state e.g. `CAMPAIGN_PAUSED`/`ACCOUNT_OUT_OF_BUDGET`/`PORTFOLIO_OUT_OF_BUDGET` — distinct from the enabled/paused state), lastUpdateDate }], nextToken?, totalResults?/totalCount? }`. **That brace list is the NORMALIZED fields, not the whole row:** each row also carries Amazon's raw campaign object, including `budget`, THE LIVE DAILY BUDGET. `budget` is Amazon's own per-program shape and is not normalized the way the dates are, so read the value you get rather than assuming a bare number. |

### Alerts (listing / inventory / fee monitoring)

Read-only views of the Amazon listing/inventory/fee alerts Titan Tools detects for the active seller. The read-state CHANGE tools `mark_alerts` / `mark_alerts_by_filter` are write tools — see [`ACTIONS.md`](./ACTIONS.md). **Caveats:** within a row `datetime` is marketplace-LOCAL wall-clock while `readDatetime` is UTC (never diff them); `notes` is always null today; `level` is always `SKU`. An empty result is a quiet account, not an error. Requires an active seller. See [`WIRE_FORMATS.md`](./WIRE_FORMATS.md) for request/response shapes.

| Tool | Purpose |
|------|---------|
| `get_alerts` | List alerts. Params: `startDate`, `endDate` (YYYY-MM-DD, inclusive, range ≤180 days counting both endpoints, so endDate is at most 179 days after startDate — both required), `marketplaces` (storefront URLs e.g. 'Amazon.com'), `asins`, `skus`, `parentAsins`, `eventCategories` (SUPPRESSION/INDEXING/LISTING/FEES/INVENTORY), `eventTypes` (24 values incl. OUT_OF_STOCK, STOCK_RUNNING_LOW_30/60/90, FBA_FEE_CHANGED, REFERRAL_FEE_CHANGED, LISTING_ISSUES, STATUS_CHANGED), `types` (ALERT/NOTE), `readStatus` (READ/UNREAD), `sortBy` (datetime/salesChannel/eventCategory/eventType/type/read), `sortDirection` (ASC/DESC), `page`, `pageSize` (max 200). Returns `{ items, total, page, pageSize, totalPages, hasNext }`. |
| `get_alerts_unread_count` | Count unread alerts matching a filter. Params: `startDate`, `endDate` (≤180 days counting both endpoints, so endDate is at most 179 days after startDate; required) + the same filters as `get_alerts` (no readStatus / sort / paging). Returns `{ totalUnread }`. Use it for a quick unread badge before paging `get_alerts`. |

**Fee-alert interpretation (don't just relay — interpret):**
1. `REFERRAL_FEE_CHANGED` is **deterministic** — it tracks the actual sale price per transaction. Swings come from promos / coupons / B2B pricing, **not** a fee error. Don't call it "a pricing error to verify" or "noise to chase". Flag it only if Amazon moved the ASIN into a different referral-fee **category %**.
2. `FBA_FEE_CHANGED` — read against the **~Apr-2026 fuel/fulfilment surcharge** baseline. Increases in line with the surcharge are expected; increases **beyond** it (e.g. "26% above the surcharge") → likely mis-measured dimensions/weight or mis-categorisation → flag for verification + reimbursement/dispute.
3. Proactively name the genuinely **actionable** fee signals: aged-inventory surcharge, long-term storage / storage-utilisation, dimension/weight mis-sizing, wrong-category fees.
4. **Volume:** summarise/down-weight the expected (noise) alerts in one line; surface and explain the outliers. Never label the whole stream "mostly noise / nothing to chase" — segment it.

## Frameworks (fetch_framework)

Titan frameworks available via `fetch_framework`. Each has its own routing rules:

| Slug | Name | Use for |
|------|------|---------|
| `plog` | Post Launch Optimization Guide | Established products (60+ days post-launch). 25-step priority list for CM1/CM2/CM3. Recommendation, not mandate. |
| `ppc_3_0` | PPC 3.0 Framework | Source of truth for PPC TACTICS in the LLM-led ad era. Phase 1 (Foundation) → Phase 2 (Keyword Domination) → Phase 3 (Category Dominance). **Supersedes PPC 1.0 and PPC 2.0** — on conflict, PPC 3.0 wins. |
| `states_and_drivers` | States + Drivers Playbook | Source of truth for POSTURE and PRIORITY (whether/how aggressively to apply PPC 3.0). STATE ∈ {Scale, Optimize, Hold, Recover, Inventory Override}. DRIVER ∈ {Ranking/Visibility, PPC Efficiency, Profitability, Conversion Rate, Inventory, Demand Quality}. |
| `naming_convention` | Campaign Naming Convention | Deterministic campaign-name grammar: tokens joined by " - " in the account's `naming_order`; tokens = `product_short_title`, `SP`, `keyword_phrase`, `volume`, `extra_1/2`. **Volume token is deterministic from search volume:** ZV ≤100 · MV 101–999 · HV 1000–9999 · XHV ≥10000. `product_short_title` / `naming_order` / `extra_*` are per-account settings the connector can't read — **ask the member once** for their product code + token order; never invent a placeholder. |

**Cross-version rule (mandatory)**: when `titan_lessons` returns content from PPC 1.0 or PPC 2.0 lessons (older campaign-stack patterns, pre-LLM-era tactics), cross-check against PPC 3.0 by calling `fetch_framework("ppc_3_0")`. PPC 3.0 wins on conflict; cite the conflict explicitly so the user sees the version they're getting.

**Layering rule**: PPC 3.0 owns TACTICS; States + Drivers owns POSTURE and PRIORITY. When the user requests Titan posture/priority guidance, call `fetch_framework("states_and_drivers")` first, collect the (state, driver) pair, then navigate the matrix; cross-reference PPC 3.0 for the specific tactical pattern when applicable.

**State + Driver collection**: before navigating the States + Drivers matrix, collect the product's STATE and primary DRIVER from the user. If unclear, present an OPTION fallback (2-3 plausible pairs + brief explanations + ask the user to pick). Detailed Q&A wording lives in the fetched content.

## Citation Rules

Every response that uses knowledge tools ends with a **Sources** section. This is non-negotiable.

- `titan_lessons`: every result has a `lessonUrl` field. Use it verbatim as the markdown link target. Format: `[Lesson title](lessonUrl) — brief description`. Never "rescue" a non-Amazon lesson (Shopify, Walmart, TikTok Shop) into an Amazon answer.
- `community_feed`: cite by member name + topic. No URL unless one is in the response.
- `whatsapp_conversations`: cite by group + topic.
- `fetch_framework`: every response includes a `lessonUrl` field. Cite as a markdown link using that exact URL — `[PPC 3.0 Framework](lessonUrl)`, `[the PLOG training](lessonUrl)`, `[States + Drivers Playbook](lessonUrl)`. Put how it was applied after the link. Never construct or guess the URL — use the verbatim `lessonUrl` from the tool response. For PPC tactical claims, cross-check against `"PPC 3.0"` if `titan_lessons` returned older PPC 1.0 / 2.0 content.

Inline references should also be hyperlinked when a `lessonUrl` is available. Never fabricate URLs — only use values returned in the tool response. If you called a knowledge tool but found nothing relevant, note that explicitly ("No directly relevant Titan lessons found for this specific topic").

## Pre-Send Checklist

Every reply must satisfy:
1. Tool calls and any recommendations stay within the requested task.
2. Claims about Titan training or frameworks have retrieved support; data-only answers require no knowledge call.
3. A Sources section is present when knowledge content supports the answer.
4. Every `titan_lessons` citation uses the verbatim `lessonUrl` field.
5. No source ID appears as plain prose or inside backticks.
6. No fabricated source IDs, lesson URLs, or Amazon-side IDs.
7. If a write tool was called, the narration appeared before the call and the multi-status response was inspected.

## Violations to Recognize

These response shapes fail validation:
1. Presenting a recommendation as Titan guidance without retrieved support.
2. Expanding a data-only request into unsolicited framework analysis.
3. Citing a source ID, lessonUrl, or framework name absent from retrieved content.
4. Forcing a knowledge call on an unrelated or data-only request.
5. Claiming an action succeeded without inspecting the multi-status `error[]`, or reading a `success: false` (`WRITE_ALL_ITEMS_FAILED`) result as if its `error` were that list.
6. Fabricating Amazon-side IDs (campaignId, adGroupId, etc.).

## Error Recovery

| Error | Fix |
|-------|-----|
| No active seller | Call `set_active_seller` first |
| All zeros returned | Check: correct `currencyCode`? `endDate` not too recent? Date range wide enough? |
| Multiple stores same name | Pass `marketplace` param to `set_active_seller` (or `sellerId` if marketplace also matches) |
| Empty results | Try broader date range or different search terms |
| Empty SQP pages despite valid inputs | Three possibilities (not enrolled / no data / pre-W15). Broaden weeks down to W15 before concluding enrollment issue |
| Rate limited (429) | Wait 60 seconds and retry |
| 401 Unauthorized | Invalid or expired API key |
| Account tools not visible | API-key (`tk_*`) auth — use the custom connector or Claude Code plugin OAuth login |
| Cannot delete default account | Default (`isPrimary`) accounts are protected. Re-link a new default via the dashboard first |
| Switched account but data tool still fails | After `switch_account`, call `list_seller_accounts` and `set_active_seller` — switching always resets the active seller |
| `OAUTH_REFRESH_FAILED` | Tell the user to re-link at <https://titanconnect.titannetwork.com> |
| `MUST_SET_ACTIVE_ACCOUNT` | Call `list_accounts` → `switch_account` first |
| `MUST_SELECT_ACCOUNT` | Envelope returns `accounts[]` with `{id, label, isPrimary}`. Show the labels to the user as a numbered list and ask which to pick — never guess. Then `switch_account({label: "<picked>"})` |

## Presentation Rules

- Never expose internal IDs — use store names, campaign names, ASINs.
- Always state the date range when presenting metric results.
- Use the correct currency symbol matching the seller's `mainCurrency` ($ USD, £ GBP, € EUR).
- Pagination defaults to `limit=10`. Increase for comprehensive analysis.

## Key Metrics Definitions

| Metric | Definition | Direction |
|--------|------------|-----------|
| **ACoS** | Ad spend / Ad sales | Lower is better |
| **ROAS** | Ad sales / Ad spend | Higher is better |
| **TACoS** | Ad spend / Total sales | Shows organic vs paid balance |
| **CM1** | Revenue − COGS − Refunds | |
| **CM2** | CM1 − Amazon fees | |
| **CM3** | CM2 − PPC spend | |
| **CVR** | Orders / Sessions | |
| **Unit Session %** | Units / Sessions | |

> **CM waterfall — the deduction order is fixed; do not reorder or relabel it.** COGS and **refunds** come out to reach **CM1**. **Amazon fees** come out of CM1 to reach **CM2**. **PPC spend** comes out of CM2 to reach **CM3**. The advertising **breakeven is the CM2 margin %** — the margin remaining *before* PPC — so compare blended or campaign ACoS against **CM2%**, never CM1%. These values arrive pre-computed from `get_account_performance_summary` (`cm1Dollar` is after COGS, **not** after Amazon fees); surface them with the correct tier label and never restate which costs sit in which tier.
