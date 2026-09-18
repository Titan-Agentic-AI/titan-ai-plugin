# TitanConnect — Actions Reference (Amazon Ads writes — REAL MONEY)

**⚠️ Read this entire file before calling any `propose_*` tool. ⚠️**

Action tools modify the user's Amazon Advertising account. Every call may spend real money or change live ads. There is no automatic rollback.

## Prefer live writes over sheets

When a change can be made with the `propose_*` tools (and `tools:write` is granted), **make it live** — call the tool. Do **not** default to generating a bulk XLSX/CSV upload sheet for the user to apply by hand when a live write is available: the live path is auditable and applies immediately, whereas a sheet is an un-tracked manual step that often never gets uploaded.

Fall back to producing a sheet only when:
- the user **explicitly** asks for a downloadable file, or
- the operation isn't covered by the `propose_*` surface (e.g. a bulk operation with no corresponding write tool), or
- `tools:write` isn't granted (no write access on this connection).

## How approval works, and why you cannot rely on it

This server cannot ask the user anything. It has no channel to put a question in front of them mid-call, so **approval is the AI application's to ask for, not ours to promise.** Applications differ, the user can turn prompting off per tool, and some clients run tools with no interactive approval at all.

**Never tell the user they will be asked to approve a call. Assume they will not be.**

| Where the connection lives | Where the approval setting lives |
|------|------------------|
| Claude.ai web custom connector | Connector settings, per tool |
| Claude Desktop | Connector settings, per tool |
| Claude Code plugin | Permission rules in `~/.claude/settings.json` |
| Cowork | The app's tool permission settings |
| Automated or headless clients | No approval step exists. The call runs when you make it. |

**So narrate, every time.** Say what you are about to change, in plain prose, BEFORE you call a write tool. Your narration is the only safeguard you control, and on a client that never prompts it is the only one there is. When you bundle several writes into one response, narrate all of them first: nothing gets to interrupt you mid-batch.

## DANGER: "Always Allow" is your enemy

Where an application does offer a per-tool "Always Allow", turning it on removes the one check that application had. **Assume it may already be on, or that the application never asked in the first place.** A single misread sales report could spawn 10 campaigns at $500/day each, draining the user's ad budget overnight.

**Always tell users**: "I recommend reviewing every action call. Do NOT enable Always Allow for the propose_* tools."

## Action execution mode (`dryRun` field)

**Every `propose_*` call writes to Amazon for real by default. Production does NOT run in dry-run mode.** There is an env var `ACTIONS_FORCE_DRY_RUN=true` that forces simulation, but it is **not set in production**, so every propose_* call landing on prod spends real money or changes live ads.

**Never mention dry-run mode in user-facing prose.** Whether `dryRun` is true (staging / non-prod env) or false (production), the post-call message is the same: a one-or-two sentence natural-prose description of the change. The dry-run flag is environment-level plumbing — internal testers already know they're in a non-prod env; production users will never see dry-run; mentioning it adds confusion in both cases.

Forbidden post-call phrases include but are not limited to:
- "this was a simulation"
- "no Amazon-side change was made"
- "the call hit Nexus but was NOT pushed to Amazon"
- "the dryRun flag is true / false"
- "production runs LIVE" / any framing that compares this run to a hypothetical other run

Just describe what changed — same wording in either env. See the "Result presentation" section below.

Never assume dry-run mode is on. Your narration and the user's explicit yes in the conversation are the only safeguards before real spend.

## Multi-status responses

Every action returns:

```json
{
  "dryRun": true,
  "correlationId": "uuid",
  "success": [{ "index": 0, "<entityIdField>": "..." }],
  "error":   [{ "index": 1, "code": "...", "details": "..." }],
  "entityType": "sp.campaign"
}
```

The `<entityIdField>` name varies per tool — see `WIRE_FORMATS.md`. Partial-failure batches leave some items live on Amazon and others not. Narrate per-item: "Created campaign A (id 12345). Item 2 failed: duplicate name."

In dry-run mode most tools echo `dry-run-<index>` as the entity id. `propose_update_sd_campaign` is an exception — it echoes the actual `campaignId` you passed (different dry-run shape upstream). Either is fine; the narration is the same.

## Result presentation

Write-tool responses come back as a programmatic envelope: `{ dryRun, correlationId, success: [...], error: [...], entityType }`. **The user never sees this envelope.** Field names, raw API enums, post-read confirmations, and correlation IDs are diagnostic plumbing — they belong in audit logs, not in chat.

The post-call message is **one or two sentences of natural prose** describing what changed on the user's account. Nothing else.

### Good

