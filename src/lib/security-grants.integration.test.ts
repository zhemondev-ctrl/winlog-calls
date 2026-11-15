import { describe, expect, it } from "vitest";

const url = process.env["SUPPORT_TEST_URL"];
const key = process.env["SUPPORT_TEST_PUBLIC_KEY"];
const token = process.env["SUPPORT_TEST_TOKEN"];

describe.skipIf(!url || !key || !token)("Live privileged function access", () => {
  async function rpc(name: string, body: Record<string, unknown>, signedIn = false) {
    const headers = new Headers({ apikey: key ?? "", "Content-Type": "application/json" });
    if (signedIn) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
  }

  it("anonymous callers cannot claim AI worker jobs", async () => {
    const response = await rpc("support_claim_call_ai", { _team: crypto.randomUUID(), _token: crypto.randomUUID() });
    expect(response.status).toBe(401);
  });
  it("signed-in users cannot claim AI worker jobs directly", async () => {
    const response = await rpc("support_claim_call_ai", { _team: crypto.randomUUID(), _token: crypto.randomUUID() }, true);
    expect(response.status).toBe(403);
  });
  it("anonymous callers cannot invoke support mutations", async () => {
    const response = await rpc("support_mutate", { _team: crypto.randomUUID(), _action: "settings", _payload: {} });
    expect(response.status).toBe(401);
  });
  it("signed-in users cannot bypass phone-code server redemption", async () => {
    const response = await rpc("claim_phone_setup_code", { _hash: "invalid-test-code" }, true);
    expect(response.status).toBe(403);
  });
  it("signed-in users retain their support role lookup", async () => {
    const response = await rpc("support_role", { _team: crypto.randomUUID() }, true);
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});