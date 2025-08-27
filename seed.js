const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Import models
const User = require("./models/User");
const Course = require("./models/Course");
const Classroom = require("./models/Classroom");

const MONGO_URI = "mongodb://127.0.0.1:27017/time-table-gen";

async function seed() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to MongoDB ✅");

    // Clear old data
    await User.deleteMany({});
    await Course.deleteMany({});
    await Classroom.deleteMany({});
    console.log("Cleared old data ✅");

    // Classrooms
    await Classroom.insertMany([
      { name: "BA", capacity: 400 }, { name: "BH", capacity: 300 },
      { name: "BG", capacity: 250 }, { name: "BY", capacity: 350 },
      { name: "LT1", capacity: 200 }, { name: "LT2", capacity: 200 },
      { name: "Lab1", capacity: 150 }, { name: "Lab2", capacity: 150 }
    ]);
    console.log("Classrooms seeded ✅");

    // Lecturers
    const hashedPassword = await bcrypt.hash("password123", 10);
    const lecturers = await User.insertMany([
      {
        name: "Dr. Ade",
        email: "ade@school.com",
        role: "lecturer",
        password: hashedPassword,
        department: "computer science",
        specialization: "Artificial Intelligence",
        levels: ["ND1", "ND2"]
      },
      {
        name: "Prof. Bisi",
        email: "bisi@school.com",
        role: "lecturer",
        password: hashedPassword,
        department: "computer science",
        specialization: "Databases",
        levels: ["HND1", "HND2"]
      },
      {
        name: "Dr. Yinka",
        email: "yinka@school.com",
        role: "lecturer",
        password: hashedPassword,
        department: "computer science",
        specialization: "Networking",
        levels: ["ND2", "HND1"]
      }
    ]);
    console.log("Lecturers seeded ✅");

    // Students (30 with unique matric numbers)
    const students = [];
    for (let i = 1; i <= 30; i++) {
      const matricNumber = `N/CS/23/${String(i).padStart(4, "0")}`; // N/CS/23/0001
      students.push({
        name: `Student ${i}`,
        matricNumber,
        role: "student",
        password: hashedPassword,
        department: "computer science",
        level: i % 2 === 0 ? "ND1" : "HND1"
      });
    }
    await User.insertMany(students);
    console.log("30 Students seeded ✅");

    // Courses
    await Course.insertMany([
      { code: "CSC101", title: "Introduction to Computer Science", department: "computer science", level: "ND1", unit: 3, lecturer: lecturers[0]._id },
      { code: "CSC201", title: "Data Structures", department: "computer science", level: "ND2", unit: 3, lecturer: lecturers[2]._id },
      { code: "CSC301", title: "Database Systems", department: "computer science", level: "HND1", unit: 3, lecturer: lecturers[1]._id },
      { code: "CSC401", title: "Artificial Intelligence", department: "computer science", level: "HND2", unit: 3, lecturer: lecturers[0]._id },
      { code: "CSC402", title: "Computer Networks", department: "computer science", level: "HND2", unit: 3, lecturer: lecturers[2]._id }
    ]);
    console.log("Courses seeded ✅");

    console.log("✅ All seeding completed!");
    mongoose.connection.close();
  } catch (error) {
    console.error("Error seeding data ❌", error);
    mongoose.connection.close();
  }
}

seed();
