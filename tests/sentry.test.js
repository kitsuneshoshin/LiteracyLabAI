const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// Regression test for a silent-loss bug: Sentry queues events and sends them
// in the background, but Vercel freezes a function the moment it responds.
// captureIfUnexpected used to fire and forget, so errors were typically lost
// after the response went out - monitoring looked configured while missing
// most real failures. These tests stand up a stand-in Sentry server and
// assert the event has ARRIVED by the time captureIfUnexpected resolves,
// which is exactly the guarantee callers rely on before responding.

function freshModule() {
  delete require.cache[require.resolve("../api/_lib/sentry")];
  return require("../api/_lib/sentry");
}

// Children's writing must never reach an error tracker. The AI quality-check
// failure message quotes the generated feedback, which can quote the child.
test("redact blanks quoted content, including when the child's writing has its own quotation marks", () => {
  const { redact } = freshModule();
  const real = 'The AI response didn\'t meet our quality checks after 3 attempts. Please try submitting again. (glow fabricates comprehension the student didn\'t demonstrate on a 0-correct attempt ("You noticed Mia\'s secret diary") - it must praise real effort)';
  const out = redact(real);
  assert.ok(!out.includes("Mia"), out);
  assert.ok(out.includes("quality checks"), "the non-content part of the message should survive");
  assert.ok(out.includes("glow fabricates"), "which check failed should survive");

  // Dialogue inside the quoted content - a naive quote matcher leaks "Help me".
  const dialogue = 'revision contains an interest-based analogy ("She shouted "Help me" at the robot") - for middle/high tiers';
  const out2 = redact(dialogue);
  assert.ok(!out2.includes("Help me"), out2);
  assert.ok(!out2.includes("robot"), out2);
  assert.ok(!out2.includes("She shouted"), out2);

  // Any other quoted span.
  assert.ok(!redact('failed on "a private phrase" here').includes("private phrase"));
  assert.equal(redact(undefined), undefined);
});

test("with no SENTRY_DSN configured, reporting is a quiet no-op", async () => {
  delete process.env.SENTRY_DSN;
  const { captureIfUnexpected } = freshModule();
  await captureIfUnexpected(Object.assign(new Error("nothing to report to"), { statusCode: 500 }));
});

test("a 500 is delivered to Sentry before captureIfUnexpected resolves; a 4xx is not sent", async () => {
  const received = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      received.push(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    process.env.SENTRY_DSN = `http://publickey@127.0.0.1:${port}/1`;
    const { captureIfUnexpected } = freshModule();

    // The child's text is assembled at runtime, as it would be in the real
    // app. Sentry attaches the surrounding SOURCE lines to each report; if
    // the text were a literal in this file, it would appear in those source
    // lines and fail the check below for a reason that can't happen in
    // production, where those lines are code, not a child's writing.
    const childText = ["Tom", "hid", "the", "key", "under", "the", "mat"].join(" ");
    await captureIfUnexpected(Object.assign(new Error(`boom-500-regression ("${childText}")`), { statusCode: 500 }));
    assert.ok(
      received.some((b) => b.includes("boom-500-regression")),
      "the 500 had not reached Sentry by the time captureIfUnexpected resolved - it would be lost on Vercel"
    );
    // End to end: the redaction actually runs on what leaves the server.
    // Compared via the variable, never a literal: a literal copy of the
    // phrase here would itself show up in the attached source lines.
    assert.ok(!received.some((b) => b.includes(childText)), "quoted content reached Sentry unredacted");

    // Expected control flow ("limit reached", "not found") must not page anyone.
    const before = received.length;
    await captureIfUnexpected(Object.assign(new Error("expected-404"), { statusCode: 404 }));
    assert.equal(received.length, before, "a 4xx was reported to Sentry");
    assert.ok(!received.some((b) => b.includes("expected-404")));
  } finally {
    delete process.env.SENTRY_DSN;
    // Shut the Sentry client down so a failing run exits and reports,
    // instead of hanging on a still-open send (which the old,
    // un-flushed code left behind - found when confirming this test
    // fails against it).
    await require("@sentry/node").close(1000);
    server.close();
  }
});
