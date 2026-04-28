import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import Classroom from '../models/Classroom.js';
import Instructor from '../models/Instructor.js';

// Use createRequire to import CommonJS module
const require = createRequire(import.meta.url);
const {
  parseSchedulePDF,
  processSchedules,
  cleanScheduleTime,
} = require('../utils/pdfParser.cjs');

// Configure multer for PDF upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/temp';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

export const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || 
      file.originalname.endsWith('.docx') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and DOCX files are allowed'));
  }
}
});

// Upload and parse schedule PDF
export const uploadSchedule = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }
    
    const result = await parseSchedulePDF(req.file.path);
    
    if (!result.success) {
      return res.status(500).json({ message: result.error });
    }
    
    const processedSchedules = await processSchedules(
      result.schedules, 
      Classroom, 
      Instructor
    );
    
    res.json({
      success: true,
      pdfType: result.pdfType,
      schedules: processedSchedules,
      rooms: result.rooms,
      totalExtracted: result.totalExtracted
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Bulk import schedules to classrooms
export const bulkImportSchedules = async (req, res, next) => {
  try {
    const { schedules } = req.body;
    
    if (!schedules || !Array.isArray(schedules)) {
      return res.status(400).json({ message: 'Invalid schedules data' });
    }
    
    const results = [];
    let addedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    for (const schedule of schedules) {
      // Find classroom by room name
      const classroom = await Classroom.findOne({ 
        name: { $regex: new RegExp(schedule.room, 'i') }
      });
      
      if (classroom) {
        const newSchedule = {
          day: schedule.day,
          time: cleanScheduleTime(schedule.time),
          section: schedule.section,
          subjectCode: schedule.subjectCode,
          instructor: schedule.instructor
        };
        
        // Initialize schedules array if it doesn't exist
        if (!classroom.schedules) {
          classroom.schedules = [];
        }
        
        // Check if schedule already exists (same day, time, and section)
        const isDuplicate = classroom.schedules.some(s => 
          s.day === newSchedule.day && 
          s.time === newSchedule.time &&
          s.section === newSchedule.section
        );
        
        if (!isDuplicate) {
          classroom.schedules.push(newSchedule);
          await classroom.save();
          addedCount++;
          
          results.push({ 
            room: schedule.room, 
            status: 'added',
            schedule: newSchedule 
          });
        } else {
          duplicateCount++;
          results.push({ 
            room: schedule.room, 
            status: 'duplicate',
            schedule: newSchedule 
          });
        }
      } else {
        errorCount++;
        results.push({ 
          room: schedule.room, 
          status: 'room_not_found' 
        });
      }
    }
    
    const summary = {
      total: results.length,
      added: addedCount,
      duplicates: duplicateCount,
      errors: errorCount
    };
    
    res.json({ 
      success: true, 
      results,
      summary,
      message: `Imported ${addedCount} schedules (${duplicateCount} duplicates, ${errorCount} errors)`
    });
    
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ message: error.message });
  }
};
