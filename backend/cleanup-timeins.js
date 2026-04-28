import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/classroom_utilization';

mongoose.connect(MONGO_URI).then(async () => {
  const TimeIn = (await import('./models/TimeIn.js')).default;
  
  console.log('🔍 Scanning time-in records...\n');

  // ===== STEP 1: Fix records with full names that have section/subject =====
  const toFix = await TimeIn.find({
    instructorName: { $regex: / / },
    instructorName: { $not: /^[A-Z]{3,}$/ },
    section: { $ne: '' },
    subjectCode: { $ne: '' }
  });

  console.log(`📝 Records to FIX (good data, just fix name): ${toFix.length}`);
  for (const record of toFix) {
    const lastName = record.instructorName.split(' ').pop().toUpperCase();
    console.log(`   ✅ "${record.instructorName}" → "${lastName}" | ${record.section} | ${record.subjectCode}`);
    record.instructorName = lastName;
    await record.save();
  }

  // ===== STEP 2: Delete records with no section/subject =====
  const toDelete = await TimeIn.find({
    $or: [
      { section: { $in: ['', null] } },
      { section: { $exists: false } },
      { subjectCode: { $in: ['', null] } },
      { subjectCode: { $exists: false } },
    ]
  });

  console.log(`\n🗑️  Records to DELETE (incomplete data): ${toDelete.length}`);
  for (const record of toDelete) {
    console.log(`   ❌ "${record.instructorName}" | Section: "${record.section || 'EMPTY'}" | Subject: "${record.subjectCode || 'EMPTY'}"`);
  }

  if (toDelete.length > 0) {
    const result = await TimeIn.deleteMany({
      _id: { $in: toDelete.map(r => r._id) }
    });
    console.log(`\n   Deleted: ${result.deletedCount} records`);
  }

  // ===== STEP 3: Delete specific problematic records by ID =====
  // Add any specific IDs you want to delete here
  const specificIds = [
    '69ee63c6b6ed0265dbf993fc',  // LABASTIDA - timed in at wrong time
    // Add more IDs as needed
  ];
  
  if (specificIds.length > 0) {
    const specificResult = await TimeIn.deleteMany({
      _id: { $in: specificIds }
    });
    console.log(`\n🗑️  Deleted ${specificResult.deletedCount} specific problematic records`);
  }

  // ===== STEP 4: Summary =====
  const remaining = await TimeIn.countDocuments();
  console.log(`\n✅ Done!`);
  console.log(`   Fixed: ${toFix.length} records`);
  console.log(`   Deleted: ${toDelete.length + (specificIds.length > 0 ? 1 : 0)} records`);
  console.log(`   Remaining: ${remaining} records`);
  
  process.exit();
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});