const fs = require('fs');
const mammoth = require('mammoth');

console.log('✅ mammoth loaded for DOCX table parsing');

const parseSchedulePDF = async (filePath) => {
  console.log('📄 Starting DOCX table parsing...');

  return new Promise(async (resolve, reject) => {
    try {
      const isDocx = filePath.toLowerCase().endsWith('.docx');
      
      if (!isDocx) {
        return resolve({
          success: false, pdfType: 'unknown', schedules: [],
          rooms: ['ComLab 1', 'ComLab 2', 'ComLab 3', 'ComLab 4',
                  'ComLab 5', 'ComLab 6', 'ComLab 7', 'ComLab 8'],
          totalExtracted: 0, error: 'Please upload the original DOCX file'
        });
      }

      const result = await mammoth.convertToHtml({ path: filePath });
      const html = result.value;
      
      console.log(`📊 Extracted HTML: ${html.length} characters`);

      const schedules = parseDocxTable(html);

      if (schedules.length > 0) {
        console.log(`\n✅ EXTRACTED ${schedules.length} SCHEDULES!`);
        
        const dayCounts = {};
        schedules.forEach(s => { dayCounts[s.day] = (dayCounts[s.day] || 0) + 1; });
        console.log('\n📊 By day:');
        Object.entries(dayCounts).sort().forEach(([d, c]) => console.log(`   ${d}: ${c}`));

        const roomCounts = {};
        schedules.forEach(s => { roomCounts[s.room] = (roomCounts[s.room] || 0) + 1; });
        console.log('\n📊 By room:');
        for (let i = 1; i <= 8; i++) console.log(`   ComLab ${i}: ${roomCounts[`ComLab ${i}`] || 0}`);

        console.log('\n📋 Samples:');
        schedules.filter(s => s.section).slice(0, 15).forEach(s => {
          console.log(`   ${s.day} | ${s.time} | ${s.room} | ${s.section} | ${s.subjectCode} | ${s.instructor}`);
        });
      }

      try { fs.unlinkSync(filePath); } catch (e) {}
      
      resolve({
        success: schedules.length > 0,
        pdfType: 'schedule',
        schedules: schedules,
        rooms: ['ComLab 1', 'ComLab 2', 'ComLab 3', 'ComLab 4',
                'ComLab 5', 'ComLab 6', 'ComLab 7', 'ComLab 8'],
        totalExtracted: schedules.length,
        method: 'docx_table'
      });

    } catch (error) {
      console.error('❌ Error:', error.message);
      reject(error);
    }
  });
};

function parseDocxTable(html) {
  const schedules = [];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/gi;

  const rows = [];
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells = [];
    let cellMatch;
    const rowHTML = rowMatch[1];
    while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
      let text = cellMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(text);
    }
    if (cells.length > 0) rows.push(cells);
  }

  console.log(`📊 Found ${rows.length} rows`);

  let currentDay = null;
  let dataRow = null;       // The row that has actual data
  let dataStartTime = null; // First time slot of the block
  let dataEndTime = null;   // Last time slot of the block
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const firstCell = (row[0] || '').trim();

    // Check for day header
    for (const day of days) {
      if (firstCell === day || (firstCell.includes(day) && row.length < 5)) {
        // Save previous day's last block
        if (dataRow) {
          const timeRange = `${dataStartTime}-${dataEndTime.split('-')[1]}`;
          addSchedulesFromRow(dataRow, currentDay, timeRange, schedules);
          dataRow = null;
        }
        
        currentDay = day;
        dataRow = null;
        dataStartTime = null;
        dataEndTime = null;
        console.log(`\n📅 Day: ${currentDay}`);
        continue;
      }
    }

    if (!currentDay) continue;

    // Check for time pattern
    const timeMatch = firstCell.match(/^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
    if (!timeMatch) continue;

    const timeSlot = `${timeMatch[1]}-${timeMatch[2]}`;

    // Check if this row has data in ANY room column (odd columns 1,3,5,7,9,11,13,15)
    let hasData = false;
    for (let r = 0; r < 8; r++) {
      const col = 1 + (r * 2);
      if (col < row.length && (row[col] || '').trim().length > 0) {
        hasData = true;
        break;
      }
    }

    if (hasData) {
      // Save previous block if exists
      if (dataRow) {
        const timeRange = `${dataStartTime}-${dataEndTime.split('-')[1]}`;
        addSchedulesFromRow(dataRow, currentDay, timeRange, schedules);
      }
      // Start new block
      dataRow = row;
      dataStartTime = timeSlot;
      dataEndTime = timeSlot;
    } else if (dataRow) {
      // Empty row - extends the current block
      dataEndTime = timeSlot;
    }
  }

  // Save last block
  if (dataRow) {
    const timeRange = `${dataStartTime}-${dataEndTime.split('-')[1]}`;
    addSchedulesFromRow(dataRow, currentDay, timeRange, schedules);
  }

  // Remove duplicates
  const unique = [];
  const seen = new Set();
  schedules.forEach(s => {
    const key = `${s.day}|${s.time}|${s.room}|${s.section}`;
    if (!seen.has(key)) { seen.add(key); unique.push(s); }
  });

  console.log(`\n📊 ${unique.length} unique schedules`);
  return unique;
}

