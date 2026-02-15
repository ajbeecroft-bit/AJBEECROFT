# Daily Lead Story Digest

This project now supports two delivery modes:

1. **Website view** in `docs/news-brief/`.
2. **Automatic daily email** sent at **3:00 AM EST** via GitHub Actions.

## What changed

- Pulls **up to 5 lead stories per source**.
- Produces a **single paragraph synthesis** per category (instead of listing individual headlines).
- Email workflow can use OpenAI to **translate non-English content to English** and synthesize category summaries.

## Edit categories and sources

Update both of these files with matching categories/sources:

- `docs/news-brief/config.js` (website)
- `docs/news-brief/config.json` (email workflow)

Category format:

```json
{
  "name": "Science",
  "sources": ["https://www.nature.com", "https://www.scientificamerican.com"]
}
```

## Website access

After GitHub Pages deploys from `/docs`, open:

`https://YOUR-USERNAME.github.io/YOUR-REPO/news-brief/`

## Daily email setup (3:00 AM EST)

The workflow file is:

- `.github/workflows/news-digest-email.yml`

It runs at `0 8 * * *` (08:00 UTC = 03:00 EST).

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

- `OPENAI_API_KEY` (optional but recommended for better synthesis + translation)
- `SMTP_HOST`
- `SMTP_PORT` (usually `465`)
- `SMTP_USER`
- `SMTP_PASSWORD`
- `FROM_EMAIL`
- `TO_EMAIL`

### SMTP provider examples

- Gmail app password SMTP (`smtp.gmail.com`, port `465`)
- SendGrid SMTP
- Mailgun SMTP

## Manual test before scheduling

You can run a dry-run locally (no email sent):

```bash
python scripts/news_digest_email.py --dry-run
```

## Notes

- `docs/.nojekyll` is included so GitHub Pages treats `/docs` as static files.
- If OpenAI key is missing, the script uses a fallback summary method.
