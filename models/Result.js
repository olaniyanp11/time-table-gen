// models/Result.js
const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ✅ Fix
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  score: { type: Number, required: true },
  grade: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
