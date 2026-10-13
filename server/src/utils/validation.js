const validator = require("validator");
const { experienceLevels, developerInterests, isValidGithubUrl, isValidProjectUrl } = require("./developerProfile");

const isValidPhotoUrl = (value) => {
  if (!value || typeof value !== "string") return false;
  return validator.isURL(value) || value.startsWith("data:image/");
};

const validateSignupData = (req) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName) {
    throw new Error("Input is not valid");
  } else if (!validator.isEmail(email)) {
    throw new Error("Email is not valid");
  } else if (!validator.isStrongPassword(password)) {
    throw new Error("Invalid password should contain special Characters");
  }
};

const validateEditProfileData = (req) => {
  const allowedEditFields = [
    "firstName",
    "lastName",
    "age",
    "photoUrl",
    "about",
    "skills",
    "gender",
    "location",
    "experienceLevel",
    "interests",
    "githubUrl",
    "projects",
  ];
  const isEditAllowed = Object.keys(req.body).every((k) =>
    allowedEditFields.includes(k),
  );
  if (!isEditAllowed) return false;
  const { location, experienceLevel, interests, githubUrl, projects } = req.body;
  if (location !== undefined && (typeof location !== "string" || location.length > 100)) throw new Error("Location must be under 100 characters");
  if (experienceLevel !== undefined && ![...experienceLevels, ""].includes(experienceLevel)) throw new Error("Invalid experience level");
  if (interests !== undefined && (!Array.isArray(interests) || interests.length > 4 || !interests.every((interest) => developerInterests.includes(interest)))) throw new Error("Invalid developer interests");
  if (githubUrl !== undefined && (typeof githubUrl !== "string" || !isValidGithubUrl(githubUrl.trim()))) throw new Error("Use a valid GitHub profile URL");
  if (projects !== undefined) {
    if (!Array.isArray(projects) || projects.length > 3) throw new Error("Showcase up to 3 projects");
    for (const project of projects) {
      if (!project || typeof project !== "object" || Array.isArray(project) || !Object.keys(project).every((key) => ["_id", "title", "description", "url"].includes(key))) throw new Error("Invalid project details");
      if (typeof project.title !== "string" || !project.title.trim() || project.title.length > 80) throw new Error("Project titles must contain 1 to 80 characters");
      if (project.description !== undefined && (typeof project.description !== "string" || project.description.length > 300)) throw new Error("Project descriptions must be under 300 characters");
      if (typeof project.url !== "string" || !isValidProjectUrl(project.url.trim())) throw new Error("Use a valid HTTPS project link");
    }
  }
  return true;
};

module.exports = {
  validateSignupData,
  validateEditProfileData,
  isValidPhotoUrl,
};
