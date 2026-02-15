const categoriesContainer = document.getElementById('categories');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdatedEl = document.getElementById('lastUpdated');
const categoryTemplate = document.getElementById('categoryTemplate');

const FEED_PROXY = 'https://api.allorigins.win/raw?url=';
const STORIES_PER_SOURCE = 5;

function sourceToGoogleNewsRss(sourceUrl) {
  const domain = new URL(sourceUrl).hostname.replace(/^www\./, '');
  const query = encodeURIComponent(`site:${domain} when:1d`);
  return `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

function feedViaProxy(feedUrl) {
  return `${FEED_PROXY}${encodeURIComponent(feedUrl)}`;
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ').replace(/<[^>]*>/g, '').trim();
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

  return `${themeText}Across ${stories.length} lead stories gathered from this category's sources, coverage converges on these developments: ${lead}. Overall, reporting suggests these stories are shaping the current daily agenda across outlets.`;
}

async function fetchLeadStories(sourceUrl) {
  const feedUrl = sourceToGoogleNewsRss(sourceUrl);
  const response = await fetch(feedViaProxy(feedUrl));
  if (!response.ok) {
    throw new Error(`Unable to fetch feed for ${sourceUrl}`);
  }

  const xmlText = await response.text();
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  const items = Array.from(xml.querySelectorAll('item')).slice(0, STORIES_PER_SOURCE);

  return items.map((item) => ({
    source: new URL(sourceUrl).hostname,
    title: cleanText(item.querySelector('title')?.textContent || 'Untitled story'),
    description: cleanText(item.querySelector('description')?.textContent || '')
  }));
}

function renderCategory(categoryName, stories, sourceCount) {
  const node = categoryTemplate.content.cloneNode(true);
  node.querySelector('.category-title').textContent = categoryName;
  node.querySelector('.category-meta').textContent = `Analyzed ${stories.length} stories from ${sourceCount} sources (up to ${STORIES_PER_SOURCE} stories/source).`;
  node.querySelector('.category-summary').textContent = synthesizeParagraph(stories);
  categoriesContainer.appendChild(node);
}

async function buildDigest() {
  const { categories = [] } = window.DIGEST_CONFIG || {};
  statusEl.textContent = 'Collecting and synthesizing stories...';
  categoriesContainer.innerHTML = '';

  for (const category of categories) {
    const stories = [];

    for (const sourceUrl of category.sources) {
      try {
        const sourceStories = await fetchLeadStories(sourceUrl);
        stories.push(...sourceStories);
      } catch (error) {
        console.warn(error.message);
      }
    }

    renderCategory(category.name, stories, category.sources.length);
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
