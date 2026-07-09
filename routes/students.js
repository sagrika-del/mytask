const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const auth = require('../middleware/auth');

// Mock In-Memory Database Fallback for Students
// Structure: student_id -> { _id, professor, name, rollNumber, course, semester, section, totalClasses, classesAttended, attendancePercentage, attendanceStatus, createdAt }
const mockStudents = {}; 

// Helper function to calculate student percentage and status for Mock DB
function calculateStats(total, attended) {
  const totalClasses = parseInt(total) || 0;
  const classesAttended = parseInt(attended) || 0;
  let percentage = 100.0;
  if (totalClasses > 0) {
    percentage = Number(((classesAttended / totalClasses) * 100).toFixed(2));
  }
  
  let status = 'Safe';
  if (percentage < 75) {
    status = 'Shortage';
  } else if (percentage < 80) {
    status = 'Warning';
  }
  
  return { percentage, status };
}

// @route   GET api/students
// @desc    Get all students for a professor with search & filtering
// @access  Private
router.get('/', auth, async (req, res) => {
  const { search, course, semester, section } = req.query;
  const isDbConnected = mongoose.connection.readyState === 1;

  try {
    let formattedStudents = [];

    if (isDbConnected) {
      // Use MongoDB
      let query = { professor: req.user };

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { rollNumber: { $regex: search, $options: 'i' } }
        ];
      }
      if (course) query.course = course;
      if (semester) query.semester = semester;
      if (section) query.section = section;

      const students = await Student.find(query).sort({ rollNumber: 1 });
      
      formattedStudents = students.map(s => ({
        id: s._id,
        name: s.name,
        roll_number: s.rollNumber,
        course: s.course,
        semester: s.semester,
        section: s.section,
        total_classes: s.totalClasses,
        classes_attended: s.classesAttended,
        attendance_percentage: s.attendancePercentage,
        attendance_status: s.attendanceStatus,
        created_at: s.createdAt
      }));
    } else {
      // Use Fallback Mock Database
      const profId = req.user.toString();
      
      const list = Object.values(mockStudents).filter(s => s.professor === profId);
      
      const filtered = list.filter(s => {
        if (search) {
          const sVal = search.toLowerCase();
          const matchesName = s.name.toLowerCase().includes(sVal);
          const matchesRoll = s.rollNumber.toLowerCase().includes(sVal);
          if (!matchesName && !matchesRoll) return false;
        }
        if (course && s.course !== course) return false;
        if (semester && s.semester !== semester.toString()) return false;
        if (section && s.section !== section) return false;
        return true;
      });

      // Sort by roll number
      filtered.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

      formattedStudents = filtered.map(s => ({
        id: s._id,
        name: s.name,
        roll_number: s.rollNumber,
        course: s.course,
        semester: s.semester,
        section: s.section,
        total_classes: s.totalClasses,
        classes_attended: s.classesAttended,
        attendance_percentage: s.attendancePercentage,
        attendance_status: s.attendanceStatus,
        created_at: s.createdAt
      }));
      console.log(`Mock DB Fetched. Found: ${formattedStudents.length} records`);
    }
    
    res.json(formattedStudents);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/students
// @desc    Add a new student record
// @access  Private
router.post('/', auth, async (req, res) => {
  const { name, roll_number, course, semester, section, total_classes, classes_attended } = req.body;

  // Validate fields
  if (!name || !roll_number || !course || !semester || !section || total_classes === undefined || classes_attended === undefined) {
    return res.status(400).json({ message: 'All student fields are required' });
  }

  const total = parseInt(total_classes);
  const attended = parseInt(classes_attended);

  if (isNaN(total) || isNaN(attended) || total < 0 || attended < 0) {
    return res.status(400).json({ message: 'Class counts must be positive integers' });
  }

  if (attended > total) {
    return res.status(400).json({ message: 'Classes attended cannot exceed total classes' });
  }

  const isDbConnected = mongoose.connection.readyState === 1;

  try {
    if (isDbConnected) {
      // Use MongoDB
      const existing = await Student.findOne({
        professor: req.user,
        rollNumber: { $regex: `^${roll_number.trim()}$`, $options: 'i' }
      });

      if (existing) {
        return res.status(400).json({ message: `Student with Roll Number ${roll_number} already exists!` });
      }

      const student = new Student({
        professor: req.user,
        name: name.trim(),
        rollNumber: roll_number.trim(),
        course: course.trim(),
        semester: semester.toString(),
        section: section.trim(),
        totalClasses: total,
        classesAttended: attended
      });

      await student.save();

      res.status(201).json({
        id: student._id,
        name: student.name,
        roll_number: student.rollNumber,
        course: student.course,
        semester: student.semester,
        section: student.section,
        total_classes: student.totalClasses,
        classes_attended: student.classesAttended,
        attendance_percentage: student.attendancePercentage,
        attendance_status: student.attendanceStatus,
        created_at: student.createdAt
      });
    } else {
      // Use Fallback Mock Database
      const profId = req.user.toString();
      const rollTrim = roll_number.trim();

      // Check unique roll
      const list = Object.values(mockStudents).filter(s => s.professor === profId);
      const isDuplicate = list.some(s => s.rollNumber.toLowerCase() === rollTrim.toLowerCase());
      if (isDuplicate) {
        return res.status(400).json({ message: `Student with Roll Number ${roll_number} already exists! (Mock DB)` });
      }

      const newId = new mongoose.Types.ObjectId().toString();
      const { percentage, status } = calculateStats(total, attended);

      const mockStudent = {
        _id: newId,
        professor: profId,
        name: name.trim(),
        rollNumber: rollTrim,
        course: course.trim(),
        semester: semester.toString(),
        section: section.trim(),
        totalClasses: total,
        classesAttended: attended,
        attendancePercentage: percentage,
        attendanceStatus: status,
        createdAt: new Date().toISOString()
      };

      mockStudents[newId] = mockStudent;
      console.log(`Mock DB Student Added: ${mockStudent.name}`);

      res.status(201).json({
        id: mockStudent._id,
        name: mockStudent.name,
        roll_number: mockStudent.rollNumber,
        course: mockStudent.course,
        semester: mockStudent.semester,
        section: mockStudent.section,
        total_classes: mockStudent.totalClasses,
        classes_attended: mockStudent.classesAttended,
        attendance_percentage: mockStudent.attendancePercentage,
        attendance_status: mockStudent.attendanceStatus,
        created_at: mockStudent.createdAt
      });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/students/:id
// @desc    Edit a student record
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const { name, roll_number, course, semester, section, total_classes, classes_attended } = req.body;
  const studentId = req.params.id;

  // Validate fields
  if (!name || !roll_number || !course || !semester || !section || total_classes === undefined || classes_attended === undefined) {
    return res.status(400).json({ message: 'All student fields are required' });
  }

  const total = parseInt(total_classes);
  const attended = parseInt(classes_attended);

  if (isNaN(total) || isNaN(attended) || total < 0 || attended < 0) {
    return res.status(400).json({ message: 'Class counts must be positive integers' });
  }

  if (attended > total) {
    return res.status(400).json({ message: 'Classes attended cannot exceed total classes' });
  }

  const isDbConnected = mongoose.connection.readyState === 1;

  try {
    if (isDbConnected) {
      // Use MongoDB
      let student = await Student.findOne({ _id: studentId, professor: req.user });
      if (!student) {
        return res.status(404).json({ message: 'Student record not found' });
      }

      // Check unique roll
      const existing = await Student.findOne({
        professor: req.user,
        rollNumber: { $regex: `^${roll_number.trim()}$`, $options: 'i' },
        _id: { $ne: studentId }
      });

      if (existing) {
        return res.status(400).json({ message: `Another student with Roll Number ${roll_number} already exists!` });
      }

      student.name = name.trim();
      student.rollNumber = roll_number.trim();
      student.course = course.trim();
      student.semester = semester.toString();
      student.section = section.trim();
      student.totalClasses = total;
      student.classesAttended = attended;

      await student.save();

      res.json({
        message: 'Record updated successfully!',
        attendance_percentage: student.attendancePercentage
      });
    } else {
      // Use Fallback Mock Database
      const profId = req.user.toString();
      const mockStudent = mockStudents[studentId];

      if (!mockStudent || mockStudent.professor !== profId) {
        return res.status(404).json({ message: 'Student record not found (Mock DB)' });
      }

      // Check unique roll
      const rollTrim = roll_number.trim();
      const list = Object.values(mockStudents).filter(s => s.professor === profId && s._id !== studentId);
      const isDuplicate = list.some(s => s.rollNumber.toLowerCase() === rollTrim.toLowerCase());
      if (isDuplicate) {
        return res.status(400).json({ message: `Another student with Roll Number ${roll_number} already exists! (Mock DB)` });
      }

      const { percentage, status } = calculateStats(total, attended);

      mockStudent.name = name.trim();
      mockStudent.rollNumber = rollTrim;
      mockStudent.course = course.trim();
      mockStudent.semester = semester.toString();
      mockStudent.section = section.trim();
      mockStudent.totalClasses = total;
      mockStudent.classesAttended = attended;
      mockStudent.attendancePercentage = percentage;
      mockStudent.attendanceStatus = status;

      console.log(`Mock DB Student Updated: ${mockStudent.name}`);

      res.json({
        message: 'Record updated successfully! (Mock DB)',
        attendance_percentage: mockStudent.attendancePercentage
      });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE api/students/:id
// @desc    Delete a student record
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const studentId = req.params.id;

  try {
    if (isDbConnected) {
      // Use MongoDB
      const result = await Student.deleteOne({ _id: studentId, professor: req.user });
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Student record not found' });
      }
    } else {
      // Use Fallback Mock Database
      const profId = req.user.toString();
      const mockStudent = mockStudents[studentId];

      if (!mockStudent || mockStudent.professor !== profId) {
        return res.status(404).json({ message: 'Student record not found (Mock DB)' });
      }

      delete mockStudents[studentId];
      console.log(`Mock DB Student Deleted ID: ${studentId}`);
    }

    res.json({ message: 'Student record deleted successfully!' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
