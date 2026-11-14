import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { once } from "node:events";
import { LocalModel } from "../src/ollama.ts";
import { loadDataset } from "../src/dataset.ts";
import { retrieve, extract } from "../src/retrieval.ts";
const { corpus, queries } = await loadDataset();
const query = queries[0];
const hits = retrieve(corpus, query.tenant, query.question);
const answer = extract(corpus, query.tenant, hits);
const envelope = (value: unknown) => ({
  model: "synthetic-fixture:1",
  done: true,
  done_reason: "stop",
  message: { role: "assistant", content: JSON.stringify(value) },
  prompt_eval_count: 17,
  eval_count: 9,
});
async function target(
  handler: (res: ServerResponse, request: unknown) => void | Promise<void>,
  work: (url: string) => Promise<void>,
) {
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        void Promise.resolve(handler(res, JSON.parse(body))).catch(() =>
          res.destroy(),
        );
      } catch {
        res.destroy();
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing HTTP fixture address.");
  try {
    await work(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((e) => (e ? reject(e) : resolve()));
      server.closeAllConnections();
    });
  }
}
await test("model adapter sends bounded schema requests and reports actual usage fields", async () => {
  await target(
    (res, raw) => {
      const request = raw as {
        stream: boolean;
        format: { additionalProperties: boolean };
        messages: { content: string }[];
        options: { num_predict: number };
      };
      assert.equal(request.stream, false);
      assert.equal(
        JSON.parse(request.messages[1].content).tenant,
        query.tenant,
      );
      assert.equal(request.format.additionalProperties, false);
      assert.equal(request.options.num_predict, 512);
      assert.equal(
        JSON.parse(request.messages[1].content).documents.length,
        hits.length,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(envelope(answer)));
    },
    async (endpoint) => {
      const model = new LocalModel({
        model: "synthetic-fixture:1",
        endpoint,
        maxRequests: 1,
      });
      const result = await model.answer(corpus, query, hits);
      assert.deepEqual(result.answer, answer);
      assert.equal(result.citationValid, true);
      assert.equal(result.promptTokens, 17);
      assert.equal(result.completionTokens, 9);
      await assert.rejects(
        model.answer(corpus, query, hits),
        /budget exhausted/,
      );
      assert.equal(model.requests, 1);
    },
  );
});
await test("adapter refuses remote origins, credentials, paths and invalid budgets", () => {
  for (const endpoint of [
    "https://example.com",
    "http://localhost:11434",
    "http://127.0.0.1.example.com",
    "http://user:secret@127.0.0.1",
    "http://127.0.0.1/api/chat",
    "http://127.0.0.1/?x=1",
  ])
    assert.throws(
      () => new LocalModel({ model: "fixture", endpoint }),
      /loopback/,
    );
  for (const opts of [
    { maxRequests: 0 },
    { maxRequests: 33 },
    { timeoutMs: Infinity },
    { maxResponseBytes: 65537 },
  ])
    assert.throws(
      () => new LocalModel({ model: "fixture", ...opts }),
      /budget/,
    );
});
await test("adapter does not follow redirects or retry unsuccessful requests", async () => {
  let requests = 0;
  await target(
    (res) => {
      requests++;
      res.writeHead(302, { Location: "http://127.0.0.1:1/leak" });
      res.end();
    },
    async (endpoint) => {
      const model = new LocalModel({
        model: "fixture",
        endpoint,
        maxRequests: 1,
      });
      await assert.rejects(model.answer(corpus, query, hits), /request failed/);
      assert.equal(requests, 1);
      assert.equal(model.requests, 1);
    },
  );
});
await test("malformed, truncated and schema-invalid responses remain failures", async () => {
  for (const value of [
    "{broken",
    JSON.stringify({ ...envelope(answer), done: false }),
    JSON.stringify({ ...envelope(answer), done_reason: "length" }),
    JSON.stringify(envelope({ ...answer, abstain: "false" })),
    JSON.stringify({
      ...envelope(answer),
      message: {
        role: "assistant",
        content: JSON.stringify(answer),
        tool_calls: [{}],
      },
    }),
  ]) {
    await target(
      (res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(value);
      },
      async (endpoint) => {
        await assert.rejects(
          new LocalModel({ model: "fixture", endpoint }).answer(
            corpus,
            query,
            hits,
          ),
        );
      },
    );
  }
});
await test("streamed response bytes are capped without trusting content length", async () => {
  await target(
    (res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write("x".repeat(300));
      res.end("x".repeat(300));
    },
    async (endpoint) => {
      await assert.rejects(
        new LocalModel({
          model: "fixture",
          endpoint,
          maxResponseBytes: 256,
        }).answer(corpus, query, hits),
        /byte budget/,
      );
    },
  );
});
await test("response body deadline and caller cancellation stop unfinished requests", async () => {
  for (const cancel of [false, true]) {
    const started = Promise.withResolvers<void>();
    const controller = new AbortController();
    await target(
      (res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.write("{");
        started.resolve();
      },
      async (endpoint) => {
        const model = new LocalModel({
          model: "fixture",
          endpoint,
          timeoutMs: cancel ? 2000 : 100,
        });
        const pending = model.answer(corpus, query, hits, controller.signal);
        const rejected = assert.rejects(pending);
        await started.promise;
        if (cancel) controller.abort();
        await rejected;
        assert.equal(model.requests, 1);
      },
    );
  }
});
await test("canonical authorization failures and pre-cancellation consume no requests", async () => {
  const model = new LocalModel({ model: "fixture" });
  await assert.rejects(
    model.answer(corpus, query, [{ ...hits[0], text: "Injected context" }]),
    /canonical/,
  );
  await assert.rejects(
    model.answer(corpus, query, [corpus.find((d) => d.tenant === "beta")!]),
    /authorized/,
  );
  await assert.rejects(model.answer(corpus, query, hits, AbortSignal.abort()));
  assert.equal(model.requests, 0);
});
await test("schema-valid hallucinations are retained as failed evidence, not repaired", async () => {
  const fabricated = { ...answer, answer: "A fabricated warranty." };
  await target(
    (res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(envelope(fabricated)));
    },
    async (endpoint) => {
      const result = await new LocalModel({
        model: "fixture",
        endpoint,
      }).answer(corpus, query, hits);
      assert.equal(result.citationValid, false);
      assert.equal(result.answer.answer, fabricated.answer);
    },
  );
});

await test("HTTP failures and unexpected media types do not become model answers", async () => {
  for (const [status, type] of [
    [503, "application/json"],
    [200, "text/html"],
  ] as const) {
    let count = 0;
    await target(
      (res) => {
        count++;
        res.writeHead(status, { "Content-Type": type });
        res.end("untrusted response");
      },
      async (endpoint) => {
        const model = new LocalModel({ model: "fixture", endpoint });
        await assert.rejects(
          model.answer(corpus, query, hits),
          /unsuccessful or non-JSON/,
        );
        assert.equal(count, 1);
        assert.equal(model.requests, 1);
      },
    );
  }
});
