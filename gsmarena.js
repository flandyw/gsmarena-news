import { load } from "cheerio";
import { request } from "./http.js";

const BASE_URL = "https://www.gsmarena.com/";

async function fetchHtml(url) {
  const response = await request(url);

  return load(await response.text());
}

function httpUrl(value, base) {
  if (!value || !URL.canParse(value, base)) return null;

  const url = new URL(value, base);

  return ["https:", "http:"].includes(url.protocol) ? url : null;
}

// GSMArena renames article slugs when a headline is edited; the numeric ID is stable.
export function articleKey(link) {
  return link.match(/-news-(\d+)\.php/)?.[1] ?? link;
}

export function parseNews(html) {
  const $ = load(html);

  return $(".news-item")
    .map((_, element) => {
      const item = $(element);
      const title = item.find("h3").first().text().trim();
      const link = httpUrl(item.find("a[href]").first().attr("href"), BASE_URL);

      if (!title || !link || link.origin !== new URL(BASE_URL).origin) {
        return null;
      }

      link.hash = "";

      const thumbnail = httpUrl(item.find("img[src]").first().attr("src"), link);

      return { title, link: link.href, thumbnail: thumbnail?.href ?? null };
    })
    .get()
    .reverse();
}

export async function fetchNews(query) {
  const url = new URL("news.php3", BASE_URL);
  url.searchParams.set("sSearch", query);

  const response = await request(url);
  const articles = parseNews(await response.text());

  if (!articles.length) {
    throw new Error(`No news found for "${query}".`);
  }

  return articles;
}

export async function getPreviewImage(url) {
  try {
    const $ = await fetchHtml(url);

    return (
      httpUrl($('meta[property="og:image"]').attr("content"), url)?.href ?? null
    );
  } catch (error) {
    console.warn(`Preview unavailable: ${error.message}`);
    return null;
  }
}