- "Top of Search modifier raised to 25%. Product Pages stays at 10%."
- "Top of Search modifier removed. The campaign now uses the default bid for that placement."
- "Bid raised from $1.50 to $1.75."
- "Paused 3 keywords; 2 succeeded, 1 failed (duplicate name)."
- "Created campaign 'Brand Defense'."

These read identically whether the call ran in dry-run or live mode — see the dry-run section above for why.

### Forbidden — never appears in user-facing prose

| Don't write | Why | Write instead |
|---|---|---|
| `dryRun: false ✓ real write` | Field-name leak with checklist framing — looks like a debug dump | "The change has been applied to your campaign." |
| `error: [] ✓ no failures` | Same | (omit — silence implies success) |
| `success: [...]`, "the success array shows..." | Field-name leak | Describe the change in plain English |
| `correlationId: 8e827507-...` | Diagnostic ID — only surface if user asks how to escalate | Omit by default. If they ask, frame as "support reference: 8e827507". |
| `PLACEMENT_TOP`, `PLACEMENT_PRODUCT_PAGE`, `PLACEMENT_REST_OF_SEARCH` | Raw API enum | "Top of Search", "Product Pages", "Rest of Search" |
| `LEGACY_FOR_SALES`, `AUTO_FOR_SALES`, `MANUAL` | Raw bidding-strategy enum | "the campaign's current bidding strategy" / "automatic for sales" / "manual bidding" |
| `ENABLED`, `PAUSED`, `ARCHIVED` | Raw state enum | "active", "paused", "archived" (lowercase, prose form) |
| "Post-read confirms ..." / "verified against Amazon's response" / "the multi-status response shows..." | Internal verification plumbing — the user does not need to know there's a post-read | Just state the new value: "Top of Search is now 25%." |
| `entityType: sp.campaign` | Internal taxonomy | (omit) |
| "envelope returned..." / "dispatch result was..." | Internal jargon | Describe the outcome |

**The shape of every post-call message:** [what changed in user-visible terms], [optional: what stayed the same if they asked you not to touch it], [if dry-run: "this was a simulation"]. Stop there.

**Errors get the same treatment.** If the response carries `error: 'CAMPAIGN_NOT_FOUND'`, the user reads "I couldn't find that campaign in your account — can you double-check the id?" — not "tool returned `error: 'CAMPAIGN_NOT_FOUND'`".

This section governs the *post-call* prose. For pre-call prose, briefly acknowledge what you're about to do (one sentence is fine), then call the tool.

## Placement bid modifiers — use the dedicated tool

Placement bid modifiers — the percentage adjustments for Top of Search, Product Pages, and Rest of Search — write through the dedicated tool **`propose_update_sp_campaign_placement_modifiers`** (re-enabled 2026-05-07). Do **NOT** try to use `propose_update_sp_campaign` for these — its schema rejects any `bidding`/`dynamicBidding` fields and routes you to the dedicated tool instead.

When a user asks to change a placement modifier:

1. Source the campaign's current `biddingStrategy` (and current placement values for context) from `search_for_ppc_campaigns({campaignIds: [id]})`.
2. Call `propose_update_sp_campaign_placement_modifiers` with `{campaignId, dynamicBidding: {strategy, placementBidding: [...]}}`. **Strategy is REQUIRED** by Amazon — pass the existing one unless you intend to change it.
3. Trust Amazon's merge-by-placement-key semantic: send only the placements you want to change; placements not mentioned are preserved (verified 2026-05-07). Send `{placement, percentage: 0}` to **remove** a single placement. `placementBidding: []` and omitting the key entirely are both no-ops — to clear all modifiers, send `0` for each currently-set placement.

The tool reads the campaign before and after the write and only records SUCCESS in `action_logs` when the post-read confirms the change landed (D2 mitigation). Watch for `ARCHIVED_NOT_EDITABLE` (unarchive first via `propose_update_sp_campaign`) or `WRITE_VERIFICATION_FAILED` (Nexus 200 but post-read disagrees — forensics in `action_logs`).

**Forbidden:**

- Do **NOT** route users to Seller Central for placement-modifier changes. The dedicated tool is live.
- Do **NOT** propose creative workarounds like encoding the modifier value in the campaign name (e.g. renaming to "...100 TOS"). The encoded name does not affect bidding behavior.
- Do **NOT** put placement fields on `propose_update_sp_campaign`. Use `propose_update_sp_campaign_placement_modifiers`.

## Marketplace handling

By default, `marketplace` resolves to the active seller's default storefront (`mainSalesChannel`, e.g. `"Amazon.com"`, `"Amazon.co.uk"`) — so for a single-marketplace seller, **omit it**.

For a multi-marketplace account (one seller spanning e.g. Amazon.co.uk + Amazon.de), to act on a **non-default** marketplace:

