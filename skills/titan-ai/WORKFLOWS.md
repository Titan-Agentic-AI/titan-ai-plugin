# TitanConnect — Specialized Workflows

These are sub-patterns within the [Knowledge-First Workflow](./SKILL.md#knowledge-first-workflow). Every workflow below pulls knowledge tools FIRST or in parallel — pure-data flows are not allowed under the source-of-truth principle.

## Workflow 0: Account Setup (multiple Titan Tools accounts)

Applies only when authenticated via OAuth. API-key (`tk_*`) auth never sees these tools.

**Run this ONLY when context isn't already established.** Active account + seller
are server-side session state that persists across calls; a single account /
single store is auto-selected. Skip this whole workflow if the user has one
account (auto-selected) or you already switched this session. Before committing a
write batch, state the active account + seller you're writing to (confirm with a
free `get_active_account` probe rather than re-running discovery — a failed write
burns an approval click). Every write result also echoes `activeContext` (the
account + seller + marketplace it hit) — verify it matches what the user
intended. See SKILL.md → "Required Workflow".

```
1. list_accounts → see linked Titan Tools accounts
2. switch_account({ accountId }) → activate one
   (refreshes the seller list to that account's stores; RESETS active seller)
3. continue with Workflow 1
```

To **link a new Titan Tools account**:

```
1. link_account → returns { authUrl, linkSessionId, completionCodeHint, expiresInSeconds }
2. Share authUrl with the user; they consent in Titan Tools and land on a TitanConnect success page
3a. (Local)  complete_link({ linkSessionId }) — poll if status='pending'
3b. (Remote, e.g. Claude.ai custom connector) ask the user to paste the
    completion code from the success page → complete_link({ completionCode })
4. switch_account({ accountId }) to start using the new account
```

The first account ever linked is the **default** (`isPrimary: true`) and cannot be deleted.

## Workflow 1: Seller Setup & Quick Health Check

```
DATA TRACK:
1. list_seller_accounts → set_active_seller → note mainCurrency
2. get_account_performance_summary (30 days) → sales overview
3. get_account_ppc_metrics (30 days)         → advertising overview
4. get_marketplaces + get_brands             → store context

KNOWLEDGE TRACK:
5. titan_lessons      (query: "account health" or "getting started")
6. community_feed     (query: relevant to any issues spotted)

→ Present onboarding summary with key metrics + Titan best practices,
  every claim cited.
```

## Workflow 1b: Build an SP Campaign From Scratch (writes — REAL MONEY)

Use when the user wants a brand-new Sponsored Products campaign (campaign → ad
group → product ad(s) → keywords/targets → optional placement bids).

There is **no single "build campaign" tool** and no way to collapse this into one
approval. Each entity is a separate `propose_*` call, and each downstream call
needs an ID that only comes back in the previous call's `success[]` — so the
calls are a forced serial chain, not a bundle. The host prompts for approval
**once per call**, so a full build is ~5 approvals (more if a step fails and
retries). Set expectations up front, e.g. *"This is a 5-step build — you'll get
one approval prompt each for the campaign, ad group, product ad, keywords, and
placement bids."* Do **not** suggest "Always Allow".

```
KNOWLEDGE TRACK (first, mandatory):
- titan_lessons (campaign structure / single-keyword campaign / etc.)
  + fetch_framework("ppc_3_0") for the build rationale. Cite it.

PRE-FLIGHT:
- get_active_account (free, no approval) → confirm the right account + store
  are active BEFORE any approval-gated write. Establish context if missing.

DATA TRACK (sequential — each step feeds the next; batch items WITHIN a step):
1. propose_create_sp_campaign({ campaigns: [ ... ] })
   → read the new campaignId from success[0].
2. propose_create_sp_ad_group({ adGroups: [{ campaignId, name, defaultBid, state }] })
   → read the new adGroupId from success[0].
3. Product ad(s) + keywords/targets — each needs campaignId + adGroupId. Put all
   items of one kind in ONE call (= ONE approval each):
   - propose_create_sp_product_ad({ productAds: [{ campaignId, adGroupId, sku|asin, state }] })   (max 500/call)
   - propose_create_sp_keyword({ keywords: [{ campaignId, adGroupId, keywordText, matchType, bid?, state:"ENABLED" }, ...] })   (max 500/call — ALL keywords in one call)
   - (or propose_create_sp_target for product/category targets — max 100/call)
4. (optional) propose_update_sp_campaign_placement_modifiers — needs the
   campaign's biddingStrategy; source it from search_for_ppc_campaigns({campaignIds:[id]})
   first (see Workflow 9b). strategy is REQUIRED.

PER STEP:
- Inspect the multi-status error[] — empty error[] is the only success. On a
  partial failure, narrate per-item and retry ONLY the failed items.
- Never fabricate campaignId / adGroupId — use only this turn's success[].
  Create with state:"ENABLED" (pause afterward if the user wants it dark).

→ Close with a plain-prose summary of what was created + a Sources section.
```

## Workflow 2: Comprehensive PPC Audit

The `get_ppc_audit` tool returns a presigned download URL for a
pre-generated audit xlsx that already embeds Titan's curated heuristics.
**The audit data is NOT included inline** — only the URL. Hand it to the
user; for inline analysis, ask them to drag-drop the downloaded xlsx into
the next chat message (Claude.ai parses uploaded xlsx files natively).

For inline analysis WITHOUT requiring a file upload, fall through to the
synthetic chain (steps 2b onward) which composes the same picture from
metric tools.

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_ppc_audit({})
   → If status='DONE': hand `fileUrl` to the user. Tell them the URL is
     valid for 5 minutes and that, for AI analysis, they should download
     and drag-drop the xlsx into the next chat message.
   → DO NOT attempt to fetch fileUrl yourself — your sandbox cannot
     reach the file host. The tool does not include audit contents
     inline; only metadata + URL.
   → If status='NONE'/'FAILED': tell the user to trigger a new audit
     from the Titan Tools dashboard, then continue with the synthetic
     fallback below if they want a same-turn analysis.
   → If status='PENDING': tell the user to retry in a few minutes.

   Synthetic fallback (when the user wants inline analysis without
   uploading the xlsx, or when status != DONE):
   2b. get_account_ppc_metrics (30 days)            → overall PPC health
   2c. get_account_ppc_metrics_by_campaign          → top + worst campaigns
   2d. get_ppc_search_terms_metrics                 → high spend + low conversion terms
   2e. get_ppc_placements_metrics                   → placement bid efficiency
   2f. get_ppc_negative_keywords                    → compare vs wasteful terms

3. get_ppc_change_history (narrow with campaignIds, levels, dateRange)
   → context for any flagged campaigns.

KNOWLEDGE TRACK:
4. titan_lessons     (query: "PPC optimization" or topic specific to flagged areas)
5. community_feed    (query: "ACoS reduction" or relevant topic)
6. fetch_framework("ppc_3_0")  (always — canonical for PPC tactics)

→ Report: health score, top optimizations, campaigns to pause, negatives
  to add — all grounded in Titan strategies, with a Sources section.
  If the user uploaded the xlsx, cite specific audit-sheet findings
  alongside the synthetic data.
```

Latency: get_ppc_audit is 1-2s; synthetic fallback adds ~5-10s end-to-end.

## Workflow 3: Product Portfolio Review

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_products_summary → full list with performance metrics
3. Identify top 5 by revenue, bottom 5 by performance
4. get_product_ppc_metrics (REQUIRED: pass asins=[<top product ASINs>]) → advertising efficiency
5. search_for_products → look up specific ASINs if needed

KNOWLEDGE TRACK:
6. titan_lessons   (query: "product optimization" or relevant topic)
7. community_feed  (query: relevant to portfolio findings)

→ Report: portfolio health, concentration risk, organic vs paid ratio —
  with Titan-backed recommendations and a Sources section.
```

