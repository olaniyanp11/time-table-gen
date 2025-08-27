const mongoose = require('mongoose');
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, "Email is invalid"],
    required: function () { return this.role !== 'student'; }
  },
  matricNumber: {
    type: String,
    required: function () { return this.role === 'student'; },
    lowercase: true
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

// Partial indexes for conditional uniqueness
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { role: { $ne: 'student' } } });
userSchema.index({ matricNumber: 1 }, { unique: true, partialFilterExpression: { role: 'student' } });

// Hash password before save


module.exports = mongoose.model('User', userSchema);