1. Call `get_marketplaces` to list the seller's connected storefronts.
2. Pass the exact storefront string (e.g. `"Amazon.de"`) as `marketplace` on the `propose_*` / `get_sp_bid_recommendations` / `propose_update_sp_campaign_placement_modifiers` / `get_ppc_negative_targets` call.

Omit `marketplace` to use the default. A value that isn't one of the seller's connected marketplaces returns `MARKETPLACE_NOT_AVAILABLE` (with the valid list in `available`) — re-issue with a listed storefront. Campaign / ad-group / keyword IDs are marketplace-specific: target the marketplace the IDs belong to.

## Keyword Relevancy dataset writes (`account:write` — NOT Amazon Ads)

Five writes touch the seller's Titan Tools **Keyword Relevancy datasets** instead of their Amazon Advertising account: `propose_create_relevancy_dataset`, `propose_add_relevancy_dataset_asins`, `propose_remove_relevancy_dataset_asins`, `propose_relevancy_ranking_update`, `propose_relevancy_cache_purge`. They behave differently from the Amazon Ads writes above:

- **No dry-run, no delete.** Upstream `/v1/tools/relevancy/*` has no dry-run, so these execute the moment you call them — in EVERY environment, including staging. A created dataset CANNOT be removed via the API (there is no delete endpoint). Confirm intent before calling, and label throwaway/test datasets clearly (they leave permanent residue).
- **Not multi-status.** They return the raw `{ datasetId }` (create — a NUMBER, e.g. `187798`) or `{ success: true }` (add/remove/ranking-update/cache-purge), plus a `correlationId`. There is no `success[]`/`error[]` array — a thrown upstream error surfaces as a structured `{ error, message }`.
- **Auth is handled server-side** — no re-link needed. The write runs under the user's OAuth grant when it carries write access, otherwise it transparently falls back to the server credential. (Upstream requires `account:write`; the OAuth client cannot grant that scope yet — raised with upstream 2026-06-11 — so the server-credential fallback is currently the active path.)
- **Body shapes** (see `WIRE_FORMATS.md`): create takes `{ datasetName, asin, competitorAsins:[1-10], marketplace }`; add/remove take `{ dataSetId, asins:[1-10], marketplace }` — note `dataSetId` is **camelCase** (capital S), unlike the `datasetId` the read tool returns. sellerId is injected from the active seller. `marketplace` is REQUIRED and is the storefront the dataset is written on: pass a value from `get_marketplaces` verbatim. A storefront the seller is not connected to is refused with `MARKETPLACE_NOT_AVAILABLE` and the valid list — it is never rerouted. **It must also be the storefront the session is pinned to** (or the home storefront when nothing is pinned): the relevancy READS take no marketplace of their own, so a write anywhere else could not be read back, and is refused with `MARKETPLACE_NOT_READABLE` naming both storefronts. To work on another one, call `set_active_seller({ storeName, marketplace })` first, then pass that same value here.
- **`propose_relevancy_ranking_update` is a REAL recompute, once per 24h, ASYNC.** It returns `{ success }` immediately but the recompute runs in the background — poll `get_relevancy_ranking_status` (`{ ongoing }`) until false, then re-read `get_keyword_relevancy` / `get_keyword_families`. Body: `{ datasetId, marketplace }` — the marketplace you pass is the one recomputed. **The poll and the re-reads take NO marketplace**: they follow the session pin, else the home storefront. That is why the write refuses a storefront the session is not pointed at — otherwise the poll would query a storefront where nothing is running, return `ongoing:false` on the first call, and you would report a recompute that never happened. **`propose_relevancy_cache_purge`** drops the dataset's cached ranking results (`{ datasetId }` — **NO marketplace**); returns `{ success }`.

Result presentation: same natural-prose rule as the Amazon Ads writes — e.g. "Created a relevancy dataset for B0… seeded with 3 competitors." Never surface the raw envelope or correlationId.

## Keyword Rank Tracker writes (`account:write` — NOT Amazon Ads)

Five writes manage what the seller tracks in the **Keyword Rank Tracker** (`/v1/krt/*`): `propose_track_keywords`, `propose_untrack_keywords`, `propose_set_keyword_label`, `propose_add_keyword_tag`, `propose_remove_keyword_tags`. They behave differently from both the Amazon Ads writes and the relevancy writes:

- **No dry-run, but REVERSIBLE.** Upstream has no dry-run (they execute the moment you call them, every environment), but each is undoable: untrack reverses track, a `null` label clears a label, remove-tag reverses add-tag. The tool description says "REAL, IMMEDIATE, but reversible" — distinct from the relevancy writes' "IRREVERSIBLE".
- **Partial-success batches (NOT multi-status).** They return `{ items: [{ key, status, error? }], summary: { succeeded, skipped, failed } }` + a `correlationId`. This is NOT the Amazon Ads `success[]`/`error[]` shape. Inspect each item: `propose_track_keywords` per-item status ∈ `SUCCESS | ALREADY_TRACKED | ERROR` (ALREADY_TRACKED counts under `summary.skipped`); the others ∈ `SUCCESS | ERROR`. The connector writes one `action_logs` row per item.
- **`propose_track_keywords` does NOT return the new id.** `items[].key` echoes the *phrase*, not the new `keywordRankTrackerId`. To label/tag a just-added keyword, re-call `get_keyword_ranks` (with `search`) to resolve its id first.
- **Auth is handled server-side** — same user-OAuth-first → server-credential fallback as the relevancy writes.
- **Body shapes** (see `WIRE_FORMATS.md`): `propose_track_keywords` is asin-scoped — `{ asin, phrases:[1-500], marketplace }`, where `marketplace` is REQUIRED and is the storefront the keywords are tracked on (US/DE/UK/CA only). It is validated against the seller's connected marketplaces and refused with `MARKETPLACE_NOT_AVAILABLE` if they do not have it. NOTE the write does NOT read the session marketplace pin — on a pinned session, name the pinned storefront yourself. There is no omit-for-home fallback: the field is required, so a call without it is rejected before it runs. The other four are by-id and take NO marketplace: `propose_untrack_keywords` `{ keywordRankTrackerIds:[1-500] }`; `propose_set_keyword_label` `{ keywordRankTrackerIds, labelId }` (`labelId: null` clears); `propose_add_keyword_tag` `{ keywordRankTrackerIds, tag }`; `propose_remove_keyword_tags` `{ tagIds }`. sellerId is injected from the active seller.

Result presentation: natural prose — e.g. "Now tracking 3 new keywords (1 was already tracked)." Never surface the raw envelope, item statuses verbatim, or correlationId.

## Keyword comment writes (`account:write` — NOT Amazon Ads)

Three writes manage member **comments** (notes) on a tracked keyword (`/v1/krt/comments`): `propose_add_keyword_comment`, `propose_edit_keyword_comment`, `propose_remove_keyword_comment`. They differ from the KRT keyword writes above:

