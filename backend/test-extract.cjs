const PDFParser = require('pdf2json');
const fs = require('fs');

const testPdfPath = process.argv[2];

if (!testPdfPath) {
  console.error('❌ Please provide a PDF file path:');
  console.log('   node test-extract.cjs "path/to/your/file.pdf"');
  process.exit(1);
}

if (!fs.existsSync(testPdfPath)) {
  console.error('❌ File not found:', testPdfPath);
  process.exit(1);
}

console.log('========================================');
console.log('📄 PDF EXTRACTION TEST');
console.log('========================================');
console.log('File:', testPdfPath);
console.log('');

const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataReady', (pdfData) => {
  console.log('✅ PDF loaded successfully!');
  console.log('📑 Number of pages:', pdfData.Pages?.length || 0);
  console.log('');
  
  // Extract ALL text from PDF
  let fullText = '';
  const pages = pdfData.Pages || [];
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const texts = page.Texts || [];
    
    for (const textItem of texts) {
      const decodedText = decodeURIComponent(textItem.R[0].T);
      fullText += decodedText + ' ';
    }
    fullText += '\n';
  }
  
  console.log('========================================');
  console.log('📝 FULL EXTRACTED TEXT');
  console.log('========================================');
  console.log(fullText);
  console.log('========================================');
  console.log('');
  
  // Split into lines and show
  const lines = fullText.split('\n').filter(l => l.trim());
  console.log(`📊 Total non-empty lines: ${lines.length}`);
  console.log('');
  
  console.log('========================================');
  console.log('🔍 LINE BY LINE ANALYSIS');
  console.log('========================================');
  
  // Show first 50 lines with line numbers
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    console.log(`[${i.toString().padStart(3, '0')}] "${lines[i].trim()}"`);
  }
  
  if (lines.length > 50) {
    console.log(`... and ${lines.length - 50} more lines`);
  }
  
  console.log('');
  console.log('========================================');
  console.log('🔎 PATTERN DETECTION');
  console.log('========================================');
  
  // Days detection
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayMatches = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const day of days) {
      if (line === day || (line.includes(day) && line.length < 30 && !line.includes(':'))) {
        dayMatches.push({ line: i, day, text: line });
        break;
      }
    }
  }
  
  console.log(`📅 Days detected: ${dayMatches.length}`);
  dayMatches.slice(0, 20).forEach(m => {
    console.log(`  Line ${m.line}: "${m.text}" -> Day: ${m.day}`);
  });
  
  console.log('');
  
  // Time slot detection
  const timePatterns = [
    /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/,
    /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/
  ];
  
  const timeMatches = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const pattern of timePatterns) {
      const match = line.match(pattern);
      if (match) {
        timeMatches.push({ line: i, time: `${match[1]}-${match[2]}`, text: line });
        break;
      }
    }
  }
  
  console.log(`⏰ Time slots detected: ${timeMatches.length}`);
  timeMatches.slice(0, 20).forEach(m => {
    console.log(`  Line ${m.line}: "${m.text}" -> Time: ${m.time}`);
  });
  
  console.log('');
  
  // Section detection
  const sectionPattern = /(BS(?:IT|EMC|HM|N|BIO|-BIO)?\s*[A-Z0-9-]+|AB-PHILO\s*\d+[A-Z]?|BSHM\s+OPEN)/i;
  const sectionMatches = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(sectionPattern);
    if (match) {
      sectionMatches.push({ line: i, section: match[1], text: line });
    }
  }
  
  console.log(`📚 Sections detected: ${sectionMatches.length}`);
  sectionMatches.slice(0, 20).forEach(m => {
    console.log(`  Line ${m.line}: "${m.text}" -> Section: ${m.section}`);
  });
  
  console.log('');
  
  // Subject code detection
  const subjectPattern = /([A-Z]{2,5}\s*\d+[A-Z]?|[A-Z]+\d+\s*[A-Z]?\d*)/i;
  const subjectMatches = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(subjectPattern);
    if (match) {
      // Filter out things that look like times
      if (!match[1].includes(':')) {
        subjectMatches.push({ line: i, subject: match[1], text: line });
      }
    }
  }
  
  console.log(`📖 Subject codes detected: ${subjectMatches.length}`);
  subjectMatches.slice(0, 20).forEach(m => {
    console.log(`  Line ${m.line}: "${m.text}" -> Subject: ${m.subject}`);
  });
  
  console.log('');
  
  // Instructor detection
  const instructorPattern = /([A-Z]{3,}(?:\s+[A-Z]\.?\s*[A-Z]+)?|[A-Z]{3,})/;
  const instructorMatches = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(instructorPattern);
    if (match && !match[1].includes(':')) {
      instructorMatches.push({ line: i, instructor: match[1], text: line });
    }
  }
  
  console.log(`👨‍🏫 Instructors detected: ${instructorMatches.length}`);
  instructorMatches.slice(0, 20).forEach(m => {
    console.log(`  Line ${m.line}: "${m.text}" -> Instructor: ${m.instructor}`);
  });
  
  console.log('');
  console.log('========================================');
  console.log('📋 SCHEDULE EXTRACTION SIMULATION');
  console.log('========================================');
  
  // Try to combine into schedules
  const schedules = [];
  let currentDay = '';
  let currentTimeSlot = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Detect day
    for (const day of days) {
      if (line === day || (line.includes(day) && line.length < 30 && !line.includes(':'))) {
        currentDay = day;
        console.log(`\n📍 Day changed to: ${currentDay} (Line ${i})`);
        break;
      }
    }
    
    // Detect time
    for (const pattern of timePatterns) {
      const match = line.match(pattern);
      if (match) {
        currentTimeSlot = `${match[1]}-${match[2]}`;
        console.log(`  ⏰ Time slot: ${currentTimeSlot} (Line ${i})`);
        break;
      }
    }
    
    if (!currentDay || !currentTimeSlot) continue;
    
    // Look for section and subject in current and next 3 lines
    for (let j = 0; j < 4 && i + j < lines.length; j++) {
      const lookLine = lines[i + j].trim();
      
      const sectionMatch = lookLine.match(sectionPattern);
      const subjectMatch = lookLine.match(subjectPattern);
      const instructorMatch = lookLine.match(instructorPattern);
      
      if (sectionMatch && subjectMatch) {
        const schedule = {
          day: currentDay,
          time: currentTimeSlot,
          section: sectionMatch[1].trim(),
          subjectCode: subjectMatch[1].trim(),
          instructor: instructorMatch ? instructorMatch[1].trim() : 'TBA',
          sourceLine: i + j,
          sourceText: lookLine
        };
        
        console.log(`  ✅ Found schedule at line ${i + j}:`);
        console.log(`     Day: ${schedule.day}`);
        console.log(`     Time: ${schedule.time}`);
        console.log(`     Section: ${schedule.section}`);
        console.log(`     Subject: ${schedule.subjectCode}`);
        console.log(`     Instructor: ${schedule.instructor}`);
        console.log(`     Text: "${schedule.sourceText}"`);
        
        schedules.push(schedule);
        break;
      }
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log('📊 FINAL RESULTS');
  console.log('========================================');
  console.log(`Total schedules extracted: ${schedules.length}`);
  console.log('');
  
  if (schedules.length > 0) {
    console.log('Extracted Schedules:');
    console.log('┌──────────┬─────────────┬────────────┬──────────────┬───────────────┬──────────────────┐');
    console.log('│ Day      │ Time        │ Room       │ Section      │ Subject       │ Instructor       │');
    console.log('├──────────┼─────────────┼────────────┼──────────────┼───────────────┼──────────────────┤');
    
    schedules.slice(0, 30).forEach(s => {
      const room = determineRoom(s.sourceText, s.sourceLine, lines);
      console.log(`│ ${s.day.padEnd(8)} │ ${s.time.padEnd(11)} │ ${room.padEnd(10)} │ ${s.section.padEnd(12)} │ ${s.subjectCode.padEnd(13)} │ ${s.instructor.padEnd(16)} │`);
    });
    console.log('└──────────┴─────────────┴────────────┴──────────────┴───────────────┴──────────────────┘');
  }
  
  console.log('');
  console.log('✅ Test complete!');
});

