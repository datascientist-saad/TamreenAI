import assert from "node:assert/strict";
import test from "node:test";
import { actionErrorMessage, avatarContentType, avatarExtension } from "./avatar-file";

test("avatarContentType accepts explicit MIME types", () => {
  assert.equal(avatarContentType({ name: "a.bin", type: "image/jpeg" }), "image/jpeg");
  assert.equal(avatarContentType({ name: "a.bin", type: "image/png" }), "image/png");
  assert.equal(avatarContentType({ name: "a.bin", type: "image/webp" }), "image/webp");
});

test("avatarContentType recovers MIME from the filename when type is empty", () => {
  assert.equal(avatarContentType({ name: "photo.JPG", type: "" }), "image/jpeg");
  assert.equal(avatarContentType({ name: "photo.jpeg", type: "" }), "image/jpeg");
  assert.equal(avatarContentType({ name: "photo.png", type: "application/octet-stream" }), "image/png");
  assert.equal(avatarContentType({ name: "photo.webp", type: "" }), "image/webp");
  assert.equal(avatarContentType({ name: "photo.heic", type: "" }), null);
  assert.equal(avatarContentType({ name: "photo.gif", type: "image/gif" }), null);
});

test("avatarExtension maps content types", () => {
  assert.equal(avatarExtension("image/png"), "png");
  assert.equal(avatarExtension("image/webp"), "webp");
  assert.equal(avatarExtension("image/jpeg"), "jpg");
});

test("actionErrorMessage hides production React digests", () => {
  assert.equal(actionErrorMessage(new Error("Bucket not found"), "fallback"), "Bucket not found");
  assert.equal(
    actionErrorMessage(new Error("Minified React error #441; visit https://react.dev/errors/441"), "Photo not saved."),
    "Photo not saved.",
  );
  assert.equal(actionErrorMessage("boom", "Photo not saved."), "Photo not saved.");
});
