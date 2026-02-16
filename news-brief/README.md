# Daily Lead Story Digest

This project supports two delivery modes:

1. **Website view** in `docs/news-brief/`.
2. **Automatic daily email** sent at **3:00 AM EST** via GitHub Actions.

## Option A implemented: direct RSS sources + auto-find

The digest now prefers each source's **direct RSS feed**, and can auto-discover RSS from a plain website URL.

- Up to 5 stories per source.
- One paragraph synthesis per category.
- If `rss` is omitted, the app/script tries to find a feed from the site.
- Website mode now tries multiple fetch proxies before giving up on a source.

## Edit categories and sources

Update both files with matching categories/sources:

- `docs/news-brief/config.js` (website)
- `docs/news-brief/config.json` (email workflow)

You can use either format:

### Explicit RSS (most reliable)

```json
{
  "name": "BBC World",
  "website": "https://www.bbc.com/news/world",
  "rss": "https://feeds.bbci.co.uk/news/world/rss.xml"
}
```

### Website-only (auto-find RSS)

```json
{
  "name": "BBC World",
  "website": "https://www.bbc.com/news/world"
}
```

## Website access

After GitHub Pages deploys from `/docs`, open:

`https://YOUR-USERNAME.github.io/YOUR-REPO/news-brief/`

## Daily email setup (3:00 AM EST)

Workflow file:

- `.github/workflows/news-digest-email.yml`

Schedule: `0 8 * * *` (08:00 UTC = 03:00 EST).

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

- `OPENAI_API_KEY` (optional, improves translation/synthesis)
- `SMTP_HOST`
- `SMTP_PORT` (usually `465`)
- `SMTP_USER`
- `SMTP_PASSWORD`
- `FROM_EMAIL`
- `TO_EMAIL`

## Manual test

```bash
python scripts/news_digest_email.py --dry-run
```

## Notes

- `docs/.nojekyll` is included so GitHub Pages treats `/docs` as static files.
- Website mode still uses a CORS proxy for browser fetches to external RSS/website HTML.