- **SINGLE-ITEM, NOT partial-success batches.** add → `{ comment, count }` (the keyword's active-comment count after insert); edit → `{ comment }`; remove → `{ success }` — each plus a `correlationId`. There is no `items[]`/`summary`. The connector writes ONE `action_logs` row.
- **REVERSIBLE (add ↔ remove), no dry-run.** A `null` is never returned for a missing item — a foreign/unknown `keywordRankTrackerId` (add) or `commentId` (edit/remove) returns an upstream **404**. Surface that as "that keyword/comment isn't yours" — never fabricate success.
- **`propose_add_keyword_comment` returns a `commentId`** (after the connector's `id`→`commentId` shaping). Use it for a later `propose_edit_keyword_comment` / `propose_remove_keyword_comment`. **Edit changes the TEXT ONLY** — there is no editable `commentDate`.
- **By-id — NO marketplace.** add: `{ keywordRankTrackerId, commentDate (YYYY-MM-DD), commentText }`; edit: `{ commentId, commentText }`; remove: `{ commentId }`. sellerId is injected from the active seller. The `keywordRankTrackerId` comes from a `get_keyword_ranks` row or a `get_keyword_segments` segment.

Result presentation: natural prose — e.g. "Added your note to that keyword." Never surface the raw envelope, commentId, or correlationId.

## Compass writes (NOT Amazon Ads)

Three writes change the seller's **Compass** inventory planning in Titan Tools (`/v1/compass/*`): `propose_save_compass_suppliers`, `propose_delete_compass_supplier`, `propose_update_compass_product_configs`. Compass is part of Titan, never an external system or a connector: when the user mentions Compass, use these tools and the two Compass reads, not a custom connector. They appear only while Compass is enabled on the server; if they are not in your tool list, Compass is not available to this account.

- **No dry-run.** Each executes the moment you call it, in every environment. Confirm the exact change with the user first.
- **Nothing is recalculated.** A successful write does NOT recompute the forecast, the Demand Plan or the Purchase Orders. Every success carries `recalculationNotice`: tell the user, in plain words, that Compass has NOT recalculated those yet and that they should open Compass and accept the recompute prompt before relying on them.
- **`propose_save_compass_suppliers`** creates (omit `supplierId`; `supplierName` is then required) or updates (send a `supplierId` from `get_compass_suppliers`) 1-200 suppliers, changing only the fields sent. ATOMIC: one invalid row refuses the whole call and nothing is written. Updating a supplier also changes the terms on EVERY SKU linked to it, so list those SKUs first (`get_compass_product_configs` with that `supplierId`). Returns `{ suppliers: [{ index, action: created | updated, supplier }], summary, recalculationNotice }`.
- **`propose_delete_compass_supplier`** deletes ONE supplier by `supplierId`. There is NO restore: creating it again gives a new `supplierId`. Linked SKUs are NOT unlinked; they keep its last terms and still show its `supplierId`, so list them first and offer to relink them. An unknown or already-deleted id fails with `COMPASS_NOT_FOUND` and deletes nothing.
- **`propose_update_compass_product_configs`** changes 1-200 SKU entries, each named by `salesChannel` + `sku` exactly as on a `get_compass_product_configs` row: `supplierId`, `shippingPaid` (`at_booking` | `on_arrival`), and `demandPlan` (`minStockDays`, `ctnSize`, `targetDaysOfStock`, `moq`, `lowPriceTierMoq`; `null` clears one). A SKU can be relinked but NEVER unlinked, and its config cannot be deleted. PARTIAL SUCCESS inside one successful call: read `results[i].status` for EVERY entry and never say an entry changed unless it is `SUCCESS`. `concurrencyConflict: true` means NOT applied (re-read that SKU, then resend it); `NO_RESULT` means it MAY have applied (re-read before resending). If no entry succeeded, the call fails with `WRITE_ALL_ITEMS_FAILED`.
- **Auth is handled server-side**, the same user-OAuth-first then server-credential fallback as the KRT writes. `sellerId` is injected from the active seller; there is no `marketplace` field.

Result presentation: natural prose, e.g. "Set the MOQ for that SKU on Amazon.com to 500. Compass has not recalculated your forecast, Demand Plan or Purchase Orders yet, so open Compass and accept the recompute prompt before relying on them." Never surface the raw envelope, `supplierId`, or `correlationId`.

## Verified status (post-audit, 2026-05-05 — adds 9 negative-keyword UPDATE + negative-target CRUD tools)

| Tool | Result | Notes |
|------|--------|-------|
| `propose_create_sp_portfolio` | ✅ | State ∈ {ENABLED, PAUSED} only (no ARCHIVED). |
| `propose_update_sp_portfolio` | ✅ | State ∈ {ENABLED, PAUSED} only. |
| `propose_create_sp_campaign` | ✅ | Use `budget.budget`, not `budget.amount`. State ∈ {ENABLED, PAUSED}. |
| `propose_update_sp_campaign` | ✅ | **No `startDate` and no `tags` on update** (verified rejected with 400). For placement bid modifiers, use `propose_update_sp_campaign_placement_modifiers`. |
| `propose_update_sp_campaign_placement_modifiers` | ✅ | **NEW 2026-05-07.** Single-campaign target. Full upstream `dynamicBidding` shape — `strategy` REQUIRED, `placementBidding[]` optional. Amazon merges by placement key; `percentage: 0` removes the placement; `placementBidding: []` and omitting the key are no-ops. Pre-read rejects ARCHIVED + captures `oldValue`; post-read verifies the modifier landed. action_logs row written with both pre/post snapshots; `WRITE_VERIFICATION_FAILED` if observed ≠ requested (D2 mitigation). |
| `propose_create_sp_campaign_neg_keyword` | ✅ | State must be `"ENABLED"` only. success.campaignNegativeKeywordId. |
| `propose_update_sp_campaign_neg_keyword` | ✅ | **NEW 2026-05-05.** UPPERCASE 3-value state. success.campaignNegativeKeywordId. State-only update. |
| `propose_create_sp_ad_group` | ✅ | State ∈ {ENABLED, PAUSED}. |
| `propose_update_sp_ad_group` | ✅ | UPPERCASE state. Pause / change defaultBid / change name. |
| `propose_create_sp_keyword` | ✅ | State must be `"ENABLED"` only — use update to pause after create. |
| `propose_update_sp_keyword` | ✅ | UPPERCASE state. Pause / change bid. |
| `propose_create_sp_ad_group_neg_keyword` | ✅ | State must be `"ENABLED"` only. success.keywordId. |
| `propose_update_sp_ad_group_neg_keyword` | ✅ | **NEW 2026-05-05.** UPPERCASE 3-value state. success.**negativeKeywordId** (NOT keywordId). State-only. |
| `propose_create_sp_campaign_neg_target` | ✅ | **NEW 2026-05-05.** Wrapper key `campaignNegativeTargetingClauses`. UPPERCASE_SNAKE expression types (`ASIN_SAME_AS`/`ASIN_BRAND_SAME_AS`); expression SINGULAR. State `ENABLED` only. success.**campaignNegativeTargetingClauseId** (long-form). |
| `propose_update_sp_campaign_neg_target` | ✅ | **NEW 2026-05-05.** UPPERCASE 3-value state. State-only. |
| `propose_create_sp_ad_group_neg_target` | ✅ | **NEW 2026-05-05.** Wrapper key `negativeTargetingClauses`. UPPERCASE_SNAKE expression types; expression SINGULAR. State `ENABLED` only. success.targetId (short-form). |
| `propose_update_sp_ad_group_neg_target` | ✅ | **NEW 2026-05-05.** UPPERCASE 3-value state. State-only. |
| `propose_create_sp_target` | ✅ | State must be `"ENABLED"` only. |
| `propose_update_sp_target` | ✅ | ASIN/category targets only — keyword IDs go through `propose_update_sp_keyword`. |
| `propose_create_sp_product_ad` | ✅ | State ∈ {ENABLED, PAUSED}. |
| `propose_update_sp_product_ad` | ✅ | UPPERCASE state. |
| `propose_update_sb_campaign` | ✅ | UPPERCASE state. **No `startDate` on update** (verified rejected). |
| `propose_update_sb_ad_group` | ✅ | UPPERCASE state ∈ {ENABLED, PAUSED} only (no ARCHIVED). **No `defaultBid`** (verified rejected). |
| `propose_update_sb_ad` | ✅ | UPPERCASE state ∈ {ENABLED, PAUSED} only. |
| `propose_update_sb_keyword` | ✅ | **lowercase** state. Items require `keywordId` + `adGroupId` + `campaignId`. |
| `propose_update_sb_target` | ✅ | **NEW 2026-05-02. lowercase** state. Items require `targetId` + `adGroupId` + `campaignId`. |
| `propose_create_sb_ad_group_neg_keyword` | ✅ | **NEW 2026-05-02. matchType is camelCase** (`negativeExact`/`negativePhrase`) — DIFFERENT from SP. No `state` field. |
| `propose_update_sb_ad_group_neg_keyword` | ✅ | **NEW 2026-05-05. lowercase** state. Items require `keywordId` + `adGroupId` + `campaignId`. Flat-array response (same shape as SB keyword UPDATE). |
| `propose_create_sb_ad_group_neg_target` | ✅ | **NEW 2026-05-05.** Body key `negativeTargets`; per-item field `expressions` (PLURAL). camelCase types (`asinSameAs`/`asinBrandSameAs`). No `state` field — implicit ENABLED. Envelope shape `{createTargetSuccessResults, createTargetErrorResults}` — adapter normalizes to canonical multi-status. |
| `propose_update_sb_ad_group_neg_target` | ✅ | **NEW 2026-05-05. lowercase** state. Items require `targetId` + `adGroupId`. Envelope shape `{updateTargetSuccessResults, updateTargetErrorResults}` — same adapter as create. |
| `propose_update_sd_campaign` | ✅ | **lowercase** state — fixed 2026-05-02 (was incorrectly UPPERCASE in our schema). **No `startDate` on update**. |
| `propose_update_sd_ad_group` | ✅ | **lowercase** state. Flat-array response. |
| `propose_update_sd_product_ad` | ✅ | **lowercase** state. Flat-array response. |
| `propose_update_sd_target` | ✅ | **NEW 2026-05-02. lowercase** state. Just `targetId` + optional state/bid. |
| `get_sp_bid_recommendations` | ✅ | Read-only; p50 ≈ 40s |
| `propose_create_relevancy_dataset` | ✅ | **NEW 2026-06-11.** `account:write`. `{datasetName, asin, competitorAsins:[1-10], marketplace}` — marketplace required, ownership-validated. Returns numeric `datasetId`. NO dry-run, NO delete. |
| `propose_add_relevancy_dataset_asins` | ✅ | **NEW 2026-06-11.** `{dataSetId, asins:[1-10], marketplace}` (camelCase `dataSetId`; marketplace required, ownership-validated). Returns `{success}`. |
| `propose_remove_relevancy_dataset_asins` | ✅ | **NEW 2026-06-11.** `{dataSetId, asins:[1-10], marketplace}` (marketplace required, ownership-validated). Returns `{success}`. |
| `propose_track_keywords` | ✅ | **NEW 2026-06-15.** `account:write`. asin-scoped: `{asin, phrases:[1-500], marketplace}` — required, ownership-validated, US/DE/UK/CA. Does NOT read the pin. Partial-success `{items,summary}`; per-item SUCCESS/ALREADY_TRACKED/ERROR. `items[].key`=phrase (NOT the new id). REVERSIBLE. |
| `propose_untrack_keywords` | ✅ | **NEW 2026-06-15.** by-id: `{keywordRankTrackerIds:[1-500]}` (no marketplace). Reverses track. |
| `propose_set_keyword_label` | ✅ | **NEW 2026-06-15.** PATCH. `{keywordRankTrackerIds, labelId}` — `labelId:null` clears. |
| `propose_add_keyword_tag` | ✅ | **NEW 2026-06-15.** `{keywordRankTrackerIds, tag}` (≤120 chars; creates tag if new). |
| `propose_remove_keyword_tags` | ✅ | **NEW 2026-06-15.** `{tagIds}` (from a `get_keyword_ranks` row's `tags[].tagId`). |
| `propose_add_keyword_comment` | ✅ | **NEW 2026-06-19.** `account:write`. SINGLE-ITEM (not batch): `{keywordRankTrackerId, commentDate, commentText}` (no marketplace) → `{comment, count}`; comment carries a `commentId`. REVERSIBLE; 404 on a foreign id. |
| `propose_edit_keyword_comment` | ✅ | **NEW 2026-06-19.** `{commentId, commentText}` — text ONLY, no date → `{comment}`. 404 on a foreign/unknown id. |
| `propose_remove_keyword_comment` | ✅ | **NEW 2026-06-19.** `{commentId}` → `{success}`. Reverses add. 404 on a foreign/unknown id. |
| `propose_relevancy_ranking_update` | ✅ | **NEW 2026-06-19.** `account:write`. `{datasetId, marketplace}` (required, ownership-validated) → `{success}`. REAL recompute, once/24h, ASYNC — poll `get_relevancy_ranking_status` (`{ongoing}`). |
| `propose_relevancy_cache_purge` | ✅ | **NEW 2026-06-19.** `{datasetId}` (**NO marketplace**) → `{success}`. Drops cached ranking results. |

### State case quirks (read this carefully)

State casing varies by route. Mismatch fails at Zod validation before any network call.

| Tools | State case |
|-------|------------|
| **lowercase** | `propose_update_sb_keyword`, `propose_update_sb_target`, `propose_update_sb_ad_group_neg_keyword`, `propose_update_sb_ad_group_neg_target`, `propose_update_sd_campaign`, `propose_update_sd_ad_group`, `propose_update_sd_product_ad`, `propose_update_sd_target` |
| UPPERCASE 3 values (ENABLED/PAUSED/ARCHIVED) | All SP routes, `propose_update_sb_campaign` |
| UPPERCASE 2 values (ENABLED/PAUSED only) | `propose_create_sp_portfolio`, `propose_update_sp_portfolio`, `propose_create_sp_campaign`, `propose_create_sp_ad_group`, `propose_create_sp_product_ad`, `propose_update_sb_ad_group`, `propose_update_sb_ad` |
| `"ENABLED"` only on create | `propose_create_sp_keyword`, `propose_create_sp_target`, `propose_create_sp_campaign_neg_keyword`, `propose_create_sp_ad_group_neg_keyword`, `propose_create_sp_campaign_neg_target`, `propose_create_sp_ad_group_neg_target` |
| No `state` field at all (state implicit ENABLED) | `propose_create_sb_ad_group_neg_keyword`, `propose_create_sb_ad_group_neg_target` |

### Negative-keyword matchType case quirk

| Tool | `matchType` case |
|------|------------------|
| `propose_create_sp_campaign_neg_keyword` | UPPERCASE: `NEGATIVE_EXACT` / `NEGATIVE_PHRASE` |
| `propose_create_sp_ad_group_neg_keyword` | UPPERCASE: `NEGATIVE_EXACT` / `NEGATIVE_PHRASE` |
| `propose_create_sb_ad_group_neg_keyword` | **camelCase**: `negativeExact` / `negativePhrase` |

> The matchType case-quirk only applies to CREATE — UPDATEs are state-only and do not carry `matchType`.

### Negative-target expression-type case quirk

| Tool | `expression[].type` case | Field name |
|------|--------------------------|-----------|
| `propose_create_sp_campaign_neg_target` | UPPERCASE_SNAKE: `ASIN_SAME_AS` / `ASIN_BRAND_SAME_AS` | `expression` (singular) |
| `propose_create_sp_ad_group_neg_target` | UPPERCASE_SNAKE: `ASIN_SAME_AS` / `ASIN_BRAND_SAME_AS` | `expression` (singular) |
| `propose_create_sb_ad_group_neg_target` | **camelCase**: `asinSameAs` / `asinBrandSameAs` | **`expressions`** (PLURAL) |

## Failure modes

| Result | Meaning | What to do |
|--------|---------|-----------|
| `MUST_SET_ACTIVE_ACCOUNT` | No Titan Tools account active | Call `list_accounts` → `switch_account` first |
| `NO_ACTIVE_SELLER` | No seller selected | Call `list_seller_accounts` → `set_active_seller` |
| `OAUTH_REFRESH_FAILED` | Refresh token rotated/expired | Tell the user to reconnect at <https://titanconnect.titannetwork.com> |
| `OAUTH_REFRESH_REVOKED` | Upstream rejected the refresh as invalid/expired | Same as above — re-link |
| `OAUTH_REFRESH_NETWORK` | Transient network/5xx during refresh | Retry once; if persists, surface error to user |
| `INSUFFICIENT_SCOPE` | OAuth grant lacks `tools:write` (Amazon Ads writes only — the relevancy dataset writes auto-fall-back to the server credential and do not surface this) | Ask the user to re-link (`link_account`) with the missing scope |
| `NEXUS_CALL_FAILED` | Nexus 5xx or transport error | Surface the error message; do NOT retry without LIST-ing first to verify state |
| `error.length > 0` | Partial multi-status failure | Narrate per-item; some items succeeded, some failed |

## Common rollback recipes

| Action | How to undo |
|--------|-------------|
| Created campaign | `propose_update_sp_campaign` with `state: ARCHIVED` |
| Created keyword | `propose_update_sp_target` with `state: ARCHIVED` (or per-entity equivalent) |
| Updated budget | Re-`propose_update_sp_campaign` with the prior budget value |
| Added neg keyword | `propose_update_sp_*_neg_keyword` (or `propose_update_sb_ad_group_neg_keyword`) with `state: ARCHIVED` (or `archived` for SB). |
| Added neg target | `propose_update_sp_*_neg_target` (or `propose_update_sb_ad_group_neg_target`) with `state: ARCHIVED` (or `archived` for SB). |

A rollback is a write like any other. Narrate it before you call it, and do not assume anything will ask the user first.

## Critical rules summary (in priority order)

1. **Knowledge before action.** Even action requests trigger the source-of-truth principle — call `titan_lessons` for the strategic rationale before proposing the write. The action narration must cite the Titan source.
2. **Bundle only after narrating all of it.** Multiple `propose_*` calls in one response are fine for batch negation / batch pausing / multi-step plans, but nothing is guaranteed to interrupt you between them. Say what the whole batch will change before the first call, not after the last.
3. **Acknowledge before acting.** Briefly say what you're about to do (one sentence is fine), then proceed.
4. **No "Always Allow" nudge.**
5. **Inspect the multi-status `error[]`.** Empty `error` is the only success.
6. **No fabricated IDs** — campaignId, adGroupId, keywordId, targetId all come only from this turn's tool results.
7. **Marketplace defaults to the active seller's storefront** — omit `marketplace` unless you're targeting a connected non-default marketplace, in which case pass its exact storefront string from `get_marketplaces` (see "Marketplace handling").
8. **Inspect `dryRun` on every response.** Production runs with `dryRun: false` — every call is real. `dryRun: true` only appears in non-prod environments and means simulation. Say which one occurred explicitly.

If a `propose_*` tool returns `MUST_SET_ACTIVE_ACCOUNT`, call `switch_account` first, then `set_active_seller`, then re-attempt the propose call.

## Alert read-state actions (OAuth `tools:write` — NOT Amazon Ads writes)

`mark_alerts` and `mark_alerts_by_filter` change an alert's READ/UNREAD state. They are write tools (OAuth `tools:write`/`mcp` scope, same gating as the `propose_*` tools above) but they are a different class entirely: **no money, no live-ad change, no `dryRun` field, no multi-status `success[]`/`error[]` envelope.** They execute immediately (not proposals) and are fully **reversible** — re-mark with the opposite `state` to undo. The `propose_*` dryRun / multi-status / "Always Allow" protocol does NOT apply to these two tools.

| Tool | Effect |
|------|--------|
| `mark_alerts` | Mark specific alerts read/unread. Params: `state` (READ/UNREAD), `alerts` (array of `{ alertId, alertDate }`, max 500). `alertId` = `items[].id` from `get_alerts`; `alertDate` = the YYYY-MM-DD slice of that alert's `datetime`. Returns `{ results: [{ id, status }] }` with per-alert `SUCCESS`/`ERROR` — partial success, one bad id does not fail the batch. |
| `mark_alerts_by_filter` | Bulk-mark every alert in a window + filter read/unread. Params: `state` (READ/UNREAD), `startDate`, `endDate` (≤180 days), + the same filters as `get_alerts`. Returns `{ updatedCount, failedDates }` — `updatedCount` is alerts whose flag actually changed; re-issue to retry `failedDates` (idempotent). Can be slow over wide ranges. |

Confirm intent before bulk-marking a wide range, but no per-item approval dance is needed — these are low-stakes and reversible. Read the alerts first via `get_alerts` (a data tool) to get the `alertId`/`alertDate` pairs.
