import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MimoClient, extractJson, fromEnv } from "../packages/llm/src/index.js";

function makeFetch(responseBody: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(responseBody), {
      status,
      headers: { "Content-Type": "application/json" }
    })) as unknown as typeof fetch;
}

describe("MimoClient", () => {
  it("returns content + usage from response", async () => {
    const client = new MimoClient({
      baseUrl: "https://example/v1",
      apiKey: "test",
      fetch: makeFetch({
        choices: [{ message: { content: "hi", reasoning_content: "thought trace" } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          completion_tokens_details: { reasoning_tokens: 3 },
          prompt_tokens_details: { cached_tokens: 2 }
        },
        model: "mimo-v2.5"
      })
    });

    const result = await client.chat([{ role: "user", content: "hello" }], { model: "mimo-v2.5" });
    assert.equal(result.content, "hi");
    assert.equal(result.reasoning, "thought trace");
    assert.equal(result.usage.totalTokens, 15);
    assert.equal(result.usage.reasoningTokens, 3);
    assert.equal(result.usage.cachedTokens, 2);
    assert.equal(result.model, "mimo-v2.5");
  });

  it("throws on non-200", async () => {
    const client = new MimoClient({
      baseUrl: "https://example/v1",
      apiKey: "test",
      fetch: makeFetch({ error: "bad" }, 401)
    });

    await assert.rejects(() => client.chat([{ role: "user", content: "x" }], { model: "mimo-v2.5" }));
  });
});

describe("extractJson", () => {
  it("parses plain JSON", () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  });

  it("parses fenced JSON", () => {
    assert.deepEqual(extractJson("```json\n{\"a\":2}\n```"), { a: 2 });
  });

  it("parses JSON embedded in prose", () => {
    assert.deepEqual(extractJson("here is the result: {\"a\":3} done"), { a: 3 });
  });

  it("throws on invalid JSON", () => {
    assert.throws(() => extractJson("not json at all"));
  });
});

describe("fromEnv", () => {
  it("returns null when env missing", () => {
    assert.equal(fromEnv({}), null);
  });

  it("returns null when placeholder key", () => {
    assert.equal(fromEnv({ MIMO_BASE_URL: "https://x", MIMO_API_KEY: "replace-me" }), null);
  });

  it("returns client when env present", () => {
    const client = fromEnv({ MIMO_BASE_URL: "https://x/v1", MIMO_API_KEY: "tp-real" });
    assert.ok(client);
  });
});