## Workflow 7: Bulk Pause / Cleanup (writes — REAL MONEY)

For pausing or archiving many entities at once. Per-tool caps match Nexus's
empirical limits — 100 for SP/SB/SD structure writes, 500 for SP item-level
creates, 1000 for SP item-level updates (see each `propose_*` tool's
description for its specific cap). Bundle pause/cleanup writes per turn —
chain or bundle as needed.

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. Discover the entities to pause:
   - Underperforming campaigns: search_for_ppc_campaigns({ statuses: ['ENABLED'] }) → get_account_ppc_metrics_by_campaign({campaignIds:[…]}) → rank by ACoS
   - Wasteful keywords:    get_ppc_targets({type:'SP', adGroupIds:[id]}) or by matchTypes/targetTextPattern
   - Wasteful product ads: get_ppc_product_ads({adGroupIds:[id]})
   - Stale ad groups:      get_ppc_ad_groups({campaignIds:[id], status:'enabled'})

KNOWLEDGE TRACK:
3. titan_lessons      (query: "wasted spend" or "campaign cleanup")
4. fetch_framework("ppc_3_0")  (Phase-1 cleanup tactics)

WRITES (bundle in one response when natural; the host gates each call):
5. SP pauses:
   - propose_update_sp_campaign({campaigns:[{campaignId, state:'PAUSED'}]})
   - propose_update_sp_ad_group({adGroups:[{adGroupId, state:'PAUSED'}]})
   - propose_update_sp_keyword({keywords:[{keywordId, state:'PAUSED'}]})
   - propose_update_sp_target({targets:[{targetId, state:'PAUSED'}]})
   - propose_update_sp_product_ad({productAds:[{adId, state:'PAUSED'}]})
6. SB pauses (UPPERCASE state for campaigns/ad-groups/ads; lowercase for keywords/targets):
   - propose_update_sb_campaign({campaigns:[{campaignId, state:'PAUSED'}]})
   - propose_update_sb_ad_group({adGroups:[{adGroupId, state:'PAUSED'}]})
   - propose_update_sb_ad({ads:[{adId, state:'PAUSED'}]})
   - propose_update_sb_keyword({keywords:[{keywordId, adGroupId, campaignId, state:'paused'}]})
   - propose_update_sb_target({targets:[{targetId, adGroupId, campaignId, state:'paused'}]})
7. SD pauses (lowercase state everywhere):
   - propose_update_sd_campaign({campaigns:[{campaignId, state:'paused'}]})
   - propose_update_sd_ad_group({adGroups:[{adGroupId, state:'paused'}]})
   - propose_update_sd_product_ad({productAds:[{adId, state:'paused'}]})
   - propose_update_sd_target({targets:[{targetId, state:'paused'}]})

→ Acknowledge what you're about to do, then proceed. Inspect multi-status
  `error[]` after each call.
```

## Workflow 8: Negative-Keyword Hygiene (writes)

Add negative keywords to suppress wasteful search terms. Three variants — pick the right scope and product type.

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_ppc_search_terms_metrics → identify high-spend / low-conversion terms
3. get_ppc_negative_keywords({campaignIds:[<targets>], statuses:['ENABLED']})
   → confirm not already negated AT AD-GROUP LEVEL. This tool cannot see
     campaign-level negatives (TIT-382), so an empty result is NOT proof the
     term is unblocked, and step 6a would create a duplicate.
3b. get_live_negative_keywords({level:'campaign', campaignIds:[<targets>],
     statuses:['ENABLED']}) → the campaign-level half. Run it before any 6a
     write, or you will re-add negatives the account already has. If this tool
     is not registered on your surface (OpenClaw plugin, in-app Titan AI chat),
     tell the user the campaign-level list could not be checked and that a 6a
     write may duplicate an existing negative.

KNOWLEDGE TRACK:
4. titan_lessons   (query: "negative keywords")
5. fetch_framework("ppc_3_0")  (Phase 2 — Keyword Domination covers neg-kw strategy)

WRITES — pick by scope + ad type:
DEFAULT: ad-group-level (6b/6c) unless the user explicitly asks to block the
term across the whole campaign. "in [the] campaign" = where the keyword lives,
not a request for campaign-scope.
6a. SP campaign-level (block term across all ad groups in a campaign):
    propose_create_sp_campaign_neg_keyword({negativeKeywords:[{
      campaignId, keywordText, matchType:'NEGATIVE_EXACT'  // UPPERCASE
    }]})
6b. SP ad-group-level (block term in one specific ad group):
    propose_create_sp_ad_group_neg_keyword({negativeKeywords:[{
      campaignId, adGroupId, keywordText, matchType:'NEGATIVE_EXACT'
    }]})
6c. SB ad-group-level (NEW 2026-05-02 — DIFFERENT casing!):
    propose_create_sb_ad_group_neg_keyword({negativeKeywords:[{
      campaignId, adGroupId, keywordText, matchType:'negativeExact'  // camelCase!
    }]})
    Note: SB does NOT have campaign-level neg-kw create. Negative-keyword
    creates for SD do not exist as a tool.

REMEDIATION — pause / un-pause / archive existing neg-keywords (NEW 2026-05-05):
7. Find duplicates / stale terms: get_ppc_negative_keywords({statuses:['ENABLED']})
   returns AD-GROUP-level rows only, so it can never supply the keywordId that
   step 8 needs — campaign-level ids come from
   get_live_negative_keywords({level:'campaign', statuses:['ENABLED']}) (TIT-382).
   Use the ad-group list for steps 9 and 10, and the campaign-level list for step 8.
   Where get_live_negative_keywords is not registered, step 8 is only actionable
   for a campaignNegativeKeywordId the user supplies.
8. SP campaign-level: propose_update_sp_campaign_neg_keyword({campaignNegativeKeywords:[{
     keywordId, state:'ARCHIVED'   // UPPERCASE
   }]})
9. SP ad-group-level: propose_update_sp_ad_group_neg_keyword({negativeKeywords:[{
     keywordId, state:'PAUSED'   // UPPERCASE; success-id is `negativeKeywordId`
   }]})
10. SB ad-group-level: propose_update_sb_ad_group_neg_keyword({negativeKeywords:[{
      keywordId, adGroupId, campaignId, state:'paused'   // lowercase!
    }]})

→ Acknowledge what you're about to do, then proceed — bundle the writes in
  one response when natural. Each call surfaces its own host approval.
```

## Workflow 9: Bid Optimization (writes)

Adjust bids for keywords / targets / ad groups based on metrics-driven recommendations.

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_ppc_targets_metrics → find under/over-spending targets
3. get_sp_bid_recommendations(...) → suggested bids for keywords/targets
   (Live API read; p50 ≈ 40s; render a "calculating…" UI)

KNOWLEDGE TRACK:
4. titan_lessons      (query: "bid optimization")
5. fetch_framework("ppc_3_0")  (canonical bid-laddering rules)

WRITES — use the right tool for each entity type and product type:
6. SP keyword bid:    propose_update_sp_keyword({keywords:[{keywordId, bid:N}]})
7. SP target bid:     propose_update_sp_target({targets:[{targetId, bid:N}]})  // ASIN/category targets only
8. SP ad-group default bid: propose_update_sp_ad_group({adGroups:[{adGroupId, defaultBid:N}]})
9. SB keyword bid:    propose_update_sb_keyword({keywords:[{keywordId, adGroupId, campaignId, bid:N}]})  // lowercase state if also setting state
10. SB target bid:    propose_update_sb_target({targets:[{targetId, adGroupId, campaignId, bid:N}]})
11. SD ad-group default bid: propose_update_sd_ad_group({adGroups:[{adGroupId, defaultBid:N, state:'enabled'}]})  // lowercase
12. SD target bid:    propose_update_sd_target({targets:[{targetId, bid:N}]})  // lowercase state if also setting state

