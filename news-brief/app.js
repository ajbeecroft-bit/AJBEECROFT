const categoriesContainer = document.getElementById('categories');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdatedEl = document.getElementById('lastUpdated');
const categoryTemplate = document.getElementById('categoryTemplate');

const FEED_PROXY = 'https://api.allorigins.win/raw?url=';
const STORIES_PER_SOURCE = 5;
const resolvedRssCache = new Map();

function feedViaProxy(url) {
  return `${FEED_PROXY}${encodeURIComponent(url)}`;
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ').replace(/<[^>]*>/g, '').trim();
}

function normalizeSource(source) {
  if (typeof source === 'string') {
    return {
      name: new URL(source).hostname,
      website: source
    };
  }

  return {
    name: source.name || new URL(source.website || source.rss).hostname,
    website: source.website,
    rss: source.rss
  };
}

function resolveUrl(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function websiteCandidateFeeds(websiteUrl) {
  if (!websiteUrl) {
    return [];
  }

  const origin = new URL(websiteUrl).origin;
  return [`${origin}/feed`, `${origin}/rss`, `${origin}/rss.xml`, `${origin}/feed.xml`];
}

async function discoverFeedsFromWebsite(websiteUrl) {
  if (!websiteUrl) {
    return [];
  }

  try {
    const response = await fetch(feedViaProxy(websiteUrl));
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('link[rel~="alternate"]'));

    return links
      .filter((link) => {
        const type = (link.getAttribute('type') || '').toLowerCase();
        return type.includes('rss') || type.includes('atom') || type.includes('xml');
      })
      .map((link) => resolveUrl(websiteUrl, link.getAttribute('href')))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function isValidFeed(feedUrl) {
  try {
    const response = await fetch(feedViaProxy(feedUrl));
    if (!response.ok) {
      return false;
    }

    const xmlText = await response.text();
    const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      return false;
    }

    return xml.querySelector('item, entry') !== null;
  } catch {
    return false;
  }
}

async function resolveRssUrl(source) {
  const cacheKey = `${source.name}|${source.website || ''}|${source.rss || ''}`;
  if (resolvedRssCache.has(cacheKey)) {
    return resolvedRssCache.get(cacheKey);
  }

  const candidates = [];
  if (source.rss) {
    candidates.push(source.rss);
  }

  const discovered = await discoverFeedsFromWebsite(source.website);
  candidates.push(...discovered, ...websiteCandidateFeeds(source.website));

  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);

    if (await isValidFeed(candidate)) {
      resolvedRssCache.set(cacheKey, candidate);
      return candidate;
    }
  }

  throw new Error(`No RSS feed found for ${source.name}`);
}

function synthesizeParagraph(stories) {
  if (!stories.length) {
    return 'No reliable stories were found in the last 24 hours for this category.';
  }

  const wordScores = stories
    .flatMap((s) => `${s.title} ${s.description}`.toLowerCase().split(/[^a-z0-9]+/))
    .filter((w) => w.length > 4 && !['about', 'their', 'there', 'after', 'would', 'which', 'could', 'today'].includes(w))
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

  const themes = Object.entries(wordScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w]) => w);

  const lead = stories.slice(0, 5).map((s) => s.title).join('; ');
  const themeText = themes.length ? `Major themes include ${themes.join(', ')}. ` : '';

  return `${themeText}Across ${stories.length} lead stories gathered from this category's RSS sources, coverage converges on these developments: ${lead}. Overall, reporting suggests these stories are shaping the current daily agenda across outlets.`;
}

async function fetchLeadStories(sourceInput) {
  const source = normalizeSource(sourceInput);
  const rssUrl = await resolveRssUrl(source);
  const response = await fetch(feedViaProxy(rssUrl));
  if (!response.ok) {
    throw new Error(`Unable to fetch feed for ${source.name}`);
  }

  const xmlText = await response.text();
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  const items = Array.from(xml.querySelectorAll('item, entry')).slice(0, STORIES_PER_SOURCE);

  return items.map((item) => ({
    source: source.name,
    title: cleanText(item.querySelector('title')?.textContent || 'Untitled story'),
    description: cleanText(item.querySelector('description, summary, content')?.textContent || '')
  }));
}

function renderCategory(categoryName, stories, sourceCount, failedSources) {
  const node = categoryTemplate.content.cloneNode(true);
  node.querySelector('.category-title').textContent = categoryName;
  node.querySelector('.category-meta').textContent = `Analyzed ${stories.length} stories from ${sourceCount} RSS sources (up to ${STORIES_PER_SOURCE} stories/source). Failed sources: ${failedSources}.`;
  node.querySelector('.category-summary').textContent = synthesizeParagraph(stories);
  categoriesContainer.appendChild(node);
}

async function buildDigest() {
  const { categories = [] } = window.DIGEST_CONFIG || {};
  statusEl.textContent = 'Collecting and synthesizing stories...';
  categoriesContainer.innerHTML = '';

  for (const category of categories) {
    const stories = [];
    let failedSources = 0;

    for (const source of category.sources) {
      try {
        const sourceStories = await fetchLeadStories(source);
        stories.push(...sourceStories);
      } catch (error) {
        failedSources += 1;
        console.warn(error.message);
      }
    }

    renderCategory(category.name, stories, category.sources.length, failedSources);
  }

  statusEl.textContent = 'Digest ready.';
  lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;
}

refreshBtn.addEventListener('click', () => {
  buildDigest().catch((error) => {
    statusEl.textContent = `Digest failed: ${error.message}`;
  });
});

buildDigest().catch((error) => {
  statusEl.textContent = `Digest failed: ${error.message}`;
});
