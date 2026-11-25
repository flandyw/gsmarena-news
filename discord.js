import { request } from "./http.js";

const WEBHOOK_PATTERN =
  /^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isWebhookUrl(url) {
  return typeof url === "string" && WEBHOOK_PATTERN.test(url);
}

export async function sendEmbed(webhookUrl, embed) {
  await request(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
    retries: 3,
  });
}
