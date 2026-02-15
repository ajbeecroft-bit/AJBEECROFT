# Daily Lead Story Digest

This is a simple website that gathers lead stories by category.

If you can edit one file, you can customize this app.

## 1) Where the website files are

Inside your repo:

- `docs/news-brief/index.html` (main page)
- `docs/news-brief/config.js` (categories + websites to scan)
- `docs/news-brief/app.js` (logic)
- `docs/news-brief/styles.css` (design)

## 2) Add your own categories (no coding knowledge needed)

Open `docs/news-brief/config.js` and copy/paste a category block like this:

```js
{
  name: 'Science',
  sources: ['https://www.nature.com', 'https://www.scientificamerican.com']
}
```

Change only:

- `name` → what you want the category to be called
- `sources` → list of websites for that category

Save/commit the file. Done.

## 3) Publish on GitHub Pages (step-by-step)

1. Push this repo to GitHub.
2. In GitHub, open your repository.
3. Click **Settings**.
4. Click **Pages**.
5. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main** (or your default branch)
   - Folder: **/docs**
6. Click **Save**.
7. Wait 1-3 minutes.

Your site URL will be:

`https://YOUR-USERNAME.github.io/YOUR-REPO/news-brief/`

## 4) If GitHub Pages build fails (like your screenshot)

This repository includes `docs/.nojekyll` to disable Jekyll processing.
That avoids common build errors when deploying plain static files.

If you still see a failed run:

1. Go to **Actions**.
2. Open the failed "pages build and deployment" run.
3. Click **Re-run jobs**.
4. Confirm Pages source is still set to **Branch + /docs**.

## How it works

- Converts each source website to a Google News RSS search query (`site:domain when:1d`).
- Fetches RSS through AllOrigins to avoid CORS issues.
- Picks the first item as each source's lead story.
- Generates a lightweight category summary from headline keywords.
