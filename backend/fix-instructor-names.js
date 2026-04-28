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
  
  // Find records with spaces in instructorName (full names)
  const records = await TimeIn.find({ 
    instructorName: { $regex: / / },
    instructorName: { $not: /^[A-Z]{3,}$/ }  // Not already ALL CAPS like "RABANES"
  });
  
  let fixed = 0;
  for (const record of records) {
    const parts = record.instructorName.trim().split(' ');
    const lastName = parts[parts.length - 1].toUpperCase();
    console.log(`  "${record.instructorName}" → "${lastName}"`);
    record.instructorName = lastName;
    await record.save();
    fixed++;
  }
  
  console.log(`\n✅ Fixed ${fixed} time-in instructor names`);
  process.exit();
}).catch(err => { console.error(err); process.exit(1); });