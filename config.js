export const CHECK_INTERVAL = 10 * 60 * 1000;
export const HISTORY_LIMIT = 100;

export const FEEDS = [
  {
    query: "realme",
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    historyFile: "seen-links.json",
    footer: "realme News",
    color: 0xff0000,
  },
];