NOTE: SB ad-group does NOT have a `defaultBid` — that field is rejected by the API on
SB. Use bid changes at the keyword/target level instead.

→ Acknowledge the % change and expected ACoS / spend impact, then proceed.
```

## Workflow 9b: SP Placement Bid Modifiers (writes — REAL MONEY)

Triggered by: a member asking "boost / drop / clear my Top-of-Search modifier", "set my placement bids", or a placement-metrics audit showing TOS conversion is much better/worse than ROS.

```
KNOWLEDGE TRACK:
1. titan_lessons      (query: "placement modifiers" or "TOS bid adjustment")
2. fetch_framework("ppc_3_0")  (placement-bid laddering — TOS vs PP vs ROS rules)

DATA TRACK:
3. set_active_seller
4. search_for_ppc_campaigns({campaignIds:[...]}) → cache the current
   biddingStrategy + placementTos / placementPp / placementRos scalars.
   The strategy is REQUIRED on the write — Amazon `@IsNotEmpty()`.
5. (optional) get_ppc_placements_metrics → confirm the TOS/PP/ROS perf
   skew for the past N days before changing the modifier.

WRITE — single-campaign target via the dedicated tool:
6. propose_update_sp_campaign_placement_modifiers({
     campaignId,
     dynamicBidding: {
       strategy: '<existing biddingStrategy from step 4>',
       placementBidding: [{ placement: 'PLACEMENT_TOP', percentage: 25 }]
     }
   })

   Semantics (verified 2026-05-07):
   - Amazon merges placementBidding by placement key — placements not in the
     request are PRESERVED.
   - `percentage: 0` REMOVES the placement entry from the campaign.
   - `placementBidding: []` is a NO-OP (does NOT clear modifiers).
   - Omitting placementBidding entirely is also a NO-OP.
   - To clear ALL modifiers, send `0` for each currently-set placement.

   The tool reads the campaign before and after the write and only records
   SUCCESS in action_logs if the post-read shows the change actually landed
   (D2 mitigation). Watch for `WRITE_VERIFICATION_FAILED` or
   `ARCHIVED_NOT_EDITABLE` in the response.

→ Acknowledge per change: which placement, old %, new %, expected spend
  redistribution. The host approves the call.
```

## Workflow 11: Negative-Target Hygiene (writes — REAL MONEY)

Triggered by: search-term reports showing wasted spend on competitor ASINs, or the seller wanting to block a brand.

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. Identify the targets to exclude. Either:
   - get_ppc_search_terms_metrics → high-spend / low-conversion competitor ASINs
   - take an explicit list of competitor ASINs / brands from the seller

KNOWLEDGE TRACK:
3. titan_lessons   (query: "competitor targeting" or "brand exclusion")
4. fetch_framework("ppc_3_0")   (Phase 2 — Defense covers neg-target strategy)

NARRATE FIRST — IN PLAIN ENGLISH:
5. Pick the level (campaign vs ad-group):
   - DEFAULT: ad-group-level (surgical — applies only to that one group). Use it
     unless the user explicitly asks to block across the whole campaign.
   - campaign-level applies to every ad group under that campaign (broader) — use
     ONLY on an explicit campaign-wide / all-ad-group request.
   - "in [the] campaign" = where the ASIN/brand lives, NOT a request for
     campaign-scope; default to ad-group-level.
6. State explicitly: number of campaigns/ad groups affected, the ASINs/brands
   to be blocked, what the seller is committing to.

WRITES:
7a. SP campaign-level (block ASIN/brand across an entire SP campaign):
    propose_create_sp_campaign_neg_target({campaignNegativeTargetingClauses:[{
      campaignId,
      expression: [{ type: 'ASIN_SAME_AS', value: 'B0XXXXXXXX' }],  // UPPERCASE_SNAKE; SINGULAR field
      state: 'ENABLED'
    }]})  // max 500/call
7b. SP ad-group-level (block in one specific ad group only):
    propose_create_sp_ad_group_neg_target({negativeTargetingClauses:[{
      campaignId, adGroupId,
      expression: [{ type: 'ASIN_SAME_AS', value: 'B0XXXXXXXX' }],
      state: 'ENABLED'
    }]})  // max 500/call
7c. SB ad-group-level — DIFFERENT shape:
    propose_create_sb_ad_group_neg_target({negativeTargets:[{
      campaignId, adGroupId,
      expressions: [{ type: 'asinSameAs', value: 'B0XXXXXXXX' }]    // PLURAL field! camelCase types! No state field!
    }]})  // max 100/call

8. After approval, inspect the multi-status `error[]`. Empty error[] is the only
   success. Note the success-id field per tool:
   - SP campaign-level → success.campaignNegativeTargetingClauseId (long-form)
   - SP ad-group-level → success.targetId (short-form)
   - SB ad-group-level → success.targetId

REMEDIATION — pause / un-pause / archive existing neg-targets:
9. SP campaign: propose_update_sp_campaign_neg_target({campaignNegativeTargetingClauses:[{
     targetId, state: 'ARCHIVED'   // UPPERCASE
   }]})
10. SP ad-group: propose_update_sp_ad_group_neg_target({negativeTargetingClauses:[{
      targetId, state: 'PAUSED'   // UPPERCASE
    }]})
11. SB ad-group: propose_update_sb_ad_group_neg_target({negativeTargets:[{
      targetId, adGroupId, state: 'archived'   // lowercase!
    }]})

→ Acknowledge per-item before proceeding (the exclusion commits across an
  entity tree). Bundle creates and state-only updates in one response when
  natural; rollback is to flip state back.
```

## Workflow 4: Knowledge-Only Research (no seller needed)

```
1. titan_lessons          → structured educational content on the topic
2. community_feed         → member discussions and real-world experiences
3. whatsapp_conversations → archived peer discussion (a periodic export that lags)
4. fetch_framework        → applicable frameworks; pick from { "plog", "ppc_3_0", "states_and_drivers" } based on topic

→ Synthesize: key takeaways, real-world examples, peer precedent,
  actionable steps. Sources section is mandatory even here.
```

## Workflow 5: Dual-Track Analysis (Data + Knowledge)

The combinatorial workflow — pull both tracks for the same question.

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_account_performance_summary (30 days)  → sales metrics
3. get_account_ppc_metrics (30 days)          → PPC metrics
4. get_products_summary                       → identify key products
5. get_account_ppc_metrics_by_campaign        → campaign performance

KNOWLEDGE TRACK:
6. titan_lessons   → strategies relevant to the account's situation
7. community_feed  → similar seller experiences
8. fetch_framework → applicable frameworks (PPC 3.0 for tactics, States + Drivers for posture, PLOG for established-product focus)

SYNTHESIS:
→ Compare metrics against best practices from Titan Network content
→ Identify gaps between current performance and recommended strategies
→ Provide 5 prioritized action items backed by BOTH data and knowledge
→ Suggest relevant Titan Network lessons to study for each action item
→ Sources section listing every knowledge-tool result used
```

## Workflow 6: Keyword Research via SQP (Brand Analytics)

**Caveats — read first:**
- `searchQueryScore` is a RANK; sort ASC for top queries.
- `searchQueryVolume` is normalised; do NOT compare to external keyword tools.
- Purchase metrics use 24h attribution — low purchase share does NOT mean "doesn't convert". Use cart-add share.
- Empty results = ambiguous (not enrolled / no data / pre-W15).

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_products_summary → pick the target ASIN (or use the user's)
3. get_sqp_metrics with that ASIN, 4 most recent published ISO weeks,
   sortBy="searchQueryVolume" DESC
4. Also get_sqp_metrics with sortBy="searchQueryScore" ASC for top-ranked queries
5. Cross-check with get_ppc_targets + get_ppc_negative_keywords
   for paid-coverage gaps

KNOWLEDGE TRACK:
6. titan_lessons   (query: "keyword research" / "SQP analysis")
7. community_feed  (query: "search query performance")

→ Synthesize: Must-Add Exact Targets, Must-Add Negatives, Listing Fixes.
  Cite SQP rows AND Titan sources.
```

