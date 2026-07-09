const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  professor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professor',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    trim: true
  },
  course: {
    type: String,
    required: [true, 'Course is required'],
    trim: true
  },
  semester: {
    type: String,
    required: [true, 'Semester is required']
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    trim: true
  },
  totalClasses: {
    type: Number,
    required: [true, 'Total classes is required'],
    min: [0, 'Total classes cannot be negative']
  },
  classesAttended: {
    type: Number,
    required: [true, 'Classes attended is required'],
    min: [0, 'Classes attended cannot be negative']
  },
  attendancePercentage: {
    type: Number,
    default: 100.0
  },
  attendanceStatus: {
    type: String,
    enum: ['Safe', 'Warning', 'Shortage'],
    default: 'Safe'
  }
}, {
  timestamps: true
});

// Enforce unique roll numbers per professor
StudentSchema.index({ professor: 1, rollNumber: 1 }, { unique: true });

// Pre-save hook to calculate percentage and status
StudentSchema.pre('save', function(next) {
  if (this.classesAttended > this.totalClasses) {
    return next(new Error('Classes attended cannot exceed total classes'));
  }
  
  if (this.totalClasses === 0) {
    this.attendancePercentage = 100.0;
  } else {
    this.attendancePercentage = Number(((this.classesAttended / this.totalClasses) * 100).toFixed(2));
  }
  
  if (this.attendancePercentage < 75) {
    this.attendanceStatus = 'Shortage';
  } else if (this.attendancePercentage < 80) {
    this.attendanceStatus = 'Warning';
  } else {
    this.attendanceStatus = 'Safe';
  }
  
  next();
});

module.exports = mongoose.model('Student', StudentSchema);
