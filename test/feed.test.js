import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, mock, test } from "node:test";
import { checkFeed } from "../feed.js";
import { articleKey } from "../gsmarena.js";
import { openHistory } from "../history.js";

afterEach(() => mock.restoreAll());

const WEBHOOK = "https://discord.com/api/webhooks/1/token";
const listing = (...ids) =>
  ids
    .map(
      (id) => `<div class="news-item">
        <a href="a-news-${id}.php"><img src="https://fdn.gsmarena.com/t${id}.jpg"></a>
        <a href="a-news-${id}.php"><h3>Article ${id}</h3></a></div>`
    )
    .join("");

async function setup(pages, discordStatus = () => 204) {
  const posts = [];

  mock.method(console, "log", () => {});
  mock.method(console, "error", () => {});
  mock.method(console, "warn", () => {});
  mock.method(globalThis, "fetch", async (url, init) => {
    url = String(url);

    if (url === WEBHOOK) {
      const embed = JSON.parse(init.body).embeds[0];
      const status = discordStatus(embed);

      if (status < 300) posts.push(embed);
      return new Response(null, { status });
    }

    if (url.includes("news.php3")) return new Response(pages.shift());

    return new Response(
      url.includes("-news-3.php")
        ? ""
        : '<meta property="og:image" content="https://fdn.gsmarena.com/og.jpg">'
    );
  });

  const dir = await mkdtemp(join(tmpdir(), "feed-"));
  const feed = {
    query: "realme",
    webhookUrl: WEBHOOK,
    footer: "realme News",
    color: 0xff0000,
    history: await openHistory(join(dir, "seen.json"), 100, articleKey),
  };

  return { feed, posts };
}

test("first run records articles without posting", async () => {
  const { feed, posts } = await setup([listing(2, 1), listing(2, 1)]);

  await checkFeed(feed);
  await checkFeed(feed);

  assert.equal(posts.length, 0);
});

test("posts only unseen articles, oldest first", async () => {
  const { feed, posts } = await setup([listing(1), listing(3, 2, 1)]);

  await checkFeed(feed);
  await checkFeed(feed);

  assert.deepEqual(
    posts.map(({ title, url, image }) => [title, url, image.url]),
    [
      [
        "Article 2",
        "https://www.gsmarena.com/a-news-2.php",
        "https://fdn.gsmarena.com/og.jpg",
      ],
      [
        "Article 3",
        "https://www.gsmarena.com/a-news-3.php",
        "https://fdn.gsmarena.com/t3.jpg",
      ],
    ]
  );
});

test("an embed Discord rejects does not block later articles", async () => {
  const { feed, posts } = await setup(
    [listing(1), listing(3, 2, 1), listing(3, 2, 1)],
    (embed) => (embed.title === "Article 2" ? 400 : 204)
  );

  await checkFeed(feed);
  await checkFeed(feed);
  await checkFeed(feed);

  assert.deepEqual(posts.map(({ title }) => title), ["Article 3"]);
});

test("a failed send is retried on the next check", async () => {
  let fail = true;
  const { feed, posts } = await setup(
    [listing(1), listing(2, 1), listing(2, 1)],
    () => (fail ? 404 : 204)
  );

  await checkFeed(feed);
  await assert.rejects(checkFeed(feed), { status: 404 });

  fail = false;
  await checkFeed(feed);

  assert.deepEqual(posts.map(({ title }) => title), ["Article 2"]);
});