function cleanScheduleTime(time) {
  const parts = String(time || '')
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) {
    return String(time || '').trim();
  }

  return `${parts[0]}-${parts[parts.length - 1]}`;
}

function addSchedulesFromRow(row, currentDay, timeRange, schedules) {
  for (let roomIdx = 0; roomIdx < 8; roomIdx++) {
    const dataCol = 1 + (roomIdx * 2); // Columns 1, 3, 5, 7, 9, 11, 13, 15
    
    if (dataCol >= row.length) continue;
    
    const cellText = (row[dataCol] || '').trim();
    
    if (!cellText) continue; // Skip empty rooms - don't add them
    
    // Parse cell text - may have newlines or be space-separated
    const parts = cellText.includes('\n') 
      ? cellText.split('\n').map(l => l.trim()).filter(l => l)
      : cellText.split(/\s+/);
    
    let section = '';
    let subjectCode = '';
    let instructor = '';

    for (let p = 0; p < parts.length; p++) {
      const part = parts[p].trim();
      if (!part) continue;
      
      // Section: starts with BS, AB, BSHM, BSN, BIO
      if (!section && /^(BS|AB|BSHM|BSN|BIO)/i.test(part)) {
        section = part;
        // Next part might be section modifier like "3F", "2A", "OPEN"
        if (p + 1 < parts.length && /^[0-9A-Z]+$/.test(parts[p + 1]) && parts[p + 1].length <= 4 && !/^\d+$/.test(parts[p + 1])) {
          section += ' ' + parts[p + 1];
          p++; // Skip the modifier
        }
      }
      // Subject: letters followed by numbers (IT137, CC122, etc.)
      else if (!subjectCode && /^[A-Z]{2,5}\d/.test(part) && !/^(BS|AB)/i.test(part)) {
        subjectCode = part;
      }
      // Subject prefix only (like "IT") - next part is number
      else if (!subjectCode && /^[A-Z]{2,5}$/.test(part) && !/^(BS|AB|BSHM|BSN|BIO)$/i.test(part)) {
        if (p + 1 < parts.length && /^\d+/.test(parts[p + 1])) {
          subjectCode = part + ' ' + parts[p + 1];
          p++; // Skip the number
        } else {
          subjectCode = part;
        }
      }
      // Instructor: ALL CAPS, 3+ letters
      else if (!instructor && /^[A-Z]{3,}$/.test(part) && part.length >= 3) {
        instructor = part;
      }
    }

    // Only add if we have at least a section or subject
    if (section || subjectCode) {
      schedules.push({
        day: currentDay,
        time: cleanScheduleTime(timeRange),
        room: `ComLab ${roomIdx + 1}`,
        section: section,
        subjectCode: subjectCode,
        instructor: instructor
      });
    }
  }
}

const isMajorSubject = (code) => /^IT|^CS|^EMC|^DA|^CC/.test(code?.toUpperCase());

const processSchedules = async (schedules, Classroom, Instructor) => {
  const processed = [];
  for (const s of schedules) {
    const roomNum = s.room.match(/\d+/)?.[0] || '1';
    const classroom = await Classroom.findOne({ name: { $regex: new RegExp(`ComLab ${roomNum}`, 'i') } });
    let instructor = null;
    if (s.instructor?.length > 2) {
      const lastName = s.instructor.split(' ').pop();
      instructor = await Instructor.findOne({ name: { $regex: new RegExp(lastName, 'i') } });
    }
    processed.push({
      day: s.day || '', time: s.time || '', room: `ComLab ${roomNum}`,
      section: s.section || '', subjectCode: s.subjectCode || '', instructor: s.instructor || '',
      classroomId: classroom?._id || null, classroomExists: !!classroom,
      instructorId: instructor?._id || null, instructorExists: !!instructor,
      validationStatus: classroom ? 'ready' : 'needs_classroom',
      isComLab: true, isMajor: isMajorSubject(s.subjectCode || '')
    });
  }
  return processed;
};

module.exports = { parseSchedulePDF, processSchedules, isMajorSubject, cleanScheduleTime };
