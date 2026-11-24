import { load } from "cheerio";

const BASE_URL = "https://www.gsmarena.com/";
const REQUEST_TIMEOUT = 15_000;

async function fetchHtml(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return load(await response.text());
}

export async function fetchNews(query) {
  const url = new URL("news.php3", BASE_URL);
  url.searchParams.set("sSearch", query);

  const $ = await fetchHtml(url);

  const articles = $(".news-item")
    .map((_, element) => {
      const item = $(element);
      const title = item.find("h3").first().text().trim();
      const href = item.find("a[href]").first().attr("href");

      if (!title || !href || !URL.canParse(href, BASE_URL)) {
        return null;
      }

      const link = new URL(href, BASE_URL);

      if (link.origin !== url.origin) return null;

      link.hash = "";

      return { title, link: link.href };
    })
    .get();

  if (!articles.length) {
    throw new Error(`No news found for "${query}".`);
  }

  return articles.reverse();
}

export async function getPreviewImage(url) {
  try {
    const $ = await fetchHtml(url);
    const image = $('meta[property="og:image"]').attr("content");

    if (!image) return null;

    const imageUrl = new URL(image, url);

    return ["https:", "http:"].includes(imageUrl.protocol)
      ? imageUrl.href
      : null;
  } catch (error) {
    console.warn(`Preview unavailable: ${error.message}`);
    return null;
  }
}