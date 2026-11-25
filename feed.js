import { sendEmbed } from "./discord.js";
import { fetchNews, getPreviewImage } from "./gsmarena.js";
import { HttpError } from "./http.js";

async function sendNews(feed, { title, link, thumbnail }) {
  const image = (await getPreviewImage(link)) ?? thumbnail;

  await sendEmbed(feed.webhookUrl, {
    title: title.slice(0, 256),
    url: link,
    color: feed.color,
    timestamp: new Date().toISOString(),
    footer: { text: feed.footer },
    ...(image && { image: { url: image } }),
  });
}

export async function checkFeed(feed, { signal } = {}) {
  const { query, history } = feed;

  await history.flush();

  const articles = await fetchNews(query);

  if (!history.initialized) {
    await history.remember(...articles.map(({ link }) => link));

    console.log(`[${query}] History initialized.`);
    return;
  }

  let sent = 0;

  for (const article of articles) {
    if (signal?.aborted) break;
    if (history.has(article.link)) continue;

    try {
      await sendNews(feed, article);
    } catch (error) {
      // Discord rejected this embed; retrying it would block every later article.
      if (!(error instanceof HttpError) || error.status !== 400) throw error;

      console.error(`[${query}] Skipped: ${article.title} (${error.message})`);
      await history.remember(article.link);
      continue;
    }

    await history.remember(article.link);

    console.log(`[${query}] Sent: ${article.title}`);
    sent++;
  }

  console.log(`[${query}] ${sent} new article(s).`);
}
