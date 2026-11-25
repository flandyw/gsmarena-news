import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { HttpError, request } from "../http.js";

afterEach(() => mock.restoreAll());

function stubFetch(...responses) {
  return mock.method(globalThis, "fetch", async () => {
    const next = responses.shift();

    if (next instanceof Error) throw next;
    return next;
  });
}

const retryNow = { "retry-after": "0.001" };

test("retries 5xx and 429", async () => {
  const fetch = stubFetch(
    new Response("", { status: 503, headers: retryNow }),
    new Response("", { status: 429, headers: retryNow }),
    new Response("ok")
  );

  const response = await request("https://example.com/");

  assert.equal(await response.text(), "ok");
  assert.equal(fetch.mock.callCount(), 3);
});

test("does not retry other 4xx responses", async () => {
  const fetch = stubFetch(new Response("nope", { status: 404 }));

  await assert.rejects(request("https://example.com/"), (error) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 404);
    return true;
  });
  assert.equal(fetch.mock.callCount(), 1);
});

test("gives up after the retry budget", async () => {
  const fetch = stubFetch(
    new Response("", { status: 500, headers: retryNow }),
    new Response("", { status: 500, headers: retryNow })
  );

  await assert.rejects(request("https://example.com/", { retries: 1 }), {
    status: 500,
  });
  assert.equal(fetch.mock.callCount(), 2);
});