## Workflow 6.5: Out-of-Budget Diagnostic (read-only)

For "which of my campaigns are running out of budget?" / "is my budget pacing right?".

Uses two response fields added 2026-05: `outOfBudget` (boolean per campaign — `true` when the campaign hit its daily cap at least once in the window) and `avgDailySpend` (= spend / daysInWindow).

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_account_ppc_metrics_by_campaign({ …30d range, sortBy: 'spend', sortDirection: 'DESC' })
   → response items carry `outOfBudget` (boolean) and `avgDailySpend` (number).
   Flag any item where outOfBudget=true.
3. For each flagged campaign, fetch its budget cap via
   search_for_ppc_campaigns({ campaignIds: [id] }) — response gives `budget`.
   Pacing ratio = avgDailySpend / budget. >1.0 means the campaign is
   capped daily; close to 1.0 means it's pacing right at the limit.
4. (optional) get_ppc_change_history({ entityType: 'campaign',
   categories: ['STATUS', 'ADJUSTMENTS'], campaignIds: [flagged ids],
   …dateRange }) for operator-side context in the window — budget edits,
   status flips, schedule changes that may explain the saturation. NOTE:
   change_history records operator actions, NOT runtime ad-server events,
   so it will NOT surface the exact day(s) the cap was hit. The
   `outOfBudget` boolean is the source of truth for whether-it-happened.

KNOWLEDGE TRACK:
5. titan_lessons (query: "budget pacing" or "out of budget")
6. fetch_framework("ppc_3_0")  (Phase 2 — Keyword Domination covers
   budget posture for scale vs hold decisions)

→ Report: flagged campaigns, saturation ratio (avgDailySpend / cap),
  any operator-side budget edits or status flips in the window (from
  step 4, when surfaced), and the recommended action per Titan grounding
  (raise budget vs trim wasteful keywords vs hold).
```

## PPC Tool Selection by Goal

| Goal | Tools to use |
|------|--------------|
| Overall PPC health | `get_account_ppc_metrics` → `get_account_ppc_metrics_by_campaign` |
| Find wasted spend | `get_ppc_search_terms_metrics` (high spend + low conversion; narrow by `campaignIds` or `asins` — server-side, 2026-05) → cross-ref `get_ppc_negative_keywords` |
| Search terms for one campaign / ASIN | `get_ppc_search_terms_metrics({ adType: 'SP', campaignIds: [id], …dateRange })` or `{…, asins: [asin], …}` — server-side narrows (verified 2026-05-14) |
| Optimize bids | `get_ppc_targets_metrics` → `get_ppc_placements_metrics` |
| Product PPC review | `search_for_products` → `get_product_ppc_metrics` → `get_ppc_product_ads_metrics` |
| Campaign audit | `search_for_ppc_campaigns` (resolve IDs) → `get_account_ppc_metrics_by_campaign({ campaignIds })` → `get_ppc_ad_groups({ campaignIds: [id] })` |
| Targets in an ad group | `get_ppc_targets({ type: 'SP', adGroupIds: [id] })` — server-side narrow, returns the matching targets in one call (no pagination) |
| Search a target by keyword text | `get_ppc_targets({ type: 'SP', targetTextPattern: '%towel%' })` — SQL LIKE pattern (% wildcards) |
| Placement breakdown for one ASIN | `get_ppc_placements_metrics({ adType: 'SP', asins: [asin], …dateRange })` — server-side narrows per-placement clicks/spend (verified 2026-05-14). No tool returns a per-campaign placement PERFORMANCE breakdown. `get_account_ppc_metrics_by_campaign`'s `placementTos/Pp/Ros` are the configured per-campaign bid ADJUSTMENTS (`packages/titan-api/src/generated/internal-api.d.ts:4211-4216`, "Placement adjustment for Top of Search"), so they tell you how each campaign bids up a placement, not what it earned there; never read them as clicks/spend by placement. `placements.campaignIds` is applied server-side (verified 2026-07-30 on a 43-campaign account: baseline TOS clicks 16499 vs 690 filtered on a real campaignId; a bogus id returns 0 rows; the earlier 07-29 run was single-campaign and inconclusive), but the response is aggregated by placement classification and carries no campaignId, so per-campaign numbers need one call per campaign. |
| Find campaigns that hit their budget cap | `get_account_ppc_metrics_by_campaign({ …dateRange })` → filter response by `outOfBudget: true`. For the specific date(s) the cap was hit, layer `get_ppc_change_history({ entityType: 'campaign', categories: ['STATUS'], campaignIds: [id] })`. |
| Compare run-rate vs budget | `get_account_ppc_metrics_by_campaign({ …dateRange })` → response `avgDailySpend` (= spend / daysInWindow) vs each campaign's `budget` (from `search_for_ppc_campaigns`). Pacing ratio = avgDailySpend / budget — >1.0 means capped daily. |
| Negative keywords for one campaign | BOTH levels or you will report a false negative. Ad-group level: `get_ppc_negative_keywords({ campaignIds: [id] })` (optionally `{ statuses: ['ENABLED'] }`) — it cannot see campaign-level negatives and returns `total: 0` for a campaign whose negatives are all campaign-level (TIT-382). Campaign level: `get_live_negative_keywords({level:'campaign', campaignIds:[id]})` — the only path to campaign-level negatives. NOT registered on every surface (the OpenClaw plugin and the in-app Titan AI chat do not carry it); if the tool is unavailable, say the campaign-level list could not be checked rather than treating the ad-group result as complete. Always report which levels you checked. |
| Metrics for ASIN-bidding campaigns only | `get_account_ppc_metrics_by_campaign({ asins: [<ASINs>], …dateRange })` — server-side narrow |
| Metrics for one campaign type | `get_account_ppc_metrics_by_campaign({ adType: 'SD', …dateRange })` — server-side narrow to SD only |
| Pause one campaign | `propose_update_sp_campaign({campaigns:[{campaignId, state:'PAUSED'}]})` — UPPERCASE for SP/SB; lowercase for SD |
| Pause one keyword | `propose_update_sp_keyword({keywords:[{keywordId, state:'PAUSED'}]})` (SP) or `propose_update_sb_keyword({keywords:[{keywordId, adGroupId, campaignId, state:'paused'}]})` (SB lowercase + parent IDs) |
| Pause one target (NEW 2026-05-02) | SP: `propose_update_sp_target({targets:[{targetId, state:'PAUSED'}]})` (ASIN/category only). SB: `propose_update_sb_target({targets:[{targetId, adGroupId, campaignId, state:'paused'}]})`. SD: `propose_update_sd_target({targets:[{targetId, state:'paused'}]})` |
| Change one keyword's bid | `propose_update_sp_keyword({keywords:[{keywordId, bid:1.50}]})` (SP) |
| Add SB ad-group neg-keyword (NEW 2026-05-02) | `propose_create_sb_ad_group_neg_keyword({negativeKeywords:[{campaignId, adGroupId, keywordText, matchType:'negativeExact'}]})` — **camelCase** matchType, different from SP! |
| Pause an existing neg-keyword (NEW 2026-05-05) | SP campaign: `propose_update_sp_campaign_neg_keyword({campaignNegativeKeywords:[{keywordId, state:'PAUSED'}]})`. SP ad-group: `propose_update_sp_ad_group_neg_keyword(...)`. SB ad-group: `propose_update_sb_ad_group_neg_keyword(...)` (lowercase + parent IDs). |
| Block competing ASINs / brands from showing alongside my ads (NEW 2026-05-05) | SP campaign-level: `propose_create_sp_campaign_neg_target({campaignNegativeTargetingClauses:[{campaignId, expression:[{type:'ASIN_SAME_AS', value:'B0XXXXXXXX'}], state:'ENABLED'}]})`. SP ad-group: `propose_create_sp_ad_group_neg_target(...)`. SB: `propose_create_sb_ad_group_neg_target({negativeTargets:[{campaignId, adGroupId, expressions:[{type:'asinSameAs', value:'B0XXXXXXXX'}]}]})` — camelCase + PLURAL `expressions`! |
| Pause an existing neg-target (NEW 2026-05-05) | SP campaign: `propose_update_sp_campaign_neg_target({campaignNegativeTargetingClauses:[{targetId, state:'PAUSED'}]})`. SP ad-group: `propose_update_sp_ad_group_neg_target(...)`. SB: `propose_update_sb_ad_group_neg_target({negativeTargets:[{targetId, adGroupId, state:'paused'}]})` (lowercase + adGroupId). |
| Budget analysis | `get_ppc_portfolios_metrics` → `get_account_ppc_metrics_by_campaign` → `get_ppc_placements_metrics` |
| Metrics for specific campaigns | `search_for_ppc_campaigns` (resolve names → IDs) → `get_account_ppc_metrics_by_campaign({ campaignIds: [...] })` direct narrow, no pagination |
| Pre-generated PPC audit (curated by Titan) | `get_ppc_audit({})` — hand fileUrl to user; for inline analysis, user drags-drops the downloaded xlsx into chat |
| Where am I ranking on phrase X? (organic) | `get_keyword_ranks({ asin, search: "X" })` — NOT search-terms metrics (PPC ≠ organic); `organicRank`/`sponsoredRank` are `null` when not ranking (read `isOrganicRanked`/`isSponsoredRanked`); no 301 sentinel |
| Are these keywords relevant to my listing? | `get_keyword_relevancy({ asin })` — FIRST; `relevancy` 0-9; do not infer relevance from PPC search-terms metrics |
| Keyword groupings + member notes? | `get_keyword_segments({ asin })` for the groupings; pick a `keywordRankTrackerId` → `get_keyword_comments({ keywordRankTrackerId })` for the operator-truth notes |
| Keyword families / root phrases? | `get_keyword_families({ datasetId })` → pick a STRING `familyId` → `get_keyword_family_members({ datasetId, familyId })` |
| Pre-launch keyword strategy | `get_keyword_relevancy` → `get_keyword_segments` → `get_keyword_ranks` (in this order; see Workflow 10) |

## Filtering metrics to specific campaigns

When the user asks about specific campaigns by name (e.g. "how is my Brand Defense campaign performing"), use `campaignIds` to narrow server-side rather than paging through results:

```
1. search_for_ppc_campaigns({ query: "Brand Defense" })  → returns matching campaigns with their campaignIds
2. get_account_ppc_metrics_by_campaign({
     currencyCode, startDate, endDate,
     campaignIds: [<id1>, <id2>, ...],
   })                                                     → server returns only those campaigns
