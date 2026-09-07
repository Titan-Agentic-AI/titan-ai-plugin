# TitanConnect — Wire Format Reference (`propose_*` body shapes)

Verified 2026-04-26 against staging Nexus. Wrong shape = 400 with a misleading error.

## `propose_create_sp_campaign`

Budget is doubly-nested. `currencyCode` is NOT accepted (currency comes from the seller's main currency).

```json
{
  "campaigns": [{
    "name": "...",
    "targetingType": "MANUAL",
    "state": "ENABLED",
    "startDate": "2026-04-26",
    "budget": { "budget": 10, "budgetType": "DAILY" }
  }]
}
```

**Common mistake:** passing `budget.amount` or `budget.currencyCode`. Nexus rejects with `campaigns.0.budget.budget must not be less than 1`.

## `propose_update_sp_campaign`

Pause is the most common use:

```json
{ "campaigns": [{ "campaignId": "12345", "state": "PAUSED" }] }
```

To change budget (same shape as create):

```json
{ "campaigns": [{ "campaignId": "12345", "budget": { "budget": 25, "budgetType": "DAILY" } }] }
```

For placement bid modifiers, do **NOT** use this tool — use `propose_update_sp_campaign_placement_modifiers` (below). It carries the read-after-write verification baked in.

## `propose_update_sp_campaign_placement_modifiers`

Re-enabled 2026-05-07. Single-campaign target. Full upstream `dynamicBidding` shape — `strategy` is REQUIRED by Amazon (`@IsNotEmpty()` on the upstream Nexus DTO), `placementBidding[]` is optional.

Body shape:

```json
{
  "campaignId": "12345",
  "dynamicBidding": {
    "strategy": "MANUAL",
    "placementBidding": [
      { "placement": "PLACEMENT_TOP", "percentage": 25 }
    ]
  }
}
```

`placement` must be one of `PLACEMENT_TOP` (Top of Search), `PLACEMENT_PRODUCT_PAGE` (Product Pages), `PLACEMENT_REST_OF_SEARCH` (Rest of Search). `percentage` is `0..900`.

`strategy` must be one of `LEGACY_FOR_SALES`, `AUTO_FOR_SALES`, `MANUAL`. Pass the campaign's current `biddingStrategy` (sourced from `search_for_ppc_campaigns` or `get_account_ppc_metrics_by_campaign`) unless you intend to change it.

**Amazon merges `placementBidding` by placement key — verified 2026-05-07.** Placements not mentioned in the request are preserved. So to "set TOS to 30 without touching PP", just send TOS:

```json
{ "dynamicBidding": { "strategy": "MANUAL", "placementBidding": [{ "placement": "PLACEMENT_TOP", "percentage": 30 }] } }
```

**To clear a single placement, send `percentage: 0` for it.** Verified 2026-05-07: this REMOVES the placement entry from the campaign's array. To clear TOS but keep PP at its current value of 10:

```json
{ "dynamicBidding": { "strategy": "<existing>", "placementBidding": [{ "placement": "PLACEMENT_TOP", "percentage": 0 }] } }
```

**Empty `placementBidding: []` is a NO-OP.** It does not clear any modifiers — Amazon ignores it. To clear ALL placements, pass `percentage: 0` for each currently-set placement.

**Omitting `placementBidding` entirely is a NO-OP.** Use this only if you want to change `strategy` alone without touching modifiers.

**Errors specific to this tool:**

| `error` | Meaning | What to do |
|---------|---------|-----------|
| `CAMPAIGN_NOT_FOUND` | The campaignId is not in this seller's SP campaign list | Verify the id (search_for_ppc_campaigns) |
| `ARCHIVED_NOT_EDITABLE` | Campaign is ARCHIVED — Amazon won't accept placement-modifier writes on archived campaigns | Unarchive first via `propose_update_sp_campaign` (state: ENABLED), then retry |
| `WRITE_VERIFICATION_FAILED` | Nexus returned 200 but the post-read does not reflect the requested change | Check Seller Central; forensics in `action_logs.errorMessage` (JSON with `requested` / `observed` / `mismatches`) |

## `propose_create_sp_campaign_neg_keyword`

Success items carry `campaignNegativeKeywordId` (NOT `keywordId`).

```json
{
  "negativeKeywords": [{
    "campaignId": "12345",
    "keywordText": "irrelevant search term",
    "matchType": "NEGATIVE_EXACT"
  }]
}
```

`matchType` is `"NEGATIVE_EXACT"` or `"NEGATIVE_PHRASE"`.

## `propose_create_sp_ad_group_neg_keyword`

Success items carry `keywordId`. Body uses `adGroupId` instead of `campaignId`:

```json
{
  "negativeKeywords": [{
    "adGroupId": "67890",
    "keywordText": "irrelevant search term",
    "matchType": "NEGATIVE_EXACT"
  }]
}
```

## `propose_create_sp_keyword`

Promote keywords to a specific match type:

```json
{
  "keywords": [{
    "adGroupId": "67890",
    "keywordText": "camp towels quick dry",
    "matchType": "EXACT",
    "bid": 1.25,
    "state": "ENABLED"
  }]
}
```

`matchType` is `"EXACT"`, `"PHRASE"`, or `"BROAD"`.

## `propose_create_sp_ad_group`

```json
{
  "adGroups": [{
    "campaignId": "12345",
    "name": "...",
    "defaultBid": 1.00,
    "state": "ENABLED"
  }]
}
```

## `propose_create_sp_target`

**Required fields**: `campaignId`, `adGroupId`, `expression`, `expressionType`,
`state`. Every expression needs a **non-empty `value`** — the ASIN for
`ASIN_SAME_AS`, the category id for `ASIN_CATEGORY_SAME_AS`, the brand for
`ASIN_BRAND_SAME_AS`. Upstream rejects a blank or absent value with
`targets.0.expression.0.value should not be empty` and creates nothing.

For product / category targets:

```json
{
  "targets": [{
    "campaignId": "12345",
    "adGroupId": "67890",
    "expression": [{ "type": "ASIN_SAME_AS", "value": "B0XXXXXXXX" }],
    "expressionType": "MANUAL",
    "bid": 1.00,
    "state": "ENABLED"
  }]
}
```

## `propose_update_sp_target`

State or bid update:

```json
{ "targets": [{ "targetId": "T1", "state": "PAUSED" }] }
```

## `propose_create_sp_product_ad`

**Required fields**: `campaignId`, `adGroupId`, `state`, AND exactly one of `asin` OR `sku` (not both).

**By ASIN** (most common — for parent listings without variations):

```json
{
  "productAds": [{
    "campaignId": "12345",
    "adGroupId": "67890",
    "asin": "B0XXXXXXXX",
    "state": "ENABLED"
  }]
}
```

**By SKU** (use when the listing has variations and you need to disambiguate):

```json
{
  "productAds": [{
    "campaignId": "12345",
    "adGroupId": "67890",
    "sku": "MY-SKU-001",
    "state": "ENABLED"
  }]
}
```

**Never send both `asin` and `sku` in the same item** — Amazon Ads API rejects redundant identifiers. Send the one that matches how the listing is configured. If unsure, ASIN works for the majority of cases.

## `propose_create_sp_portfolio` / `propose_update_sp_portfolio`

```json
{
  "portfolios": [{
    "name": "...",
    "state": "ENABLED",
    "budget": { "amount": 1000, "policy": "MONTHLY_RECURRING" }
  }]
}
```

Note: portfolio budget uses `amount + policy`, NOT the campaign-level `budget.budget + budgetType` shape. This is one of the few tools where the spec deviates.

## `propose_update_sb_campaign` / `propose_update_sd_campaign`

```json
{ "campaigns": [{ "campaignId": "...", "state": "PAUSED" }] }
```

`propose_update_sd_campaign` dry-run echoes the actual `campaignId` (not `dry-run-0`).

## `propose_update_sp_ad_group` (NEW 2026-05-01)

UPPERCASE state. Pause / change defaultBid / change name. Wrapped multi-status response under `adGroups`.

```json
{ "adGroups": [{ "adGroupId": "67890", "state": "PAUSED" }] }
```

## `propose_update_sp_keyword` (NEW 2026-05-01 — un-stubbed)

UPPERCASE state. Pause / change bid.

```json
{ "keywords": [{ "keywordId": "K1", "state": "PAUSED" }] }
```

## `propose_update_sp_product_ad` (NEW 2026-05-01)

UPPERCASE state. Wrapped multi-status response under `productAds`.

```json
{ "productAds": [{ "adId": "A1", "state": "PAUSED" }] }
```

## `propose_update_sb_ad_group` / `propose_update_sb_ad` (NEW 2026-05-01)

UPPERCASE state. Wrapped multi-status response.

```json
{ "adGroups": [{ "adGroupId": "67890", "state": "PAUSED" }] }
{ "ads":      [{ "adId":      "A1",    "state": "PAUSED" }] }
```

## `propose_update_sb_keyword` (NEW 2026-05-01 — lowercase state)

⚠️  **lowercase** state values: `enabled`/`paused`/`archived`. Items require **both** `keywordId` AND parent `adGroupId`+`campaignId` (per upstream SB contract).

```json
{
  "keywords": [{
    "keywordId": "K1",
    "adGroupId": "67890",
    "campaignId": "12345",
    "state": "paused"
  }]
}
```

## `propose_update_sd_campaign` (FIXED 2026-05-02 — lowercase state)

⚠️  **lowercase** state — earlier wrapper sent UPPERCASE incorrectly. No `startDate` on update (rejected by API).

```json
{ "campaigns": [{ "campaignId": "...", "state": "paused" }] }
```

## `propose_update_sd_ad_group` / `propose_update_sd_product_ad` / `propose_update_sd_target` (lowercase state, flat-array response)

⚠️  **lowercase** state values: `enabled`/`paused`/`archived`. Response is a **flat array**, not the wrapped `{ adGroups: { success, error } }` shape — `parseMultiStatus` branches on whether the response is an array. The wrapper handles both shapes; you (the LLM) just see the normalized `{ success, error }` envelope.

```json
{ "adGroups":   [{ "adGroupId": "67890", "state": "paused" }] }
{ "productAds": [{ "adId":      "A1",    "state": "paused" }] }
{ "targets":    [{ "targetId":  "T1",    "state": "paused", "bid": 1.5 }] }
```

## `propose_update_sb_target` (NEW 2026-05-02 — lowercase state, requires parent IDs)

⚠️  **lowercase** state. Each item must include the `targetId` AND its parent `adGroupId` + `campaignId`.

```json
{
  "targets": [{
    "targetId":   "T1",
    "adGroupId":  "67890",
    "campaignId": "12345",
    "state":      "paused"
  }]
}
```

## `propose_create_sb_ad_group_neg_keyword` (NEW 2026-05-02 — camelCase matchType)

⚠️  `matchType` is **camelCase** for SB: `negativeExact` | `negativePhrase`. DIFFERENT from SP's UPPERCASE `NEGATIVE_EXACT`. No `state` field.

```json
{
  "negativeKeywords": [{
    "campaignId":  "12345",
    "adGroupId":   "67890",
    "keywordText": "irrelevant search term",
    "matchType":   "negativeExact"
  }]
}
```

## `propose_update_sp_campaign_neg_keyword` (NEW 2026-05-05)

State-only update. UPPERCASE 3-value state. Wrapper key matches the create
counterpart (`campaignNegativeKeywords`); success-id is `campaignNegativeKeywordId`.

```json
// VERIFIED 2026-05-05 against Brendan's account (dry-run)
{
  "campaignNegativeKeywords": [{
    "keywordId": "12345678901234",
    "state":     "PAUSED"
  }]
}
```

## `propose_update_sp_ad_group_neg_keyword` (NEW 2026-05-05)

State-only update. UPPERCASE 3-value state. Wrapper key `negativeKeywords`. ⚠️
Response success-id is **`negativeKeywordId`**, NOT `keywordId` — verified
empirically 2026-05-05 against Brendan's account.

```json
// VERIFIED 2026-05-05 against Brendan's account (dry-run)
{
  "negativeKeywords": [{
    "keywordId": "12345678901234",
    "state":     "ARCHIVED"
  }]
}
```

## `propose_update_sb_ad_group_neg_keyword` (NEW 2026-05-05 — lowercase state, requires parent IDs)

⚠️  **lowercase** state for SB. Each item must include `keywordId` AND its
parent `adGroupId` + `campaignId`. Response is flat-array (same shape as SB
keyword UPDATE).

```json
// VERIFIED 2026-05-05 against Brendan's account (dry-run)
{
  "negativeKeywords": [{
    "keywordId":  "12345678901234",
    "adGroupId":  "67890",
    "campaignId": "12345",
    "state":      "paused"
  }]
}
```

## `propose_create_sp_campaign_neg_target` (NEW 2026-05-05 — campaign-level ASIN/brand block)

⚠️  Wrapper key is `campaignNegativeTargetingClauses` (long-form). Expression
types are UPPERCASE_SNAKE; per-item field is `expression` (singular). State
must be `"ENABLED"` (omit to default). Response success-id is the long-form
**`campaignNegativeTargetingClauseId`**.

```json
// VERIFIED 2026-05-05 against Brendan's account (dry-run)
{
  "campaignNegativeTargetingClauses": [{
    "campaignId": "12345",
    "expression": [
      { "type": "ASIN_SAME_AS",       "value": "B0XXXXXXXX" },
      { "type": "ASIN_BRAND_SAME_AS", "value": "CompetitorBrand" }
    ],
    "state": "ENABLED"
  }]
}
```

## `propose_update_sp_campaign_neg_target` (NEW 2026-05-05 — state-only)

State-only update. UPPERCASE 3-value state. Wrapper key matches the create
counterpart; success-id is the long-form `campaignNegativeTargetingClauseId`.

```json
// VERIFIED 2026-05-05 against Brendan's account (dry-run)
{
  "campaignNegativeTargetingClauses": [{
    "targetId": "12345678901234",
    "state":    "PAUSED"
  }]
}
```

## `propose_create_sp_ad_group_neg_target` (NEW 2026-05-05 — ad-group-level ASIN/brand block)

⚠️  Wrapper key is `negativeTargetingClauses` (different from the campaign-level tool!).
Expression types are UPPERCASE_SNAKE; per-item field is `expression` (singular).
State must be `"ENABLED"`. Response success-id is the **short-form `targetId`**.

```json
// VERIFIED 2026-05-05 against Brendan's account (dry-run)
{
  "negativeTargetingClauses": [{
    "campaignId": "12345",
    "adGroupId":  "67890",
    "expression": [{ "type": "ASIN_SAME_AS", "value": "B0XXXXXXXX" }],
    "state":      "ENABLED"
  }]
}
```

## `propose_update_sp_ad_group_neg_target` (NEW 2026-05-05 — state-only)

State-only update. UPPERCASE 3-value state.

```json
// VERIFIED 2026-05-05 against Brendan's account (dry-run)
{
  "negativeTargetingClauses": [{
    "targetId": "12345678901234",
    "state":    "ARCHIVED"
  }]
}
```

## `propose_create_sb_ad_group_neg_target` (NEW 2026-05-05 — camelCase, expressions PLURAL, no state)

⚠️  Two simultaneous quirks vs SP:
1. **camelCase** expression types: `asinSameAs` / `asinBrandSameAs` (DIFFERENT from SP's UPPERCASE_SNAKE).
2. Per-item field is **`expressions`** (PLURAL — DIFFERENT from SP's `expression`).
3. **No `state` field** at all — state is implicit `ENABLED`. Use the UPDATE tool to pause / archive.

The response uses a non-canonical envelope:
`{createTargetSuccessResults, createTargetErrorResults}` (per-item index field
is `targetRequestIndex`, not `index`). The wrapper normalizes to the standard
multi-status shape.

```json
// VERIFIED 2026-05-05 against Brendan's account (dry-run)
{
  "negativeTargets": [{
    "campaignId": "12345",
    "adGroupId":  "67890",
    "expressions": [{ "type": "asinSameAs", "value": "B0XXXXXXXX" }]
  }]
}
```

## `propose_update_sb_ad_group_neg_target` (NEW 2026-05-05 — lowercase state, requires parent adGroupId)

⚠️  **lowercase** state for SB. Each item must include `targetId` AND its
parent `adGroupId`. Response uses
`{updateTargetSuccessResults, updateTargetErrorResults}` envelope, normalized
by the wrapper.

```json
// VERIFIED 2026-05-05 against Brendan's account (dry-run)
{
  "negativeTargets": [{
    "targetId":  "12345678901234",
    "adGroupId": "67890",
    "state":     "paused"
  }]
}
```

## Update-body fields per endpoint (allowlist)

For each `propose_update_*` tool, here are exactly the per-item fields the API accepts. Anything outside this list 400s (verified live 2026-05-02). Required fields are bold.

| Tool | Per-item fields |
|------|-----------------|
| `propose_update_sp_portfolio` | **`portfolioId`**, `name?`, `state?` (UPPERCASE 2-value), `budget?` |
| `propose_update_sp_campaign` | **`campaignId`**, `name?`, `portfolioId?`, `state?` (UPPERCASE 3-value), `budget?`, `endDate?` |
| `propose_update_sp_campaign_placement_modifiers` | **`campaignId`**, **`dynamicBidding.strategy`** (`LEGACY_FOR_SALES`/`AUTO_FOR_SALES`/`MANUAL`), `dynamicBidding.placementBidding[]?` (`{placement, percentage}` — `percentage: 0` removes; merges by key) |
| `propose_update_sp_ad_group` | **`adGroupId`**, `name?`, `state?` (UPPERCASE 3-value), `defaultBid?` |
| `propose_update_sp_keyword` | **`keywordId`**, `state?` (UPPERCASE 3-value), `bid?` |
| `propose_update_sp_target` | **`targetId`**, `state?` (UPPERCASE 3-value), `bid?` (ASIN/category targets only — keyword IDs go through `propose_update_sp_keyword`) |
| `propose_update_sp_product_ad` | **`adId`**, `state?` (UPPERCASE 3-value) |
| `propose_update_sb_campaign` | **`campaignId`**, `name?`, `state?` (UPPERCASE 3-value), `budget?`, `endDate?` |
| `propose_update_sb_ad_group` | **`adGroupId`**, `name?`, `state?` (UPPERCASE 2-value) |
| `propose_update_sb_ad` | **`adId`**, `state?` (UPPERCASE 2-value) |
| `propose_update_sb_keyword` | **`keywordId`**, **`adGroupId`**, **`campaignId`**, `state?` (lowercase 3-value), `bid?` |
| `propose_update_sb_target` | **`targetId`**, **`adGroupId`**, **`campaignId`**, `state?` (lowercase 3-value), `bid?` |
| `propose_update_sd_campaign` | **`campaignId`**, `name?`, `state?` (lowercase 3-value), `budget?`, `endDate?` |
| `propose_update_sd_ad_group` | **`adGroupId`**, `name?`, `state?` (lowercase 3-value), `defaultBid?` |
| `propose_update_sd_product_ad` | **`adId`**, `state?` (lowercase 3-value) |
| `propose_update_sd_target` | **`targetId`**, `state?` (lowercase 3-value), `bid?` |
| `propose_update_sp_campaign_neg_keyword` | **`keywordId`**, `state?` (UPPERCASE 3-value) |
| `propose_update_sp_ad_group_neg_keyword` | **`keywordId`**, `state?` (UPPERCASE 3-value) |
| `propose_update_sb_ad_group_neg_keyword` | **`keywordId`**, **`adGroupId`**, **`campaignId`**, `state?` (lowercase 3-value) |
| `propose_create_sp_campaign_neg_target` | **`campaignId`**, **`expression[]`** (UPPERCASE_SNAKE types — `ASIN_SAME_AS`/`ASIN_BRAND_SAME_AS`), `state?` (`"ENABLED"` only) |
| `propose_update_sp_campaign_neg_target` | **`targetId`**, `state?` (UPPERCASE 3-value) |
| `propose_create_sp_ad_group_neg_target` | **`campaignId`**, **`adGroupId`**, **`expression[]`** (UPPERCASE_SNAKE types), `state?` (`"ENABLED"` only) |
| `propose_update_sp_ad_group_neg_target` | **`targetId`**, `state?` (UPPERCASE 3-value) |
| `propose_create_sb_ad_group_neg_target` | **`campaignId`**, **`adGroupId`**, **`expressions[]`** (PLURAL; camelCase types — `asinSameAs`/`asinBrandSameAs`). No `state` field. |
| `propose_update_sb_ad_group_neg_target` | **`targetId`**, **`adGroupId`**, `state?` (lowercase 3-value) |

## `get_ppc_ams_metrics` — read-tool wire quirk (Amazon Marketing Stream)

The only read tool with wire semantics worth calling out — every other read tool's response matches its swagger.

**Request body** (POST `/ppc/metrics/ams`):

- `sellerId` (string, required) — auto-resolved from session.
- `currencyCode` (string, required) — pass any ISO code (USD/EUR/GBP/…); server-side conversion via daily mid-rate snapshotted at UTC midnight.
- `startDate`, `endDate` (YYYY-MM-DD, required). `endDate` can be today; AMS is near-real-time (~4–5h lag), NOT subject to the 2-day daily-PPC-metrics lag.
- `marketplaces` (array of marketplace storefront enums, optional in our Zod; auto-resolved from session). Filter narrows by marketplace ID server-side. Omit / `[]` = unfiltered (all of seller's marketplaces).
- `groupBy` (`'hour'` | `'day'`, required). Bad enum values 400 with `{message: ["groupBy must be one of the following values: hour, day"], error: "Bad Request", statusCode: 400}`.
- `campaignIds`, `portfolioIds`, `asins` (array of strings, optional) — server-side filters. **AND across fields** (intersection — verified live 2026-05-20 against Brendan's account: `campaignIds=[A] + asins=[Y]` where A does not advertise Y returns $0, vs. `campaignIds=[A]` alone returning $1,150.26 and `asins=[Y]` alone returning $91.60). **OR within array** (`campaignIds: [A, B]` matches campaigns A or B). No upstream caps on array lengths.

**Region availability**: AMS is available for all regions where the seller is subscribed via Amazon Ads (confirmed by upstream owner 2026-05-19). No NA-only restriction.

**Response wire shape**:

- `groupBy='hour'` → `{ hours: [...] }` only. The `days` key is **omitted**, NOT returned as `[]`.
- `groupBy='day'` → `{ days: [...] }` only. The `hours` key is omitted.
- Treat both keys as optional / one-of-required in any TypeScript narrowing.
- `groupBy='hour'` ALWAYS returns 24 buckets (missing hours filled with zero metrics).
- `groupBy='day'` returns only the weekday rows that have ANY data. A weekday with literally zero ad activity won't appear — rare for active sellers but watch for it on edge cases.

**Bucket shape**:

```json
{ "hour": "7", "formattedHour": "7:00 AM", "metrics": { "spend": 12.34, "sales": 56.78, "clicks": 9, "orders": 1, "units": 1, "impressions": 100, "cvr": 11.11, "ctr": 9.00, "cpc": 1.37, "acos": 21.74, "rpc": 6.31 } }
```

(For `groupBy='day'`: `"day": "1".."7"`, `"formattedDay": "Monday".."Sunday"` — ISO weekday, Monday=1.)

**Hour timezone — seller's account-level local time** (confirmed by upstream owner 2026-05-19):

The hour value reflects the seller's account-level local timezone, set when they linked their Amazon Ads account — specifically the main country they configured on the seller account. So:

- US seller (Amazon Ads US account) → buckets in **Pacific time** (PT/PDT).
- German seller (Amazon Ads DE account) → buckets in **CET/CEST**.
- UK seller (Amazon Ads UK account) → buckets in **GMT/BST**.
- Japanese seller → **JST**. Etc.

The timezone is per-seller (account-level), NOT per-marketplace in the query. A US-based seller who also operates Amazon.de still gets PT-bucketed data for both marketplaces — Amazon emits all of their AMS data with PT offsets because that's the timezone configured on the account.

**Attribution windows**:

- SP (Sponsored Products) → **7-day attribution**.
- SB (Sponsored Brands) → **14-day attribution**.
- SD (Sponsored Display) → **14-day attribution**.

Sales/orders are bucketed by **conversion hour** (purchase time), not by click hour. A click at 8 AM that converts at 11 AM lands in the 11 AM bucket. So the hour-of-day pattern reflects when customers BUY, not when they CLICK on ads. Spend/clicks/impressions are bucketed by ad-event hour (when the ad served or was clicked).

**ALL-ZERO ≠ NO ADS** — the most consequential teaching point:

A sequence of zero buckets does NOT prove no ads ran. The most common cause is **deliberate operator dayparting**: many advertisers configure ad schedules to run only during a specific window (e.g. 1 PM–11 PM), so the OFF hours are zero by design, not because the budget exhausted or campaigns failed.

| Input / situation | Server response | What it looks like |
|-------------------|-----------------|--------------------|
| Operator dayparting (most common!) | 200 OK | Continuous zero block during configured OFF hours |
| Seller not subscribed to AMS | 200 OK | All buckets zero across the entire window |
| Window pre-dates the seller's AMS subscription start | 200 OK | All-zero (no backfill — only post-subscription events stream) |
| Bogus `sellerId` | 200 OK | All-zero |
| Bogus `campaignIds` | 200 OK | All-zero (filter resolves to no matching rows) |
| `marketplaces: []` or omitted | 200 OK | Unfiltered = all of seller's marketplaces |
| `marketplaces: ["Foo.bar"]` (invalid enum) | 200 OK | **Silently ignored**, returns unfiltered |
| `marketplaces: ["Amazon.ca"]` (seller has no .ca) | 200 OK | All-zero |
| `groupBy: "week"` (invalid enum) | 400 | Structured error |

**Operator-facing rule**: before recommending budget changes off the back of a zero pattern, ASK the operator about their advertising schedule. Many "11 AM cliffs" you'll see in real seller data are deliberate dayparting schedules, not problems to fix. If a zero pattern is genuinely surprising, cross-verify with `get_account_ppc_metrics` for the same window. If account-level shows spend and AMS shows zero across the board, the seller likely needs to subscribe to AMS on the Amazon Ads side.

**Retention**: per-seller backfill horizon = the seller's AMS subscription start date. Amazon doesn't provide historical AMS data — only events emitted after subscription. So a query window that pre-dates the subscription returns zero for those dates with no warning. Empirically Brendan has data back to roughly 1 year ago (subscription cutoff), zero before.

## `create_custom_report` / `get_custom_report` — wire format (async report generation)

Internal-api, x-api-key. Read-style tools (no approval prompt). `sellerId` is auto-resolved from the active seller and `deliveryMethod` is always `link` — neither is model-facing; the tool injects them, so they are omitted from the bodies below.

### `create_custom_report` body

Top-level: `marketplaces` (array of storefront URLs e.g. `["Amazon.com"]` — NOT marketplace IDs; defaults to the active seller's `mainSalesChannel` when omitted), `brands?`, `asins?`, `updateFrequency` (`ONCE` default | `DAILY` | `WEEKLY` | `MONTHLY` | `QUARTERLY` | `YEARLY`), and `reportConfig`. `reportConfig` = `currencyCode`, `reportType`, `dateRangeType`, `fileType` (`CSV`|`XLSX` — `get_custom_report` normally reads a `CSV` back as rows, but rows can still be absent if the file could not be verified as a single table, in which case you get a link instead; choose `XLSX` only when a spreadsheet file to download and keep is specifically wanted, since `XLSX` always comes back as a link), optional `dateRangeConfig`. Returns `{ reportId }`; the report generates asynchronously — poll with `get_custom_report`.

**Per-`reportType` date-range matrix** (wrong combo → upstream 400):

| reportType | allowed `dateRangeType` | `dateRangeConfig` |
|---|---|---|
| DASHBOARD_METRICS / DST_METRICS / PPC_SEARCH_TERM / PPC_CAMPAIGNS | CUSTOM_DATES, LAST_MONTH, LAST_YEAR, LAST_7_DAYS, LAST_30_DAYS, LAST_60_DAYS | CUSTOM_DATES → `startDate`+`endDate` (no `periodicity`); presets → omit |
| DASHBOARD_PROFIT_AND_LOSS_METRICS | CUSTOM_DATES, LAST_12_MONTHS_BY_MONTH, THIS_YEAR_BY_MONTH, LAST_YEAR_BY_MONTH, LAST_3_MONTHS_BY_WEEK, LAST_30_DAYS_BY_DAY | CUSTOM_DATES → `startDate`+`endDate`+`periodicity` (DAY/WEEK/MONTH); presets → omit |
| PPC_AUDIT | LAST_8_FULL_WEEKS only | omit |
| SEARCH_QUERY_PERFORMANCE | CUSTOM_DATES_SQP only | `periodicity`(WEEK/MONTH/QUARTER)+`year`+`periodRange`; NO `startDate`/`endDate`; exactly 1 marketplace + 1 ASIN; ONCE only |

Global: `CUSTOM_DATES` / `CUSTOM_DATES_SQP` require `updateFrequency: ONCE`. Day-count rules (P&L DAY ≤ 32d / WEEK ≥ 9d / MONTH ≥ 33d) and the SQP year-floor (≤16 months) + fully-completed-period checks are enforced upstream and surface as a readable 400.

Preset range (dashboard metrics, last 7 days, recurring daily):

```json
{
  "marketplaces": ["Amazon.com"],
  "updateFrequency": "DAILY",
  "reportConfig": {
    "currencyCode": "USD",
    "reportType": "DASHBOARD_METRICS",
    "dateRangeType": "LAST_7_DAYS",
    "fileType": "XLSX"
  }
}
```

Custom dates (P&L, monthly buckets, one-time):

```json
{
  "marketplaces": ["Amazon.com"],
  "updateFrequency": "ONCE",
  "reportConfig": {
    "currencyCode": "USD",
    "reportType": "DASHBOARD_PROFIT_AND_LOSS_METRICS",
    "dateRangeType": "CUSTOM_DATES",
    "fileType": "CSV",
    "dateRangeConfig": { "startDate": "2026-01-01", "endDate": "2026-04-30", "periodicity": "MONTH" }
  }
}
```

SQP (weekly — exactly one ASIN + one marketplace, one-time):

```json
{
  "marketplaces": ["Amazon.com"],
  "asins": ["B07PARENT01"],
  "updateFrequency": "ONCE",
  "reportConfig": {
    "currencyCode": "USD",
    "reportType": "SEARCH_QUERY_PERFORMANCE",
    "dateRangeType": "CUSTOM_DATES_SQP",
    "fileType": "XLSX",
    "dateRangeConfig": { "periodicity": "WEEK", "year": 2026, "periodRange": "W18" }
  }
}
```

`periodRange` shape by periodicity: WEEK → `"W18"`, MONTH → English month name `"April"`, QUARTER → `"Q2"`.

### `get_custom_report` body + status vocabulary

Body: `{ "reportId": "<from create>" }`. **Single poll** — on `IN_PROGRESS` you re-invoke; the tool does NOT loop internally.

Response `status` ∈ `IN_PROGRESS | DONE | FAILED | CANCELLED | DELETED | NO_DATA_AVAILABLE`; `downloadUrl` is non-null ONLY on `DONE`. On `DONE`, `header` + `rows` (comma-separated; fields containing a comma are double-quoted per RFC 4180, so respect that quoting rather than splitting on every comma; `rows`' first line repeats the column header) plus paging fields `rowOffset`/`rowsReturned`/`totalRows`/`hasMore` are populated whenever the file could be read server-side; `rows` is absent, and only `downloadUrl` is returned, when it could not. Two more fields appear only when true: `bodyTruncated` means the file was too large to read in full, so `totalRows` is a lower bound and narrowing the date range is the only way to see a complete count; `clipped` means one returned row was too wide to fit whole and was cut short, marked inline with `[row clipped]` — treat that row's value as incomplete and use `downloadUrl` if it matters.

| status | meaning | action |
|---|---|---|
| IN_PROGRESS | still generating | call again in ~5-25s |
| DONE | ready | answer from `rows` if present; page with `rowOffset` while `hasMore` is true (cap ~10 pages/turn — narrow the range instead of paging further); if `rows` is absent, hand the operator `downloadUrl` instead |
| NO_DATA_AVAILABLE | no data for the parameters | suggest a different range / marketplace / ASIN |
| FAILED / CANCELLED / DELETED | terminal | create a new report |

`downloadUrl` = `https://app.titantools.com/reports/download?source=<signed token>` — a **self-authenticating bearer link**: it opens with no Titan Tools login and has no per-link expiry. Treat it as a secret — hand it to the operator, do not post it anywhere public. Reading the rows yourself no longer requires fetching this link; the tool result already carries the rows when they are available.

**Latency**: DASHBOARD / DST / PPC report types reach `DONE` within seconds; `SEARCH_QUERY_PERFORMANCE` ~25s. A recurring `create` also materializes the first run immediately, so the poll behaves identically to a one-time report.

**No lifecycle CRUD**: upstream exposes only create + download. A created report — including a recurring schedule — cannot be listed, edited, or cancelled via these tools. Confirm a recurring schedule with the operator BEFORE creating it.

## `get_awd_inventory` / `get_awd_inbound_shipments` / `get_awd_replenishment_orders` — wire format (AWD live reads, US-only)

Live SP-API AWD proxies. Read-style tools (no approval prompt). `sellerId` is auto-resolved from the active seller and `marketplace` is **forced to `Amazon.com`** (AWD is US-only — never derived from `mainSalesChannel`); neither is model-facing. The only model-facing inputs are the optional Amazon filters + `nextToken` (see the SKILL tool table). The response is Amazon's payload **verbatim, including `nextToken`** — pagination is the caller's responsibility (pass `nextToken` back; the tool does NOT auto-walk).

**3-state response signal** (the body of a 403/404 is an identical-looking Amazon `Unauthorized` envelope — we classify on HTTP status, so trust the `code`):

| Input / situation | Server response | What it looks like |
|---|---|---|
| Enrolled US seller, has data | 200 | `{ inventory: [...] }` / `{ shipments: [...] }` / `{ orders: [...], nextToken? }` |
| Enrolled US seller, nothing right now | 200 | `{ inventory: [] }` (etc.) — enrolled, no current stock/shipments/orders — **NOT "no AWD"** |
| Not re-authed for the AWD role | 403 → `AWD_NOT_ENROLLED` | `{ error: true, code: "AWD_NOT_ENROLLED", message }` — actionable: ask the operator to re-authorise Titan Tools |
| No US (Amazon.com) connection | 404 → `AWD_NO_US_CONNECTION` | `{ error: true, code: "AWD_NO_US_CONNECTION", message }` — US-only gating |

Real shapes (probe-verified gomezfit / A20KO674Z5KLVG, 2026-05-30):

```jsonc
// get_awd_inventory (details=SHOW) — 55 SKUs, no nextToken when one page
{ "inventory": [
  { "sku": "3D Mesh3-Xlong", "totalOnhandQuantity": 0, "totalInboundQuantity": 250,
    "inventoryDetails": { "availableDistributableQuantity": 0, "replenishmentQuantity": 0, "reservedDistributableQuantity": 0 } }
] }
// get_awd_inbound_shipments — 101 shipments
{ "shipments": [
  { "shipmentId": "STAR-S3ZWFTUQR4ZNW", "orderId": "STAR-QYDAM5GK5VYWW", "externalReferenceId": "wfd695d266-…",
    "shipmentStatus": "RECEIVING", "createdAt": "2026-04-24T01:23:57.905Z", "updatedAt": "2026-05-29T18:22:35.313Z" }
] }
// get_awd_replenishment_orders — 100 orders, paginates via nextToken
{ "orders": [
  { "orderId": "repl-2acb32f8-…", "status": "SUCCESS", "confirmedOn": "2026-05-23T19:01:22.139Z",
    "eligibleProducts": [{ "sku": "Kickstand Pad Red", "quantity": 150 }],
    "outboundShipments": [{ "shipmentId": "repl-ship-…", "shipmentStatus": "DELIVERED" }],
    "distributionIneligibleReasons": [] } ],
  "nextToken": "eyJ…" }
```

**Field semantics**: `totalOnhandQuantity` (units physically in the AWD warehouse) vs `totalInboundQuantity` (en route to AWD, not yet received) vs `inventoryDetails.availableDistributableQuantity` (distributable from AWD to FBA) vs `replenishmentQuantity`. `distributionIneligibleReasons[].failureCode` (e.g. `NO_NETWORK_INVENTORY_RESERVED`) explains SKUs a replenishment order couldn't move.

**`search_for_products` inventory fields** — the `/products` rows carry `awdAvailableQuantity` + `awdInboundQuantity`, which come from a daily AWD snapshot and may be null or stale: they are null for sellers not enrolled in AWD and can lag the live position even when populated. Do NOT treat them as authoritative AWD stock — use the three live AWD tools above for real, live AWD figures. The same rows carry the FBA stock position: `onHandQuantity` (on-hand inventory quantity, defined as availableQuantity + fcTransferQuantity: prefer this over availableQuantity alone as the headline stock-position figure) and `fcTransferQuantity` (quantity that is buyable and in transit to a fulfillment center for closer placement, SLA 1-25 days, may extend for weather or other factors; `null` when unavailable). The rows also carry `reservedQuantity` (units in Amazon's network being picked/packed/shipped or sidelined), `inboundQuantity` (units en route to Amazon), and `unfulfillableQuantity` (units that cannot be sold) — any of these may be `null` for a given SKU. `reservedQuantity` breaks down into `reservedFcTransferQuantity` (being transferred between fulfillment centers), `reservedFcProcessingQuantity` (sidelined at the FC for additional processing), `reservedCustomerOrderQuantity` (reserved for customer orders), and `reservedStagingQuantity` (held after receipt while Amazon distributes it across the network, moving from reserved to available once placed); each may be `null`. `inboundQuantity` breaks down into `inboundWorkingQuantity` (notified to Amazon, not yet shipped), `inboundShippedQuantity` (notified to Amazon and tracked, in transit), and `inboundReceivedQuantity` (the not-yet-received portion of an inbound shipment that is otherwise partially received and processed); each may be `null`.

## `get_alerts` / `get_alerts_unread_count` / `mark_alerts` / `mark_alerts_by_filter` — wire format (Alerts)

`sellerId` is injected from the active seller — never send it. All four are internal-api calls; the two `mark_*` tools are HTTP `PATCH`, the two reads are `POST`.

**`get_alerts` request** (startDate/endDate required, inclusive, range ≤180 days):
```json
{
  "startDate": "2026-05-01",
  "endDate": "2026-05-31",
  "marketplaces": ["Amazon.com"],
  "asins": ["B0CKPV1G9B"],
  "skus": ["SE-BSK-1"],
  "parentAsins": ["B0CKPV1G9B"],
  "eventCategories": ["INVENTORY"],
  "eventTypes": ["OUT_OF_STOCK"],
  "types": ["ALERT"],
  "readStatus": "UNREAD",
  "sortBy": "datetime",
  "sortDirection": "DESC",
  "page": 1,
  "pageSize": 10
}
```
All fields except `startDate`/`endDate` are optional. **`eventCategories`** ∈ `SUPPRESSION|INDEXING|LISTING|FEES|INVENTORY`. **`eventTypes`** (21): `STATUS_CHANGED, ADULT_FLAG_CHANGED, LISTING_SUPPRESSED, LISTING_SUSPENDED, LISTING_ISSUES, PRODUCT_TYPE_CHANGED, CATEGORY_CHANGED, TITLE_CHANGED, BULLETS_REMOVED, BULLETS_CHANGED, DESCRIPTION_CHANGED, SEARCH_TERMS_CHANGED, LISTING_ATTRIBUTE_CHANGED, PARENT_PRODUCT_CHANGED, BUYBOX_LOST, DIMENSIONS_CHANGED, PACKAGE_DIMENSIONS_CHANGED, WEIGHT_CHANGED, FBA_FEE_CHANGED, REFERRAL_FEE_CHANGED, OUT_OF_STOCK`.

**`get_alerts` response**:
```json
{
  "items": [{
    "id": "515a7ddf-3c76-4928-9bb6-9d2dcb8a357c",
    "level": "SKU", "sku": "SE-BSK-1", "asin": "B0CKPV1G9B", "parentAsin": "B0CKPV1G9B",
    "salesChannel": "Amazon.com", "eventCategory": "INVENTORY", "eventType": "OUT_OF_STOCK",
    "oldValue": null, "newValue": null, "value": null, "type": "ALERT", "notes": null,
    "datetime": "2026-05-27 09:22:17.971", "read": false, "readDatetime": null
  }],
  "total": 1, "page": 1, "pageSize": 10, "totalPages": 1, "hasNext": false
}
```
**Wire quirks**: `datetime` and `readDatetime` are ClickHouse `YYYY-MM-DD HH:mm:ss.SSS` (space-separated, NO `T`/`Z`) — NOT ISO-8601, despite older doc-strings. `datetime` is **marketplace-local** wall-clock; `readDatetime` is **UTC** — do not diff them. `notes` is always `null` today; `level` is always `SKU`. An empty `items: []` is a normal quiet-account result (the tool replaces it with a `noResults: true` + `hint` envelope), not an error.

**`get_alerts_unread_count`**: same request as `get_alerts` minus `readStatus`/`sortBy`/`sortDirection`/`page`/`pageSize`. Response: `{ "totalUnread": 1473 }`.

**`mark_alerts` request** (`PATCH`; `state` picks `/alerts/read` vs `/alerts/unread`; max 500 items):
```json
{ "state": "READ", "alerts": [{ "alertId": "515a7ddf-3c76-4928-9bb6-9d2dcb8a357c", "alertDate": "2026-05-27" }] }
```
`alertDate` is the `YYYY-MM-DD` slice of the alert's marketplace-local `datetime`. Response (partial success — one bad id does not fail the batch):
```json
{ "results": [{ "id": "515a7ddf-3c76-4928-9bb6-9d2dcb8a357c", "status": "SUCCESS" }] }
```
`status` ∈ `SUCCESS|ERROR`.

**`mark_alerts_by_filter` request** (`PATCH`; `state` picks `/alerts/read-all` vs `/alerts/unread-all`; same filters as `get_alerts`, no sort/paging):
```json
{ "state": "READ", "startDate": "2026-05-01", "endDate": "2026-05-31", "eventCategories": ["INVENTORY"] }
```
Response:
```json
{ "updatedCount": 12, "failedDates": [] }
```
`updatedCount` = alerts whose `read` flag actually flipped (already-in-state rows are skipped, not counted). `failedDates` = `YYYY-MM-DD` dates the op could not apply; the op is **idempotent**, so re-issue to retry just those. Bulk `*-all` is synchronous and can be slow over wide ranges (the handler uses a 90s timeout vs the 30s default).

## Conventions

- **`currencyCode`** is auto-resolved from the active seller (`mainCurrency`) — omit it from `propose_*` bodies. **`marketplace`** defaults to the active seller's `mainSalesChannel` when omitted; to target a connected non-default marketplace, pass its exact storefront string from `get_marketplaces` (an unconnected value returns `MARKETPLACE_NOT_AVAILABLE`). See ACTIONS.md "Marketplace handling".
- **Match-type casing**: SP uses UPPERCASE (`NEGATIVE_EXACT`/`NEGATIVE_PHRASE`); SB uses camelCase (`negativeExact`/`negativePhrase`). Positive variants on SP drop the prefix (`EXACT`/`PHRASE`/`BROAD`).
- **State casing varies by route** — see the ACTIONS.md "State case quirks" table for the full mapping. Zod rejects mismatches before the network call.
- **Create-state**: keywords / targets / negative-keywords accept only `"ENABLED"` on create. Campaigns / ad-groups / product-ads / portfolios accept `ENABLED` or `PAUSED`. To pause/archive after create, use the corresponding `propose_update_*` tool.
- **Budget shape**: campaigns use `budget.budget + budgetType`; portfolios use `budget.amount + policy`.
- **Update-body fields**: see the "Update-body fields per endpoint" allowlist above. The API 400s on any field outside that list — Zod schemas mirror the swagger.

## Keyword Relevancy dataset writes (`/v1/tools/relevancy/*`, `account:write`)

Distinct from the Amazon Ads writes above: these hit the Keyword Relevancy dashboard's API, are NOT multi-status, have NO dry-run and NO delete. `sellerId` + `marketplace` (storefront string) are injected from the active seller — omit them.

```jsonc
// propose_create_relevancy_dataset
{ "datasetName": "Premium Album — competitors",
  "asin": "B0B3V3791F",            // a seller-OWNED ASIN
  "competitorAsins": ["B0B96J9LL8", "B001VGC0AA"] }  // 1-10, runtime-required
//  -> { "datasetId": 187798 }      // NUMBER (not the UUID the swagger implies)

// propose_add_relevancy_dataset_asins  /  propose_remove_relevancy_dataset_asins
{ "dataSetId": 187798,              // camelCase `dataSetId` (capital S) — NOT `datasetId`
  "asins": ["B001VGC0AA"] }         // 1-10
//  -> { "success": true }
```

- **`dataSetId` camelCase quirk**: the read tool (`get_keyword_relevancy`) returns datasets keyed on `datasetId`, but the add/remove write body wants `dataSetId` (capital S). Use the numeric value from `availableDatasets[].datasetId`.
- **`create` returns a NUMBER** (`datasetId`), directly usable by add/remove/`get_keyword_relevancy` — the swagger's UUID example is wrong.
- **No dry-run, no delete**: a created dataset is permanent. Label test datasets; there is no endpoint to remove one.

```jsonc
// propose_relevancy_ranking_update  (marketplace injected)
{ "datasetId": 187821 }              // NOTE: datasetId (lowercase s), not dataSetId
//  -> { "success": true }           // returns immediately; recompute runs ASYNC

// propose_relevancy_cache_purge  (NO marketplace — even though it is injected
//                                  for the other relevancy writes)
{ "datasetId": 187821 }
//  -> { "success": true }
```

- **`ranking/update` is once/24h + ASYNC**: `{success}` means "accepted", not "done". Poll `get_relevancy_ranking_status` (`{ datasetId }` → `{ ongoing: boolean }`) until `ongoing:false`, then re-read.
- **`cache/purge` takes NO marketplace** (D-purge) — `{ sellerId, datasetId }` only. `ranking/update` DOES carry the injected marketplace. Note both use `datasetId` (lowercase s), unlike the add/remove `dataSetId`.

## Keyword Rank Tracker writes (`/v1/krt/*`, `account:write`)

Distinct from both the Amazon Ads writes and the relevancy writes: these are **partial-success batches** (NOT multi-status), have **NO dry-run**, but are **REVERSIBLE**. `sellerId` is injected from the active seller — omit it. `marketplace` is injected ONLY for `propose_track_keywords` (asin-scoped, US/DE/UK/CA); the by-id writes take NO marketplace.

```jsonc
// propose_track_keywords  (asin-scoped — marketplace injected, US/DE/UK/CA only)
{ "asin": "B0D1NMX2BS",
  "phrases": ["travel towel", "quick dry towel"] }   // 1-500
//  -> { "items": [ { "key": "travel towel", "status": "ALREADY_TRACKED" },
//                   { "key": "quick dry towel", "status": "SUCCESS" } ],
//       "summary": { "succeeded": 1, "skipped": 1, "failed": 0 } }
//  NOTE: items[].key is the PHRASE, NOT the new keywordRankTrackerId. Re-call
//  get_keyword_ranks (search by phrase) to resolve the id before labeling/tagging.

// propose_untrack_keywords  (by-id — NO marketplace)
{ "keywordRankTrackerIds": [1287188, 1287189] }       // 1-500
//  -> { "items": [ { "key": "1287188", "status": "SUCCESS" } ], "summary": {…} }

// propose_set_keyword_label  (PATCH — by-id)
{ "keywordRankTrackerIds": [1287188], "labelId": 46 } //  labelId: null CLEARS the label
//  -> { "items": [ { "key": "1287188", "status": "SUCCESS" } ], "summary": {…} }

// propose_add_keyword_tag  (by-id)
{ "keywordRankTrackerIds": [1287188], "tag": "launch-q3" }  // ≤120 chars; creates if new

// propose_remove_keyword_tags  (by-id — tagId, NOT keywordRankTrackerId)
{ "tagIds": [34930] }                                  // tagId from a row's tags[].tagId
```

- **Partial-success envelope**: `{ items:[{key,status,error?}], summary:{succeeded,skipped,failed} }`. `propose_track_keywords` status ∈ `SUCCESS | ALREADY_TRACKED | ERROR`; the rest ∈ `SUCCESS | ERROR`. Do NOT `parseMultiStatus`.
- **`items[].key` semantics**: track → the phrase; untrack/label/tag → the `keywordRankTrackerId`; remove-tags → the `tagId`.
- **`propose_set_keyword_label` is a PATCH** and `labelId: null` CLEARS the label (reversible).
- **Marketplace asymmetry**: only `propose_track_keywords` carries `marketplace` (injected). Sending `marketplace` on a by-id write is rejected.

## Keyword comment writes (`/v1/krt/comments`, `account:write`)

SINGLE-ITEM (NOT partial-success batches), REVERSIBLE (add ↔ remove), no dry-run, NO marketplace. `sellerId` injected from the active seller. A foreign/unknown `keywordRankTrackerId`/`commentId` returns an upstream **404** (the NestJS `{message,error,statusCode}` envelope) — never an empty success.

```jsonc
// propose_add_keyword_comment  (POST /v1/krt/comments)
{ "keywordRankTrackerId": 1029389,
  "commentDate": "2026-06-19",       // YYYY-MM-DD — the event date the note marks
  "commentText": "Price drop" }
//  -> { "comment": { "commentId": 32939, "keywordRankTrackerId": 1029389,
//                    "commentDate": "2026-06-19", "commentText": "Price drop",
//                    "createdAt": "…", "updatedAt": "…" },
//       "count": 1 }                 // active comments on the keyword after insert

// propose_edit_keyword_comment  (PATCH /v1/krt/comments — TEXT ONLY)
{ "commentId": 32939, "commentText": "Updated note" }   // NO commentDate
//  -> { "comment": { "commentId": 32939, …, "updatedAt": "…" } }  // updatedAt advances

// propose_remove_keyword_comment  (POST /v1/krt/comments/remove)
{ "commentId": 32939 }
//  -> { "success": true }
```

- **Wire `id` → `commentId`**: upstream returns the comment's primary key as `id`; the connector's L1 sanitizer strips any field named `id`, so the shape layer renames it to `commentId` BEFORE sanitization — that is the handle you pass to edit/remove.
- **Edit is text-only**: `commentDate` is not editable (the `KrtEditCommentRequestBody` carries only `commentId` + `commentText`).
- **404, not empty**: an unknown/foreign `keywordRankTrackerId` (add) or `commentId` (edit/remove) → `{"message":"Comment … was not found for this user","error":"Not Found","statusCode":404}`. Surface it as a 404, not a fabricated success.

## Keyword segments / comments / families reads (`/v1/krt/*`, `/v1/tools/relevancy/*`)

Reads — no approval. `sellerId` injected; segments need `marketplace` (asin-scoped, US/DE/UK/CA); comments are by `keywordRankTrackerId` (no marketplace); families/members need `marketplace` + `datasetId`.

```jsonc
// get_keyword_segments  (POST /v1/krt/segments/list)  -> { "segments": [...] }
{ "asin": "B0D1NMX2BS" }
//  -> { "segments": [ { "segmentId": 789, "name": "High intent",
//         "type": "CUSTOM_SEGMENT",            // IMPORTED_SET|CUSTOM_SEGMENT|MANUALLY_ADDED|MASTER_SET
//         "keywordRankTrackerIds": [1029102, 1029236],   // NO itemCount upstream
//         "keywordCount": 2 } ] }              // derived = keywordRankTrackerIds.length

// get_keyword_comments  (POST /v1/krt/comments/list)  — by-id, NO marketplace
{ "keywordRankTrackerId": 1029389 }
//  -> { "comments": [ { "commentId": 32939, "keywordRankTrackerId": 1029389,
//         "commentDate": "2026-06-19", "commentText": "…", "createdAt": "…",
//         "updatedAt": "…" } ] }
//  404 on an unknown keywordRankTrackerId — NOT an empty list.

// get_keyword_families  (POST /v1/tools/relevancy/keywords/families)
{ "datasetId": 187821, "ppcCheck": true }      // ppcCheck optional (adds inPpc/adTypes/matchTypes)
//  -> { "items": [ { "familyId": "family_1560217822",   // OPAQUE STRING, not a number
//         "rootPhrase": "scrapbook album", "memberCount": 5,
//         "inPpc": true, "adTypes": ["SP"], "matchTypes": ["EXACT"] } ],
//       "total": 2380, "page": 1, "pageSize": 5, "totalPages": 476, "hasNext": true }
//  ⚠ total (2380) is the KEYWORD count, NOT the family count.

// get_keyword_family_members  (POST /v1/tools/relevancy/keywords/families/members — PLURAL)
{ "datasetId": 187821, "familyId": "family_1560217822" }   // the singular …/family/members 404s
//  -> { "familyId": "…", "rootPhrase": "…", "members": [<relevancy keyword rows>],
//       "total": …, "page": …, "hasNext": … }

// get_relevancy_ranking_status  (POST /v1/tools/relevancy/dataset/ranking/update/status)
{ "datasetId": 187821 }
//  -> { "ongoing": false }                     // true while a recompute is running
```

- **`familyId` is an opaque STRING** (`"family_1560217822"`), not a number — pass it verbatim to `get_keyword_family_members`; never quote it to the user.
- **Members route is PLURAL** `…/keywords/families/members` — the announced singular `…/family/members` 404s.
- **`families.total` = keyword count, NOT family count** — it equals `get_keyword_relevancy`'s `total`.
- **`ppcCheck` is opt-in** (default off): adds `inPpc` / `adTypes` (SP/SB/SD) / `matchTypes` (EXACT/PHRASE/BROAD). The dataset-list competitors also gain `marketDepth` / `rankedKeywords`.
