const mongoose = require("mongoose");

const videoQualitySchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    bandwidth: {
      type: Number,
      required: true,
      min: 0,
    },
    playlist: {
      type: String,
      required: true,
      trim: true,
    },
    resolution: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    videoId: {
      type: String,
      required: true,
      trim: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    keyHex: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9a-f]{32}$/i,
      select: false,
    },
    qualities: {
      type: [videoQualitySchema],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "الفيديو يجب أن يحتوي على جودة واحدة على الأقل",
      },
    },
  },
  { _id: true },
);

const chapterSchema = new mongoose.Schema(
  {
    chapTitle: {
      type: String,
      required: true,
      trim: true,
    },
    videos: {
      type: [videoSchema],
      default: [],
    },
  },
  { _id: true },
);

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minLength: 8,
      maxLength: 256,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minLength: 8,
      maxLength: 2400,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    learnPoint: {
      type: [String],
      default: [],
    },
    thumbnail: {
      type: String,
    },
    students: {
      type: Number,
      default: 0,
      min: 0,
    },
    lang: {
      type: String,
      required: true,
      trim: true,
    },
    hours: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lecturesNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    chapters: {
      type: [chapterSchema],
      default: [],
    },
  },
  { timestamps: true },
);
courseSchema.index({ "chapters.videos.videoId": 1 });

module.exports = mongoose.model("Course", courseSchema);
