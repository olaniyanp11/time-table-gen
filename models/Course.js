const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, "Course code is required"],
    unique: true,
    uppercase: true,
    trim: true
  },
  title: {
    type: String,
    required: [true, "Course title is required"],
    trim: true
  },
  unit: {
    type: Number,
    required: [true, "Course unit is required"],
    min: 1,
    max: 6
  },
  department: {
    type: String,
    required: [true, "Department is required"]
  },
  lecturer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // must reference a lecturer
    required: true,
    validate: {
      validator: async function (userId) {
        const User = mongoose.model("User");
        const user = await User.findById(userId);
        return user && user.role === "lecturer";
      },
      message: "Assigned user must be a lecturer"
    }
  },
  level: {
    type: [String],
    enum: ['ND1', 'ND2', 'HND1', 'HND2'],
    required: [true, "Level is required"]
  }
},

 { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);
