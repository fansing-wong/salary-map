# Social platform work-experience observations

This feature provides a cautious evidence layer for workers' self-reported experience. It is separate from official wage data, job-offer data, and the recommendation score.

## Current scope

The project includes a keyword aggregator and a China dashboard view. The aggregator accepts a locally held, authorized JSON or JSONL export; it does **not** sign in to a platform, crawl pages, or make network requests. No platform credentials or raw post data belong in this repository. The dashboard is intentionally empty until a maintainer obtains a permitted data source and imports a dataset.

This boundary matters because public visibility alone does not establish permission for bulk collection or reuse. Weibo's official CLI requires developer verification and an enabled service, with access depending on available commands and quota. Xiaohongshu's public developer documentation describes an e-commerce open platform and does not establish a general public-post research API. Reddit requires access through its Data API within its terms and limits. Check the platform's current terms and the applicable privacy rules before each integration; the Personal Information Protection Law limits processing of public personal information to a reasonable scope and provides additional requirements where processing significantly affects individuals.

Official references: [Weibo CLI quick start](https://open.weibo.com/cli/quickstart), [Xiaohongshu developer documentation](https://open.xiaohongshu.com/document/developer/file/33), [Reddit Data API Terms](https://redditinc.com/policies/data-api-terms), and [Personal Information Protection Law, Article 27](https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm).

## Import format

Normalize the authorized export to JSON or JSONL records with these fields:

```json
{"id":"temporary-source-id","created_at":"2026-10-01T08:00:00+08:00","text":"在杭州做测试经常加班，五险一金正常","city":"杭州市","role":"软件测试","employer_type":"民营企业"}
```

`id` is used only in memory to deduplicate rows. `text` is scanned in memory and is never written to the aggregate. `city` and `role` must be structured, broad categories supplied by the authorized source or your own approved coding process; the script does not infer them from the text. `employer_type` is optional and accepts only broad whitelisted categories: government/civil service, public institution, state-owned enterprise, private enterprise, foreign/joint venture, individual/freelance/platform work, and other organization. Unrecognized values (including company names) become `未分类`. Do not map or export account names, company names, exact addresses, contact details, post URLs, or other identifying labels into these fields. Rows with an empty text are ignored. Duplicate IDs (or duplicate text when IDs are absent) are counted once.

Run the aggregator locally, replacing the example path and metadata with the source you are permitted to use:

```powershell
python scripts/aggregate_social_observations.py .\private\authorized-export.jsonl --platform weibo --source-name "authorized API export" --source-url "https://open.weibo.com/cli/quickstart" --query-label "杭州 软件测试 工作体验 2026-10"
```

The generated `data/social_observations.json` is an aggregate suitable for review. Re-running the same platform/source/query replaces that dataset; a different query creates a separate dataset. Inspect the aggregate and verify that it contains no sensitive categories or identifying labels before committing it. Keep API tokens in a local secret store or GitHub Actions secrets only if a later approved adapter requires them; never place tokens in a URL, command history, source file, or exported JSON.

## What is measured

Each post contributes at most one mention to each matching theme, irrespective of how many keywords from that theme appear in the text. Current themes are work time/overtime, pay/bonuses, benefits, job stability, workload/stress, and management/team environment. For each city/role/employer-type/month group, the dashboard shows:

`topic mention rate = posts matching at least one theme keyword / non-empty, deduplicated posts in the group`

Groups below 30 posts suppress exact sample size, mention counts, and rates. Thirty is a conservative project display heuristic, not a legal threshold, anonymity guarantee, or statistical confidence bound. The exact corpus total is not published. The script writes only aggregate labels, counts for unsuppressed groups, topic rates, dataset metadata, and caveats.

In the dashboard, choose a batch, topic, role, broad employer type, month, and region. The newest reported month is selected by default when available; use the month selector for an explicit same-period comparison. The batch control shows when the export was collected, while the note reports the newest post month found in the export; collection date and post date are different things.

## How to read it

- A mention rate is not sentiment, satisfaction, truth verification, the prevalence of a workplace condition, or an estimate for all workers in that city or occupation.
- Keyword matching is literal and context-blind. Negation, sarcasm, quoted speech, repeated reposts, and ambiguous wording can create false matches or misses.
- Social posts are self-selected and the search query, platform, moderation, time window, and API visibility all shape the sample. Compare only batches with clearly understood and similar collection methods.
- The view does not infer salary, working hours, actual hourly pay, employer ownership, credential requirements, or migration eligibility. It does not affect job recommendations.
- Suppression reduces exposure from tiny groups but cannot guarantee anonymity. Review the aggregate for re-identification risk before publication and omit batches where labels or context could identify people.

## Adding an automatic source adapter

An adapter should be added only after confirming the platform grants the required read/search scope for this use, the account has valid access, the data may be retained and redistributed as aggregates, and any quota/cost is acceptable. It must use the platform's documented authentication, limits, and attribution rules; store tokens outside Git; normalize into the import schema; and retain raw text only as long as necessary for local aggregation. A GitHub Actions schedule must not be enabled until those conditions and the refresh behavior are verified for that specific platform. The existing workflow does not crawl social platforms.
