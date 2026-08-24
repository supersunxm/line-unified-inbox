import assert from "node:assert/strict";
import test from "node:test";
import { ResendEmailProvider } from "./resend-email.provider";

async function withEnvironment(values: Record<string, string | undefined>, action: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try { await action(); } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

void test("Resend provider sends the configured sender and approval message without exposing configuration in the payload", async () => {
  const originalFetch = globalThis.fetch;
  let request: RequestInit | undefined;
  try {
    globalThis.fetch = async (_input, init) => { request = init; return new Response(JSON.stringify({ id: "email-1" }), { status: 200 }); };
    await withEnvironment({ RESEND_API_KEY: "resend-secret", EMAIL_FROM_NAME: "OPPO LINE OA Monitor", EMAIL_FROM_ADDRESS: "no-reply@lineoppo.click", EMAIL_FROM: undefined }, async () => {
      await new ResendEmailProvider().send({ to: "pc@example.test", subject: "Approved", text: "Approved", html: "<p>Approved</p>" });
    });
  } finally { globalThis.fetch = originalFetch; }
  const headers = request?.headers as Record<string, string>;
  assert.equal(typeof request?.body, "string");
  const body = JSON.parse(request!.body as string) as Record<string, unknown>;
  assert.equal(headers.authorization, "Bearer resend-secret");
  assert.equal(body.from, "OPPO LINE OA Monitor <no-reply@lineoppo.click>");
  assert.deepEqual(body.to, ["pc@example.test"]);
  assert.equal(body.html, "<p>Approved</p>");
  assert.equal(body.loginUrl, undefined);
  assert.equal(body.password, undefined);
  assert.equal(body.token, undefined);
});

void test("Resend provider fails with a sanitized error when the API rejects the request", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("provider details", { status: 403 });
    await withEnvironment({ RESEND_API_KEY: "resend-secret", EMAIL_FROM_ADDRESS: "no-reply@lineoppo.click" }, async () => {
      await assert.rejects(() => new ResendEmailProvider().send({ to: "pc@example.test", subject: "Approved", text: "Approved" }), /Email provider rejected the request/);
    });
  } finally { globalThis.fetch = originalFetch; }
});
