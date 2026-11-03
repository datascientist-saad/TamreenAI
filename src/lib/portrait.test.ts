import assert from "node:assert/strict";
import test from "node:test";
import { googlePhotoUrl, initials, portraitChoice, publicAvatarUrl } from "./portrait";

test("google photo prefers the account picture and ignores unsafe urls", () => {
  assert.equal(googlePhotoUrl({
    app_metadata: { providers: ["google"] },
    user_metadata: { avatar_url: "https://lh3.googleusercontent.com/a/photo" },
  }), "https://lh3.googleusercontent.com/a/photo");
  assert.equal(googlePhotoUrl({
    user_metadata: { avatar_url: "https://lh3.googleusercontent.com/a/photo" },
  }), null);
  assert.equal(googlePhotoUrl({
    user_metadata: { avatar_url: "javascript:alert(1)" },
    identities: [{ provider: "google", identity_data: { picture: "https://lh3.googleusercontent.com/a/id" } }],
  }), "https://lh3.googleusercontent.com/a/id");
  assert.equal(googlePhotoUrl({ user_metadata: {}, identities: [{ provider: "email" }] }), null);
});

test("an uploaded photo wins over the google photo", () => {
  const uploaded = portraitChoice({
    avatarPath: "user/avatar.jpg",
    updatedAt: "2026-11-03T08:00:00Z",
    supabaseUrl: "https://project.supabase.co/",
    googleUrl: "https://lh3.googleusercontent.com/a/photo",
  });
  assert.equal(uploaded.source, "upload");
  assert.equal(uploaded.src, "https://project.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg?v=2026-11-03T08%3A00%3A00Z");
  assert.equal(portraitChoice({
    avatarPath: null,
    supabaseUrl: "https://project.supabase.co",
    googleUrl: "https://lh3.googleusercontent.com/a/photo",
  }).source, "google");
  assert.equal(publicAvatarUrl("../secret", "https://project.supabase.co", null), null);
});

test("initials use the first two names", () => {
  assert.equal(initials("Sara Ali"), "SA");
  assert.equal(initials("Sara"), "S");
  assert.equal(initials("  "), "T");
});
