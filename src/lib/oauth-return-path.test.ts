import { expect, it } from "vitest";
import { oauthReturnPath } from "./oauth-return-path";
it("preserves consent query and fragment", () => {
  expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=123#review")).toBe("/.lovable/oauth/consent?authorization_id=123#review");
});
it.each(["//evil.example", "/\\evil.example", "https://evil.example", "/\nunsafe", null])("rejects external or malformed return path %s", value => {
  expect(oauthReturnPath(value)).toBe("/");
});