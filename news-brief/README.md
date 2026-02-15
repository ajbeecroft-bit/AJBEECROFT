# Daily Lead Story Digest

Simple configurable website that gathers lead stories by category.

## How to tweak categories

Edit `config.js`:

```js
{
  name: 'Science',
  sources: ['https://www.nature.com', 'https://www.scientificamerican.com']
}
```

That's it—refresh the page and the new category will appear.

## How it works

- Converts each source website to a Google News RSS search query (`site:domain when:1d`).
- Fetches RSS through AllOrigins to avoid CORS issues.
- Picks the first item as each source's lead story.
- Generates a lightweight category summary from headline keywords.
