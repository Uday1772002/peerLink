const test = require("node:test");
const assert = require("node:assert/strict");

const { isValidPhotoUrl } = require("../src/utils/validation");

test("local device photos stored as data URLs are accepted", () => {
  assert.equal(isValidPhotoUrl("data:image/png;base64,AAAA"), true);
  assert.equal(isValidPhotoUrl("https://example.com/photo.jpg"), true);
  assert.equal(isValidPhotoUrl("not-a-valid-url"), false);
});
