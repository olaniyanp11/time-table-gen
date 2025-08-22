const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  capacity: { type: Number, required: true },
  location: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Classroom', classroomSchema);
