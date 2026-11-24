import { EmbedBuilder, WebhookClient } from "discord.js";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { fetchNews, getPreviewImage } from "./gsmarena.js";
import { openHistory } from "./history.js";

try {
  loadEnvFile(new URL("./.env", import.meta.url));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const CHECK_INTERVAL = 10 * 60 * 1000;
const HISTORY_LIMIT = 100;

const FEEDS = [
  {
    query: "realme",
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    historyFile: "seen-links.json",
    footer: "realme News",
    color: 0xff0000,
  },
];

async function sendNews(feed, { title, link }) {
  const image = await getPreviewImage(link);

  const embed = new EmbedBuilder()
    .setTitle(title.slice(0, 256))
    .setURL(link)
    .setColor(feed.color)
    .setTimestamp()
    .setFooter({ text: feed.footer });

  if (image) embed.setImage(image);

  await feed.client.send({ embeds: [embed] });
}

async function check(feed) {
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
    if (history.has(article.link)) continue;

    await sendNews(feed, article);
    await history.remember(article.link);

    console.log(`[${query}] Sent: ${article.title}`);
    sent++;
  }

  console.log(`[${query}] ${sent} new article(s).`);
}

const feeds = await Promise.all(
  FEEDS.map(async (feed) => {
    if (!feed.webhookUrl) {
      throw new Error(`Missing webhook URL for ${feed.query}.`);
    }

    return {
      ...feed,
      client: new WebhookClient({ url: feed.webhookUrl }),
      history: await openHistory(
        fileURLToPath(new URL(feed.historyFile, import.meta.url)),
        HISTORY_LIMIT
      ),
    };
  })
);

console.log("GSMArena News Fetcher started.");

while (true) {
  for (const feed of feeds) {
    try {
      await check(feed);
    } catch (error) {
      console.error(`[${feed.query}] ${error.message}`);
    }
  }

  await delay(CHECK_INTERVAL);
}