import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

try {
  loadEnvFile(new URL("./.env", import.meta.url));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

// Imported after .env is loaded because config.js reads process.env.
const { CHECK_INTERVAL, FEEDS, HISTORY_LIMIT } = await import("./config.js");
const { isWebhookUrl } = await import("./discord.js");
const { checkFeed } = await import("./feed.js");
const { articleKey } = await import("./gsmarena.js");
const { openHistory } = await import("./history.js");

const feeds = await Promise.all(
  FEEDS.map(async (feed) => {
    if (!isWebhookUrl(feed.webhookUrl)) {
      throw new Error(`Missing or invalid webhook URL for ${feed.query}.`);
    }

    return {
      ...feed,
      history: await openHistory(
        fileURLToPath(new URL(feed.historyFile, import.meta.url)),
        HISTORY_LIMIT,
        articleKey
      ),
    };
  })
);

const shutdown = new AbortController();

for (const event of ["SIGINT", "SIGTERM"]) {
  process.once(event, () => {
    console.log(`${event} received, stopping.`);
    shutdown.abort();
  });
}

console.log("GSMArena News Fetcher started.");

while (!shutdown.signal.aborted) {
  await Promise.all(
    feeds.map((feed) =>
      checkFeed(feed, { signal: shutdown.signal }).catch((error) => {
        console.error(`[${feed.query}] ${error.message}`);
      })
    )
  );

  await delay(CHECK_INTERVAL, undefined, { signal: shutdown.signal }).catch(
    () => {}
  );
}
