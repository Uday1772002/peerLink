const validator = require("validator");

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
  ];
  const isEditAllowed = Object.keys(req.body).every((k) =>
    allowedEditFields.includes(k),
  );
  return isEditAllowed;
};

module.exports = {
  validateSignupData,
  validateEditProfileData,
  isValidPhotoUrl,
};
