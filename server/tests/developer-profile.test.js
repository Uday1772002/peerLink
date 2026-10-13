const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/user");
const { validateEditProfileData } = require("../src/utils/validation");
const { isValidGithubUrl, isValidProjectUrl, getFeedFilters } = require("../src/utils/developerProfile");

const details = {
  location: "Bengaluru", experienceLevel: "intermediate", interests: ["project-partner", "cofounder"],
  githubUrl: "https://github.com/test-user",
  projects: [{ title: "DevTinder", description: "Connect developers", url: "https://github.com/test-user/devtinder" }],
};
const fixture = (fields = {}) => new User({ firstName: "Test", email: "test@example.com", password: "StrongPassword1!", ...fields });

test("new developer fields validate and old profiles remain compatible", () => {
  assert.equal(validateEditProfileData({ body: details }), true);
  assert.equal(fixture(details).validateSync(), undefined);
  assert.equal(fixture().validateSync(), undefined);
  assert.equal(validateEditProfileData({ body: { location: "", experienceLevel: "", interests: [], githubUrl: "", projects: [] } }), true);
});

test("GitHub profiles use HTTPS on the exact domain and cannot be repository or login URLs", () => {
  for (const url of ["https://github.com/test-user", "https://github.com/test-user/", ""]) assert.equal(isValidGithubUrl(url), true);
  for (const url of ["javascript:alert(1)", "http://github.com/user", "https://github.com.evil.com/user", "https://user:password@github.com/user", "https://github.com/user/repo", "https://github.com/user?tab=repositories", "https://github.com/", "https://github.com/" + "a".repeat(40)]) assert.equal(isValidGithubUrl(url), false, url);
});

test("project links accept repositories and demos but reject unsafe links", () => {
  assert.equal(isValidProjectUrl("https://github.com/user/repo"), true);
  assert.equal(isValidProjectUrl("https://demo.example.com/"), true);
  for (const url of ["javascript:alert(1)", "data:text/html,test", "http://example.com", "https://user:password@example.com", "bad", ""]) assert.equal(isValidProjectUrl(url), false, url);
});

test("profile edits validate interests, experience, field types, and project limits", () => {
  for (const body of [
    { location: {} }, { location: "a".repeat(101) }, { experienceLevel: "expert" },
    { interests: "mentor" }, { interests: ["invalid"] }, { githubUrl: 123 },
    { projects: Array(4).fill(details.projects[0]) }, { projects: [null] },
    { projects: [{ ...details.projects[0], title: " " }] },
    { projects: [{ ...details.projects[0], description: "a".repeat(301) }] },
    { projects: [{ ...details.projects[0], url: "javascript:alert(1)" }] },
    { projects: [{ ...details.projects[0], userId: "someone-else" }] },
  ]) assert.throws(() => validateEditProfileData({ body }), undefined, JSON.stringify(body));
  assert.equal(validateEditProfileData({ body: { isPremium: true } }), false);
  assert.ok(fixture({ projects: Array(4).fill(details.projects[0]) }).validateSync());
  assert.ok(fixture({ githubUrl: "javascript:alert(1)" }).validateSync());
});

test("feed combines skill, location, experience, and interest filters", () => {
  const filters = getFeedFilters({ skills: "React, Node.js", location: "Bengaluru", experienceLevel: "intermediate", interest: "project-partner" });
  assert.equal(filters.length, 4);
  assert.equal(filters[0].skills.$in[0].test(" react "), true);
  assert.equal(filters[0].skills.$in[0].test("React Native"), false);
  assert.equal(filters[0].skills.$in[1].test("NODE.JS"), true);
  assert.equal(filters[1].location.test("Bengaluru, India"), true);
  assert.deepEqual(filters[2], { experienceLevel: "intermediate" });
  assert.deepEqual(filters[3], { interests: "project-partner" });
});

test("regex characters in filters are treated literally", () => {
  const filters = getFeedFilters({ skills: "C++, .*", location: "(London)" });
  assert.equal(filters[0].skills.$in[0].test("C++"), true);
  assert.equal(filters[0].skills.$in[0].test("CCC"), false);
  assert.equal(filters[0].skills.$in[1].test("anything"), false);
  assert.equal(filters[1].location.test("(London)"), true);
  assert.equal(filters[1].location.test("London"), false);
});

test("invalid and oversized filters fail before querying the database", () => {
  for (const query of [
    { skills: { $ne: "" } }, { location: ["London"] }, { interest: "bad" },
    { experienceLevel: "bad" }, { skills: Array(11).fill("React").join(",") },
    { skills: "a".repeat(51) }, { location: "a".repeat(101) },
  ]) assert.throws(() => getFeedFilters(query));
  assert.deepEqual(getFeedFilters({}), []);
  assert.deepEqual(getFeedFilters({ skills: " , ", location: " " }), []);
});
