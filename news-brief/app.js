const categoriesContainer = document.getElementById('categories');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdatedEl = document.getElementById('lastUpdated');
const categoryTemplate = document.getElementById('categoryTemplate');

const FEED_PROXY = 'https://api.allorigins.win/raw?url=';

function sourceToGoogleNewsRss(sourceUrl) {
  const domain = new URL(sourceUrl).hostname.replace(/^www\./, '');
  const query = encodeURIComponent(`site:${domain} when:1d`);
  return `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

function feedViaProxy(feedUrl) {
  return `${FEED_PROXY}${encodeURIComponent(feedUrl)}`;
}

function firstUsefulSentence(text) {
  const cleaned = text.replace(/\s+/g, ' ').replace(/<[^>]*>/g, '').trim();
  const pieces = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  return pieces.find((p) => p.length > 40) || cleaned.slice(0, 180) || 'No summary available.';
}

function summarizeCategory(stories) {
  if (!stories.length) {
    return 'No lead stories found for this category yet.';
  }

  const topWords = stories
    .flatMap((s) => `${s.title} ${s.description}`.toLowerCase().split(/[^a-z0-9]+/))
    .filter((w) => w.length > 4 && !['about', 'their', 'there', 'after', 'would', 'which', 'could', 'today'].includes(w))
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

  const themes = Object.entries(topWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  const themeText = themes.length ? `Common themes: ${themes.join(', ')}. ` : '';
  return `${themeText}Lead headlines suggest ${stories.length} key developments today across this category.`;
}

async function fetchLeadStory(sourceUrl) {
  const feedUrl = sourceToGoogleNewsRss(sourceUrl);
  const response = await fetch(feedViaProxy(feedUrl));
  if (!response.ok) {
    throw new Error(`Unable to fetch feed for ${sourceUrl}`);
  }

  const xmlText = await response.text();
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  const firstItem = xml.querySelector('item');

  if (!firstItem) {
    throw new Error(`No stories found for ${sourceUrl}`);
  }

  const title = firstItem.querySelector('title')?.textContent?.trim() || 'Untitled story';
  const link = firstItem.querySelector('link')?.textContent?.trim() || sourceUrl;
  const description = firstItem.querySelector('description')?.textContent?.trim() || '';

  return {
    source: new URL(sourceUrl).hostname,
    title,
    link,
    description: firstUsefulSentence(description)
  };
}

function renderCategory(categoryName, stories) {
  const node = categoryTemplate.content.cloneNode(true);
  node.querySelector('.category-title').textContent = categoryName;
  node.querySelector('.category-summary').textContent = summarizeCategory(stories);

  const list = node.querySelector('.story-list');
  stories.forEach((story) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <a href="${story.link}" target="_blank" rel="noreferrer">${story.title}</a>
      <p class="story-source">Source: ${story.source}</p>
      <p class="story-snippet">${story.description}</p>
    `;
    list.appendChild(li);
  });

  categoriesContainer.appendChild(node);
}

async function buildDigest() {
  const { categories = [] } = window.DIGEST_CONFIG || {};
  statusEl.textContent = 'Collecting lead stories...';
  categoriesContainer.innerHTML = '';

  for (const category of categories) {
    const stories = [];

    for (const sourceUrl of category.sources) {
      try {
        const story = await fetchLeadStory(sourceUrl);
        stories.push(story);
      } catch (error) {
        console.warn(error.message);
      }
    }

    renderCategory(category.name, stories);
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
