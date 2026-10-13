const validator = require("validator");

const experienceLevels = ["beginner", "intermediate", "experienced"];
const developerInterests = ["project-partner", "mentor", "mentee", "cofounder"];

const isValidGithubUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" &&
      !url.username && !url.password && !url.port && !url.search && !url.hash &&
      /^\/[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?\/?$/.test(url.pathname);
  } catch {
    return false;
  }
};

const isValidProjectUrl = (value) => {
  if (typeof value !== "string" || value.length > 500) return false;
  return validator.isURL(value, { protocols: ["https"], require_protocol: true, disallow_auth: true });
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getFeedFilters = (query) => {
  const filters = [];
  for (const field of ["skills", "location", "experienceLevel", "interest"]) {
    if (query[field] !== undefined && typeof query[field] !== "string") {
      throw new Error("Invalid " + field + " filter");
    }
  }
  if (query.skills?.trim()) {
    const skills = query.skills.split(",").map((skill) => skill.trim()).filter(Boolean);
    if (skills.length > 10 || skills.some((skill) => skill.length > 50)) throw new Error("Use up to 10 skills, each under 50 characters");
    if (skills.length) filters.push({ skills: { $in: skills.map((skill) => new RegExp("^\\s*" + escapeRegex(skill) + "\\s*$", "i")) } });
  }
  if (query.location?.trim()) {
    if (query.location.length > 100) throw new Error("Location must be under 100 characters");
    filters.push({ location: new RegExp(escapeRegex(query.location.trim()), "i") });
  }
  if (query.experienceLevel) {
    if (!experienceLevels.includes(query.experienceLevel)) throw new Error("Invalid experience level");
    filters.push({ experienceLevel: query.experienceLevel });
  }
  if (query.interest) {
    if (!developerInterests.includes(query.interest)) throw new Error("Invalid developer interest");
    filters.push({ interests: query.interest });
  }
  return filters;
};

module.exports = { experienceLevels, developerInterests, isValidGithubUrl, isValidProjectUrl, getFeedFilters };
