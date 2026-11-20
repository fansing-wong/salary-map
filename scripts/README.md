# Data pipeline

The project accepts openly published CSV datasets only. Each source entry must identify its publisher, URL, update cadence and license. The collector checks `robots.txt`, uses a descriptive User-Agent, applies a per-host delay, sends conditional HTTP requests, validates a fixed schema, and records retrieval time and source metadata. It does not bypass authentication, CAPTCHAs, rate limits, or access controls.

For social networks, use only a documented API with the required app approval and data scope. LinkedIn's Posts API, for example, restricts read permissions for member content to approved users; this project does not scrape logged-in feeds. Social posts can be treated as dated job-posting observations only, never as representative salary averages. Aggregate and label them separately.

`python scripts/update_data.py` reads `sources.json` and writes `data/latest.json`. The current source registry is intentionally empty until maintainers add a source whose access and redistribution terms they have checked.
