const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userName: {
      required: true,
      type: String,
      trim: true,
      minLength: 3,
      maxLength: 30,
    },
    email: {
      required: true,
      type: String,
      trim: true,
      lowercase: true,
      minLength: 5,
      maxLength: 100,
      unique: true,
    },
    password: {
      required: true,
      type: String,
      minLength: 8,
      maxLength: 256,
      trim: true,
    },
    courses: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Course",
      default: [],
    },
    verified: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: Number,
      unique: true,
      sparse: true,
    },
    admin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
