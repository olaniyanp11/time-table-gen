const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, "Email is invalid"]
  },
  role: {
    type: String,
    enum: ['admin', 'lecturer', 'student'],
    default: 'student'
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6
  },
  department: {
    type: String,
    required: function() { return this.role === 'lecturer' || this.role === 'student'; }
  },
  specialization: {
    type: String,
    required: function() { return this.role === 'lecturer'; }
  },
  level: {
    type: String,
    enum: ['ND1','ND2','HND1','HND2'],
    required: function() { return this.role === 'student'; }
  },
  levels: {
    type: [String],
    enum: ['ND1','ND2','HND1','HND2'],
    required: function() { return this.role === 'lecturer'; }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
