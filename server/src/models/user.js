const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, minlength: 2 },
    lastName: { type: String },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid Email Address" + value);
        }
      },
    },
    password: {
      type: String,
      required: true,
      validate(value) {
        if (!validator.isStrongPassword(value)) {
          throw new Error("password is not strong enough: " + value);
        }
      },
    },
    age: {
      type: Number,
      min: 18,
      validate(value) {
        if (value < 18) {
          throw new Error("Age must be at least 18");
        }
      },
    },
    gender: {
      type: String,
      enum: {
        values: ["male", "female", "other"],
        message: `{$VALUE} is not supported `,
      },
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    membershipType: {
      type: String,
      // enum: {
      //   values: ["silver", "gold", "premium"],
      //   message: `{$VALUE} is not supported `,
      // },
    },
    membershipValidUntil: {
      type: Date,
    },
    photoUrl: {
      type: String,
      validate(value) {
        if (!value) return;
        const isValid =
          validator.isURL(value) || value.startsWith("data:image/");
        if (!isValid) {
          throw new Error("Invalid PhotoUrl" + value);
        }
      },
    },
    about: {
      type: String,
      // default: "This user prefers to keep an air of mystery about them.",
    },

    skills: { type: [String] },

    // createdAt: { type: Date, default: Date.now() },
    // updatedAt: { type: Date, default: Date.now() },
  },
  {
    timestamps: true,
  },
);

userSchema.methods.getJWT = async function () {
  const user = this;
  console.log("THE SECRET IS:", process.env.JWT_SECRET); // Or whatever your variable is named
  const token = await jwt.sign(
    { _id: user._id },
    String(process.env.JWT_SECRET).trim(),
    {
      expiresIn: "10d",
    },
  );
  return token;
};

userSchema.methods.validatePassword = async function (passwordInputByUser) {
  const user = this;
  const isPasswordValid = await bcrypt.compare(
    passwordInputByUser,
    user.password,
  );

  return isPasswordValid;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