pdfParser.on('pdfParser_dataError', (error) => {
  console.error('❌ PDF parsing error:', error);
});

// Room detection function (simplified)
const determineRoom = (line, lineIndex, allLines) => {
  const roomMap = {
    'ComLab 1': [/ComLab\s*1/i, /Comlab\s*1/i, /CL\s*1\b/i],
    'ComLab 2': [/ComLab\s*2/i, /Comlab\s*2/i, /CL\s*2\b/i],
    'ComLab 3': [/ComLab\s*3/i, /Comlab\s*3/i, /CL\s*3\b/i],
    'ComLab 4': [/ComLab\s*4/i, /Comlab\s*4/i, /CL\s*4\b/i],
    'ComLab 5': [/ComLab\s*5/i, /Comlab\s*5/i, /CL\s*5\b/i],
    'ComLab 6': [/ComLab\s*6/i, /Comlab\s*6/i, /CL\s*6\b/i],
    'ComLab 7': [/ComLab\s*7/i, /Comlab\s*7/i, /CL\s*7\b/i],
    'ComLab 8': [/ComLab\s*8/i, /Comlab\s*8/i, /CL\s*8\b/i]
  };
  
  for (const [room, patterns] of Object.entries(roomMap)) {
    for (const pattern of patterns) {
      if (pattern.test(line)) return room;
    }
  }
  
  for (let j = Math.max(0, lineIndex - 20); j < lineIndex; j++) {
    const prevLine = allLines[j];
    for (const [room, patterns] of Object.entries(roomMap)) {
      for (const pattern of patterns) {
        if (pattern.test(prevLine)) return room;
      }
    }
  }
  
  return 'ComLab 1';
};

console.log('🚀 Loading PDF...');
pdfParser.loadPDF(testPdfPath);