3. titan_lessons (knowledge track)
4. Synthesize with Titan grounding
```

`campaignIds` is server-side filtered (verified 2026-04-30 against upstream). Do NOT fabricate campaign IDs; resolve them via `search_for_ppc_campaigns`, `get_ppc_change_history`, or a previous tool result this turn.

The same server-side narrowing applies to the structure tools as of 2026-04-30: `get_ppc_targets`, `get_ppc_ad_groups`, `get_ppc_product_ads`, and `get_ppc_negative_keywords` all accept `campaignIds`/`adGroupIds`/`targetIds`/`adIds` arrays (single ID? wrap it: `[id]`) and the API narrows results before pagination. No need to paginate-and-filter — pass the array, get the matching rows back in one call.

## Read-tool filter inventory (server-side narrowing)

For each PPC read tool, here are the filters the API accepts. Pass them and the server narrows before pagination — no need to fetch full pages and filter locally. Required fields are bold.

| Tool | Filters |
|------|---------|
| `get_account_ppc_metrics_by_campaign` | `campaignIds?`, `asins?`, `adType?` ('SP'/'SB'/'SBV'/'SD'), `sortBy?`, `sortDirection?` (takes `statuses` server-side — UPPERCASE array) |
| `get_ppc_portfolios_metrics` | `portfolioNamePattern?`, `sortBy?`, `sortDirection?` |
| `get_ppc_product_ads_metrics` | `asins?`, `adType?` ('SP'/'SD'/'SBV'), `sortBy?`, `sortDirection?` |
| `get_ppc_targets_metrics` | `adType?` ('SP'/'SB'/'SBV'/'SD'), `targetIds?`, `campaignIds?`, `adGroupIds?` (all three applied server-side; `campaignIds`/`adGroupIds` verified 2026-07-28, `targetIds` verified 2026-07-30 — a real targetId cut 1112 unfiltered rows to 1), `sortBy?`, `sortDirection?` |
| `get_ppc_placements_metrics` | **`adType: 'SP'`**, `asins?` (verified 2026-05-14), `campaignIds?` (applied server-side, verified 2026-07-30: baseline TOS clicks 16499 vs 690 filtered on a real campaignId; a bogus id returns 0 rows — narrows the aggregate only, no campaignId in the response), `sortBy?`, `sortDirection?` |
| `get_ppc_search_terms_metrics` | **`adType: 'SP'`**, `campaignIds?` (verified 2026-05-14), `asins?` (verified 2026-05-14), `sortBy?`, `sortDirection?` |
| `get_product_ppc_metrics` | **`asins`** (non-empty) |
| `get_product_performance_summary` | **`asins`** (non-empty) |
| `search_for_ppc_campaigns` | `query?`, `campaignIds?`, `types?`, `statuses?` (UPPERCASE array — the SINGULAR `status` is what upstream rejects with 400; rows carry `status`, never `state`) |
| `get_ppc_portfolios` | `portfolioNamePattern?`, `portfolioIds?`, `statuses?` |
| `get_ppc_ad_groups` | `campaignIds?`, `adGroupIds?`, `types?`, `adGroupNamePattern?`, `status?` |
| `get_ppc_product_ads` | `campaignIds?`, `adGroupIds?`, `adIds?`, `types?`, `query?` (ad-name pattern), `status?` |
| `get_ppc_targets` | **`type`** ('SP'/'SB'/'SD'), `campaignIds?`, `adGroupIds?`, `targetIds?`, `matchTypes?` (UPPERCASE), `targetTextPattern?` (SQL LIKE, use % wildcards), `status?` |
| `get_ppc_negative_keywords` | `campaignIds?`, `adGroupIds?`, `negativeKeywordIds?`, `matchTypes?` (UPPERCASE), `statuses?` (UPPERCASE), `keywordTextPattern?` |
| `get_ppc_change_history` | **`currencyCode`**, `entityType?`, `categories?`, `campaignIds?`, `asins?`, `changeTypes?` |

### Filtering metrics by campaign status

`get_account_ppc_metrics_by_campaign` does NOT have a `status` parameter. The upstream metrics response doesn't carry a status field on items. Status filtering routes through `search_for_ppc_campaigns` instead.

When the user asks for metrics on enabled / paused / archived campaigns:

```
1. search_for_ppc_campaigns({ statuses: ['ENABLED'], limit: 50 })  → page through if there are many. `statuses` narrows server-side (UPPERCASE); only the SINGULAR `status` is rejected with 400. Rows carry `status`, never `state`.
   (collect all enabled campaignIds; for an account with ~363 enabled campaigns, that's 8 pages)
2. get_account_ppc_metrics_by_campaign({
     currencyCode, startDate, endDate,
     campaignIds: [<all collected ids>],
     sortBy: "spend", sortDirection: "desc",
     limit: 5,                            ← if user wants top N
   })                                                            → server narrows + sorts
3. titan_lessons (knowledge track)
4. Synthesize with Titan grounding
```

Alternative pattern when "top N by spend regardless of status" is acceptable: pull the unfiltered top page first, then verify each top result's status via `search_for_ppc_campaigns({query: name})` lookups and check the returned item's `state` field client-side (the upstream endpoint does not accept a `status` request parameter as of 2026-05-15). Both are valid; the first is cheaper when the status set is small relative to the full account.

---

## Keyword Research Workflows (titan-connect-only tools)

The following workflows use the titan-connect-only keyword tools, all over the
HTTP `/v1/krt/*` + `/v1/tools/relevancy/*` APIs (fast, no cold-store warm-up):
`get_ppc_audit`, `get_keyword_ranks`, `get_keyword_rank_history`,
`get_keyword_tracking_limits`, `get_keyword_labels`, `get_keyword_tags`,
`get_keyword_segments`, `get_keyword_comments`, `get_keyword_relevancy`,
`get_keyword_families`, `get_keyword_family_members`,
`get_relevancy_ranking_status` — plus the KRT + comment + relevancy writes. See
the `<keyword_and_audit_tools>` block in MCP_INSTRUCTIONS for the cross-cutting
rules. KRT is US/DE/UK/CA only. `organicRank`/`sponsoredRank` are `null` when not
ranking (read `isOrganicRanked`/`isSponsoredRanked`) — there is NO 301 sentinel.

### Workflow 10: Keyword Strategy for an ASIN

For pre-launch / re-launch / "what should I target?" questions. **Always
start with relevancy** — PPC search-terms metrics are spend-weighted, not
relevance-weighted, and bias toward "what's getting traffic" instead of
"what should be."

```
DATA TRACK (do these in this order — they compose into the strategy):
1. list_seller_accounts → set_active_seller
2. get_keyword_relevancy({ asin })
   → identifies which phrases ARE relevant to this listing
   (relevancy is integer 0-9; paginate with page/pageSize; a Negative/manual
    dataset correctly returns keywords:[] with a message — by design, not an
    error). For root-phrase grouping, drill with
    get_keyword_families({ datasetId }) → get_keyword_family_members({ datasetId,
    familyId }) — remember families `total` is the KEYWORD count, NOT the family
    count.
3. get_keyword_segments({ asin })
   → the seller's keyword groupings (segmentId/name/type/keywordRankTrackerIds[]/
    keywordCount; summarize a big MASTER_SET, don't dump 2,000 ids). For member
    notes on a phrase, take its keywordRankTrackerId (from a segment or a rank row)
    → get_keyword_comments({ keywordRankTrackerId }). Comments are operator-truth —
    cite verbatim (an unknown/foreign id 404s; that's "not your keyword", not "0").
4. get_keyword_ranks({ asin })
   → current organic performance on tracked phrases (sort with sortBy, paginate
    with page; for movement over time use get_keyword_rank_history by
    keywordRankTrackerId, span ≤ 360 days).

KNOWLEDGE TRACK:
5. titan_lessons (query: "keyword research" or relevant)
6. fetch_framework("ppc_3_0")  (Phase 1 / 2 / 3 keyword strategy)

CROSS-REFERENCE (the synthesis step):
- Relevant + not tracked = gap to add (propose_track_keywords)
- Tracked + not ranking (organicRank null) = PPC opportunity
- Tracked + ranking + low relevancy = candidate to drop
- Member comments from step 3 outweigh model speculation; a note worth recording →
  propose_add_keyword_comment (returns a commentId for later edit/remove)

→ Report: 3-tier list (priority/secondary/parking) with REASONS, sourced
  to the data tool that produced each insight + Titan framework citation.
```

Latency: a handful of HTTP calls, 1-3s each.

### Workflow 11: Rank Health Check

For "where am I ranking?" / "is my rank trending up or down?" questions.

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_keyword_ranks({ asin })  (filter with search, sort with sortBy)
   → per-phrase current organicRank/sponsoredRank (null = not ranking, read the
     isOrganicRanked/isSponsoredRanked booleans).
   For per-day history: get_keyword_rank_history({ asin, keywordRankTrackerId,
     startDate, endDate })  (span ≤ 360 days).
3. For phrases with concerning trends:
   get_keyword_comments({ keywordRankTrackerId })
   → member notes often explain rank movement (e.g. "sponsored rank dropped after
     PPC pause") — first-party context, cite verbatim.
4. For ranks that look unexpectedly low: cross-check with
   get_keyword_relevancy({ asin })
   → low-relevance phrases are expected to rank poorly; high-relevance
   phrases ranking poorly are PPC opportunities.

KNOWLEDGE TRACK:
5. titan_lessons (query: "rank tracking" / "organic rank")
6. fetch_framework("ppc_3_0")  (PPC tactics for boosting organic rank)

→ Report: top phrases by current rank, trend direction (improving /
  declining / not ranking), and recommended action with Titan grounding.
```

Latency: a few HTTP calls, 1-3s each.

### Workflow 12: Tracker Inventory Audit

For "what am I tracking?" / "is my tracker setup healthy?" questions.

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_keyword_ranks({ asin }) + get_keyword_segments({ asin })
   + get_keyword_labels({}) + get_keyword_tags({ asin })
   → the tracked phrases, the keyword groupings, and the account's labels/tags.
   Use NAMES (segment name, label name) in user-facing prose, never IDs.
   For per-phrase member notes: get_keyword_comments({ keywordRankTrackerId }).
3. (optional) get_keyword_relevancy({ asin })
   → check which tracked phrases are actually relevant to the listing.
4. (optional) get_keyword_rank_history(...) for phrases whose trend matters.

CROSS-REFERENCE:
- Tracked + low relevancy + not ranking = candidates to remove (propose_untrack_keywords)
- Tracked + high relevancy + Amazon's Choice = wins to amplify
- Stale comments (commentDate > 90 days old) = outdated context

→ Report: tracker hygiene summary, candidates to add/remove, surface
  member comments that are still load-bearing.
```

**Recompute / refresh a relevancy dataset's rankings:** when the data looks stale,
`propose_relevancy_ranking_update({ datasetId, marketplace })` — pass the storefront the
session is pinned to, since the status poll and the re-reads below follow the pin and take
no marketplace — triggers a REAL recompute (once
per 24h, runs async — returns `{success}` immediately). Then poll
`get_relevancy_ranking_status({ datasetId })` until `{ ongoing: false }` and re-read
`get_keyword_relevancy` / `get_keyword_families`. `propose_relevancy_cache_purge({
datasetId })` (no marketplace) drops cached results to force a fresh read.

**PARENT/CHILD + SIBLINGS:** the tracker (and relevancy) attach to the **PARENT**
ASIN. If `get_keyword_ranks` returns `total: 0` (or relevancy returns `productId:
-1` / empty) for a **child** ASIN, it's almost never a real data gap — resolve the
parent via `search_for_products` and retry on the parent. A family's keywords can
also be split across **sibling parents** (e.g. different size/format parents in one
brand) — if some keywords come back "not tracked" on one parent, check the other
parent ASINs in the family before reporting them untracked. Don't report
"relevancy data not coming in" before trying parents.

**VOLUME SOURCE = the Keyword Rank Tracker, NOT relevancy.** For "give me the
search volume for these keywords," use `get_keyword_ranks` (curated per-phrase
`searchVolume` + `searchVolumeRaw`; filter with `search`). `get_keyword_relevancy`
ALSO returns a populated `searchVolume`, but it's the full relevance corpus (often
thousands of phrases), so read it as relevance-context, not the primary volume
list. `get_sqp_metrics` is a secondary/partial cross-check only. If a keyword isn't
tracked (after parent + sibling checks), **say "not tracked" and stop** — don't
fish across relevancy/SQP/web to manufacture a number.

**SEARCH VOLUME — `<100` vs not-tracked:** `searchVolume` comes back as a number
(>100), the sentinel `"<100"` (real but low — the upstream ZV/sub-threshold
bucket; **not** zero, **not** untracked), or `null`/absent (not in tracker).
`searchVolumeRaw` carries the raw number for threshold maths. Report `"<100"` as
"<100", not "0".

**PRODUCT SEARCH IS NOT EXHAUSTIVE.** `search_for_products` matches a text
pattern, so it silently misses naming variants ("Twin XL" vs "Twin Extra Long
(XL)", "bedbug" vs "bed bug"). **Never** answer "which ASIN / highest revenue /
top / ranking" from one text query (a "Twin XL" search missed the real revenue
leader named "Twin Extra Long (XL)" — off by ~4×). Pull at the parent/family
level or run multiple naming-variant queries and union; caveat any ranking as
limited to matched names; if the member names an ASIN you missed, re-run wider
instead of defending the original ranking.

### Workflow 12b: Search volume for ONE keyword

For "what's the search volume for `<keyword>`?" / "is `<keyword>` tracked?" — do
NOT dump a full table.

```
1. list_seller_accounts → set_active_seller
2. get_keyword_ranks({ asin, search: "<keyword>" })
   → the search param narrows server-side, so an ASIN with hundreds of tracked
     phrases still surfaces the one you asked about (an unfiltered call paginates
     and can hide it).
   → If total:0 on a child, retry on the PARENT ASIN.
3. Match the phrase EXACTLY (don't substitute a different word order, e.g.
   "twin xl mattress cover waterproof" ≠ "waterproof twin xl mattress cover").
4. State which figure + source: relevancy searchVolume vs KRT searchVolume
   (get_keyword_ranks) vs SQP searchQueryVolume — they differ; name the one.
→ Report: the single SV (or "<100" / "not tracked"), its source field, nothing
  else. If the answer feeds a campaign-structure decision (PPC 3.0 1,000+ rule),
  use searchVolumeRaw and say so only when confirmed.
```

### Workflow 13: Hour-of-day / weekday pattern detection (AMS)

For "what's my best hour to advertise?", "are weekend campaigns
underperforming?", or any dayparting hypothesis.

AMS is available for all regions where the seller is subscribed via
Amazon Ads. The seller's account-level timezone (set at Amazon-Ads-link
time, based on their main country) determines what the hour values mean.

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. get_ppc_ams_metrics({
     startDate, endDate, currencyCode,
     groupBy: 'hour'    // or 'day' for weekday breakdown
   })
   → 24 hour-of-day buckets summed across the window (or 7 weekday
     buckets). Use a 30–90 day window for stable patterns; shorter
     windows are noisy.
   → Hour buckets are in the seller's account-level local time (US→PT,
     DE→CET, UK→GMT/BST — based on their configured main country, not
     per-marketplace).
   → Sales/orders are bucketed by CONVERSION hour (purchase time), not
     click hour. Spend/clicks/impressions are bucketed by ad-event hour.
     Attribution windows: SP=7d, SB+SD=14d.
   → Near-real-time: endDate can be today (NOT subject to the 2-day
     daily-PPC-metrics lag rule).

3. INTERPRET ZERO BUCKETS — zero is NOT a failure signal by default.
   Most often it indicates the operator's advertising schedule. Order:
   a. If a contiguous block of zero hours is bordered by non-zero hours
      (e.g. zero from 11 PM–12 PM, non-zero from 1 PM onward), this is
      almost certainly DELIBERATE DAYPARTING. ASK the operator: "Are
      you running ads only between X and Y?" Don't recommend budget
      changes from this pattern.
   b. If EVERY bucket is zero across the window, call get_account_ppc_metrics
      for the same window:
        - account spend > 0 AND AMS all-zero → seller likely lacks an
          Amazon Marketing Stream subscription. Tell them to enable
          AMS on the Amazon Ads side.
        - account spend == 0 AND AMS all-zero → genuine zero traffic
          OR window pre-dates the seller's AMS subscription start
          (Amazon doesn't backfill historical AMS data).
   c. NEVER narrate "you ran no ads" or "your budget exhausted" as a
      finding from AMS alone without operator confirmation of their
      schedule.

4. Identify peak/trough buckets by sorting on the metric that matches
   the operator's actual question:
   - impressions → when do customers SEE my ads?
   - clicks → when do they ENGAGE?
   - sales/orders → when do they BUY (note: this is conversion-hour,
     so the "peak" may be hours after the click-hour peak)?
   - acos → when am I MOST PROFITABLE (low ACoS hours, not high-volume)?

5. For drill-down ("which campaigns drive the 7 AM peak?"), AMS does
   NOT support cross-tool composition at hour granularity. Use AMS to
   identify the time-of-day signal, then drop to daily resolution via
   get_account_ppc_metrics_by_campaign for the same window. Hour-of-day
   on the campaign-level surface is NOT in this upstream round.

KNOWLEDGE TRACK:
6. (optional) fetch_framework('ppc_3_0') — AMS gives raw hour-of-day
   data; the operator's tactical response (dayparting, bid modifiers,
   ad-group hibernation) belongs in the Titan playbook layer, not the
   raw data layer.

→ Report: peak hour(s) / day(s) with absolute and relative numbers,
  with the operative timezone named (e.g. "7 AM Pacific" not "7 AM"),
  and any inferred dayparting clearly attributed to the operator's
  schedule (after confirming with them) — not labelled as a "leak".
```

Latency: 1 tool call, ~6s for the 365-day window probe.

## Workflow 14: Downloadable / Scheduled Custom Report (read-style)

For "give me a CSV of …", "export my … to a spreadsheet", or "set up a weekly/monthly … report". This produces a **downloadable file**, and `get_custom_report` also reads it back as rows when the file could be verified as a single table (some report types are always a link either way), so it can sometimes answer analysis questions too — but the metric tools answer in one call, so prefer those when they cover the question. See the create/download wire format + per-type matrix in [`WIRE_FORMATS.md`](./WIRE_FORMATS.md).

```
DATA TRACK:
1. list_seller_accounts → set_active_seller
2. Pick reportType + dateRangeType for the ask (one of 7 types; each allows
   only certain date ranges — see the WIRE_FORMATS matrix). For
   SEARCH_QUERY_PERFORMANCE you need exactly one ASIN + one marketplace,
   periodicity+year+periodRange, ONCE only.
3. RECURRING? (updateFrequency ≠ ONCE) — CONFIRM the schedule with the operator
   FIRST. Recurring reports cannot be listed, edited, or cancelled via the API,
   so a mistaken DAILY report keeps generating with no in-tool off switch.
4. create_custom_report({ marketplaces, asins?, updateFrequency?, reportConfig })
   → returns { reportId }.
5. get_custom_report({ reportId })  — SINGLE poll, the tool does not loop:
   → IN_PROGRESS: say it's generating, call again in ~5-25s
     (SEARCH_QUERY_PERFORMANCE ~25s; others seconds).
   → DONE: answer from `rows` (comma-separated; fields containing a comma are
     double-quoted per RFC 4180, so respect that quoting rather than
     splitting on every comma; first line is the column header)
     when present, paging with rowOffset/rowLimit while hasMore is true (cap
     ~10 pages/turn). Also hand over downloadUrl — it opens with NO Titan
     Tools login, so keep it private (do not post it anywhere public). If
     `rows` is absent, hand over downloadUrl instead.
   → NO_DATA_AVAILABLE: suggest a wider range / different marketplace / ASIN.
   → FAILED/CANCELLED/DELETED: create a new report.

KNOWLEDGE TRACK:
6. titan_lessons (query: the report's subject, e.g. "profit and loss",
   "search query performance") → the operator still gets a Titan-grounded
   interpretation layer alongside the rows.

→ Answer from the rows, name what's in the file and its date range, hand over
  the download link for the file itself, and (for recurring) restate the
  cadence + the no-edit/no-cancel caveat. Sources section is still mandatory.
```

Latency: create is instant; the single poll is seconds (SQP ~25s).

## Workflow 15: AWD stock picture (US-only — Amazon Warehousing & Distribution)

For "how much AWD inventory do I have?", "what's inbound to AWD?", "which replenishment orders went to FBA?", or a full AWD stock picture. AWD is **US-only** — these tools always run against `Amazon.com`. They return Amazon's payload verbatim incl. `nextToken` (page by passing it back).

```
DATA TRACK:
1. list_seller_accounts → set_active_seller.
2. get_awd_inventory (details: 'SHOW' for the per-SKU distributable/replenishment/
   reserved breakdown). For a full picture also call get_awd_inbound_shipments
   (what's en route to AWD) and get_awd_replenishment_orders (AWD → FBA).
3. READ THE 3-STATE SIGNAL before reporting:
   → 200 with rows: real AWD data — report it.
   → 200 with an empty array (inventory:[]/shipments:[]/orders:[]): the seller IS
     AWD-enrolled but has nothing right now. Say "no current AWD stock", NOT "no AWD".
   → AWD_NOT_ENROLLED (403): the seller hasn't re-authorised Titan Tools for the AWD
     role. Tell them to re-authorise Titan Tools to turn on AWD data — do NOT report
     "no AWD inventory".
   → AWD_NO_US_CONNECTION (404): no US Selling-Partner connection; AWD is US-only.
4. Do NOT use the awd*Quantity fields on search_for_products for this — they come from a
   daily AWD snapshot and may be null or stale (null for sellers not enrolled in AWD, and
   can lag the live position even when populated). The three tools above are the source of
   truth.
5. nextToken present? page through it before summarising totals.

KNOWLEDGE TRACK:
6. titan_lessons (query: "AWD" / "Amazon Warehousing and Distribution" / "inventory
   placement") for the Titan-grounded interpretation layer when the operator wants
   strategy, not just the numbers.

→ Report on-hand (in AWD) vs inbound (en route) vs distributable-to-FBA distinctly;
  surface distributionIneligibleReasons for SKUs that couldn't replenish. Sources
  section is still mandatory.
```

Latency: 1-3s per call; replenishment-orders can paginate on large accounts.

## Workflow 8: Build + analyze a Keyword Relevancy dataset

For "which competitors should I track for <ASIN>?" / "set up relevancy tracking for this product" — when no suitable dataset exists yet.

```
0. Knowledge first: titan_lessons (query: "keyword relevancy" / "competitor research")
   for the Titan lens on relevance + competitor selection.
1. get_keyword_relevancy({ asin }) — does a dataset already exist? If availableDatasets
   is non-empty, analyze that instead of creating a duplicate. DATASET CHECK: omitting
   `dataset` applies whichever set upstream lists first (`appliedDataset`) — NOT
   guaranteed to be the right one; an ASIN can carry stale/test/empty sets. Verify
   `appliedDataset.name` matches the product and the rows are real phrases. If it looks
   wrong, re-call with `dataset:{ id }` choosing the `availableDatasets` entry whose name
   matches the product, then reuse that SAME `dataset` on every follow-up call so
   pages/sorts stay comparable.
2. Identify 1-10 competitor ASINs (from the user, or search_for_products / the
   product's category). Confirm them with the operator.
3. propose_create_relevancy_dataset({ datasetName, asin, competitorAsins:[...], marketplace })
   — HIL-approved, IMMEDIATE, IRREVERSIBLE (no delete). Returns numeric datasetId.
4. get_keyword_relevancy({ asin, dataset:{ id: <new datasetId> } }) — the new dataset
   is queryable immediately (no processing delay). Analyze relevancy + competitor ranks.
5. Refine: propose_add_relevancy_dataset_asins / propose_remove_relevancy_dataset_asins
   ({ dataSetId, asins:[...], marketplace }) to adjust the competitor set, then re-read.
```

→ Synthesize through the Titan lens (which phrases are genuinely relevant, where
  competitors out-rank the seller). Sources section mandatory. Never surface raw
  datasetId / correlationId in prose.

Latency: 1-3s per read; writes are immediate. NO dry-run, NO delete — confirm before creating.

## Workflow 16: Manage Keyword Rank Tracking (reads + writes — REVERSIBLE)

For "track these keywords for <ASIN>", "label/tag my tracked keywords", "where am I ranking and how has it moved". KRT is US/DE/UK/CA only. The writes are HIL-approved, REAL/IMMEDIATE but REVERSIBLE (no dry-run).

```
0. Knowledge first: titan_lessons (query: "keyword rank tracking" / "ranking strategy").
1. Capacity check (before adding): get_keyword_tracking_limits({ asin }) → confirm
   `remaining` > the number you intend to add.
2. See what's already tracked: get_keyword_ranks({ asin, search?, sortBy?, page? }).
   Unranked phrases have organicRank/sponsoredRank = null (read isOrganicRanked /
   isSponsoredRanked) — there is NO 301 sentinel.
3. ADD: propose_track_keywords({ asin, phrases:[...], marketplace }) — HIL-approved. Partial-success:
   per-item SUCCESS / ALREADY_TRACKED / ERROR. items[].key echoes the PHRASE, NOT the
   new keywordRankTrackerId.
4. RESOLVE THE ID (required before labeling/tagging a just-added keyword): re-call
   get_keyword_ranks({ asin, search: "<phrase>" }) and read keywordRankTrackerId from the row.
5. LABEL / TAG (by keywordRankTrackerId):
   - get_keyword_labels() → pick a labelId; propose_set_keyword_label({ keywordRankTrackerIds:[id], labelId })
     (labelId: null clears it).
   - propose_add_keyword_tag({ keywordRankTrackerIds:[id], tag })  — creates the tag if new.
6. HISTORY: get_keyword_rank_history({ asin, keywordRankTrackerId, startDate, endDate })
   — span ≤ 360 days. Chart organicRank/sponsoredRank movement + searchFrequencyRank.
7. UNDO if needed: propose_untrack_keywords({ keywordRankTrackerIds }),
   propose_remove_keyword_tags({ tagIds })  (tagId from a row's tags[].tagId).
```

→ Synthesize through the Titan lens (relevance before tracking, where the seller
  ranks vs competitors). Never surface keywordRankTrackerId / tagId / correlationId
  in user-facing prose — use the phrase / label / tag names. Sources section mandatory.

Latency: 1-3s per read; writes are immediate. NO dry-run, but every write is reversible.


## Workflow 17: Compass supplier book and SKU ordering settings (reads + writes, no dry-run)

For "show my Compass suppliers", "which SKUs are not set up in Compass", "set the MOQ for these SKUs", "move these SKUs to another supplier". Compass is part of Titan, never a connector. The writes are HIL-approved, REAL/IMMEDIATE, and recompute nothing.

```
1. get_compass_suppliers() — the supplier book and each supplier's supplierId.
2. get_compass_product_configs({ configStatus?, supplierId?, skus?, marketplaces? })
   — find the SKUs to change; each row's salesChannel + sku is the write's key.
3. BEFORE a supplier update or delete: get_compass_product_configs({ supplierId })
   and name the SKUs it affects. An update changes all of them; a delete leaves
   them linked to the deleted supplier with its last terms.
4. WRITE (confirm the exact change first):
   - propose_save_compass_suppliers({ suppliers:[...] })            — ATOMIC
   - propose_update_compass_product_configs({ products:[...] })     — partial success,
     read every results[i].status; relink only, never unlink
   - propose_delete_compass_supplier({ supplierId })                 — no restore
5. Re-read the SKUs or suppliers you changed.
6. Tell the user Compass has NOT recalculated the forecast, the Demand Plan or the
   Purchase Orders yet, and that they should open Compass and accept the recompute
   prompt before relying on those figures.
```

→ Never surface supplierId / correlationId in user-facing prose — use supplier names
  and SKUs. configStatus on a re-read can lag until the user recomputes in Compass.

Latency: 1-3s per read; writes are immediate. NO dry-run.
