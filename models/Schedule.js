const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  lecturer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // <-- use 'User' here
    required: true,
    validate: {
      validator: async function(userId) {
        const User = mongoose.model('User');
        const user = await User.findById(userId);
        return user && user.role === 'lecturer';
      },
      message: 'Assigned user must be a lecturer'
    }
  },
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },
  day: {
    type: String,
    enum: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
    required: true
  },
  time: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
