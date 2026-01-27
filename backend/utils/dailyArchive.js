import cron from 'node-cron';
import TimeIn from '../models/TimeIn.js';
import Report from '../models/Report.js';
import User from '../models/User.js';

/**
 * Archive daily time-in records to reports
 * This function moves yesterday's records to a daily report before archiving them
 */
const archiveDailyRecords = async () => {
  try {
    console.log('Starting daily archive process...');
    
    // Get yesterday's date (start and end of day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    
    // Find all time-in records from yesterday that are not archived
    const yesterdayRecords = await TimeIn.find({
      date: {
        $gte: yesterday,
        $lte: endOfYesterday
      },
      isArchived: false
    })
      .populate('student', 'firstName lastName email employeeId department')
      .populate('classroom', 'name location capacity')
      .populate('verifiedBy', 'firstName lastName');
    
    if (yesterdayRecords.length === 0) {
      console.log('No records to archive for', yesterday.toDateString());
      return;
    }
    
    // Get admin user for report generation (or use system user)
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('No admin user found for report generation');
      return;
    }
    
    // Calculate statistics
    const totalRecords = yesterdayRecords.length;
    const verifiedRecords = yesterdayRecords.filter(r => r.status === 'verified').length;
    const pendingRecords = yesterdayRecords.filter(r => r.status === 'pending').length;
    const rejectedRecords = yesterdayRecords.filter(r => r.status === 'rejected').length;
    
    // Group by classroom
    const classroomStats = {};
    yesterdayRecords.forEach(record => {
      const classroomId = record.classroom._id.toString();
      if (!classroomStats[classroomId]) {
        classroomStats[classroomId] = {
          classroom: record.classroom,
          count: 0,
          verified: 0,
          pending: 0,
          rejected: 0
        };
      }
      classroomStats[classroomId].count++;
      if (record.status === 'verified') classroomStats[classroomId].verified++;
      if (record.status === 'pending') classroomStats[classroomId].pending++;
      if (record.status === 'rejected') classroomStats[classroomId].rejected++;
    });
    
    // Create daily report
    const dailyReport = new Report({
      title: `Daily Report - ${yesterday.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      type: 'daily',
      generatedBy: adminUser._id,
      period: {
        startDate: yesterday,
        endDate: endOfYesterday
      },
      data: {
        date: yesterday,
        records: yesterdayRecords.map(r => ({
          _id: r._id,
          student: r.student,
          classroom: r.classroom,
          instructorName: r.instructorName,
          timeIn: r.timeIn,
          timeOut: r.timeOut,
          status: r.status,
          verifiedBy: r.verifiedBy,
          verifiedAt: r.verifiedAt,
          remarks: r.remarks
        })),
        statistics: {
          totalRecords,
          verifiedRecords,
          pendingRecords,
          rejectedRecords,
          verificationRate: totalRecords > 0 ? Math.round((verifiedRecords / totalRecords) * 100) : 0
        },
        classroomStats: Object.values(classroomStats)
      },
      summary: {
        totalClassrooms: Object.keys(classroomStats).length,
        totalUtilization: totalRecords,
        averageUtilization: 0,
        underutilizedClassrooms: 0,
        conflicts: 0,
        recommendations: []
      },
      status: 'completed'
    });
    
    await dailyReport.save();
    console.log(`Daily report created: ${dailyReport._id}`);
    
    // Archive all records
    await TimeIn.updateMany(
      {
        date: {
          $gte: yesterday,
          $lte: endOfYesterday
        },
        isArchived: false
      },
      {
        $set: { isArchived: true }
      }
    );
    
    console.log(`Archived ${yesterdayRecords.length} records for ${yesterday.toDateString()}`);
    
    // Generate weekly report if it's the end of the week (Sunday)
    if (yesterday.getDay() === 0) {
      await generateWeeklyReport(yesterday, adminUser);
    }
    
    // Generate monthly report if it's the last day of the month
    const tomorrow = new Date(yesterday);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getDate() === 1) {
      await generateMonthlyReport(yesterday, adminUser);
    }
    
  } catch (error) {
    console.error('Error archiving daily records:', error);
  }
};

/**
 * Generate weekly report aggregating all daily reports for the week
 */
const generateWeeklyReport = async (endDate, adminUser) => {
  try {
    console.log('Generating weekly report...');
    
    // Get start of week (Monday)
    const startOfWeek = new Date(endDate);
    startOfWeek.setDate(endDate.getDate() - 6); // Go back 6 days to get Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(endDate);
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Get all daily reports for the week
    const dailyReports = await Report.find({
      type: 'daily',
      'period.startDate': { $gte: startOfWeek },
      'period.endDate': { $lte: endOfWeek }
    }).sort({ 'period.startDate': 1 });
    
    if (dailyReports.length === 0) {
      console.log('No daily reports found for weekly aggregation');
      return;
    }
    
    // Aggregate statistics
    let totalRecords = 0;
    let totalVerified = 0;
    const classroomStats = {};
    const allRecords = [];
    
    dailyReports.forEach(dailyReport => {
      if (dailyReport.data && dailyReport.data.statistics) {
        totalRecords += dailyReport.data.statistics.totalRecords || 0;
        totalVerified += dailyReport.data.statistics.verifiedRecords || 0;
      }
      
      if (dailyReport.data && dailyReport.data.records) {
        allRecords.push(...dailyReport.data.records);
      }
      
      if (dailyReport.data && dailyReport.data.classroomStats) {
        dailyReport.data.classroomStats.forEach(stat => {
          const classroomId = stat.classroom._id.toString();
          if (!classroomStats[classroomId]) {
            classroomStats[classroomId] = {
              classroom: stat.classroom,
              count: 0,
              verified: 0,
              pending: 0,
              rejected: 0
            };
          }
          classroomStats[classroomId].count += stat.count;
          classroomStats[classroomId].verified += stat.verified;
          classroomStats[classroomId].pending += stat.pending;
          classroomStats[classroomId].rejected += stat.rejected;
        });
      }
    });
    
    const weeklyReport = new Report({
      title: `Weekly Report - ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      type: 'weekly',
      generatedBy: adminUser._id,
      period: {
        startDate: startOfWeek,
        endDate: endOfWeek
      },
      data: {
        dailyReports: dailyReports.map(r => r._id),
        records: allRecords,
        statistics: {
          totalRecords,
          verifiedRecords: totalVerified,
          pendingRecords: totalRecords - totalVerified,
          verificationRate: totalRecords > 0 ? Math.round((totalVerified / totalRecords) * 100) : 0
        },
        classroomStats: Object.values(classroomStats)
      },
      summary: {
        totalClassrooms: Object.keys(classroomStats).length,
        totalUtilization: totalRecords,
        averageUtilization: 0,
        underutilizedClassrooms: 0,
        conflicts: 0,
        recommendations: []
      },
      status: 'completed'
    });
    
    await weeklyReport.save();
    console.log(`Weekly report created: ${weeklyReport._id}`);
  } catch (error) {
    console.error('Error generating weekly report:', error);
  }
};

/**
 * Generate monthly report aggregating all weekly reports for the month
 */
const generateMonthlyReport = async (endDate, adminUser) => {
  try {
    console.log('Generating monthly report...');
    
    // Get start of month
    const startOfMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const endOfMonth = new Date(endDate);
    endOfMonth.setHours(23, 59, 59, 999);
    
    // Get all weekly reports for the month
    const weeklyReports = await Report.find({
      type: 'weekly',
      'period.startDate': { $gte: startOfMonth },
      'period.endDate': { $lte: endOfMonth }
    }).sort({ 'period.startDate': 1 });
    
    // Also get daily reports that might not be in weekly reports (if week spans months)
    const dailyReports = await Report.find({
      type: 'daily',
      'period.startDate': { $gte: startOfMonth },
      'period.endDate': { $lte: endOfMonth }
    }).sort({ 'period.startDate': 1 });
    
    // Aggregate statistics
    let totalRecords = 0;
    let totalVerified = 0;
    const classroomStats = {};
    const allRecords = [];
    
    // Process weekly reports
    weeklyReports.forEach(weeklyReport => {
      if (weeklyReport.data && weeklyReport.data.statistics) {
        totalRecords += weeklyReport.data.statistics.totalRecords || 0;
        totalVerified += weeklyReport.data.statistics.verifiedRecords || 0;
      }
      
      if (weeklyReport.data && weeklyReport.data.records) {
        allRecords.push(...weeklyReport.data.records);
      }
      
      if (weeklyReport.data && weeklyReport.data.classroomStats) {
        weeklyReport.data.classroomStats.forEach(stat => {
          const classroomId = stat.classroom._id.toString();
          if (!classroomStats[classroomId]) {
            classroomStats[classroomId] = {
              classroom: stat.classroom,
              count: 0,
              verified: 0,
              pending: 0,
              rejected: 0
            };
          }
          classroomStats[classroomId].count += stat.count;
          classroomStats[classroomId].verified += stat.verified;
          classroomStats[classroomId].pending += stat.pending;
          classroomStats[classroomId].rejected += stat.rejected;
        });
      }
    });
    
    // Process daily reports (for days not covered by weekly reports)
    dailyReports.forEach(dailyReport => {
      if (dailyReport.data && dailyReport.data.statistics) {
        totalRecords += dailyReport.data.statistics.totalRecords || 0;
        totalVerified += dailyReport.data.statistics.verifiedRecords || 0;
      }
      
      if (dailyReport.data && dailyReport.data.records) {
        allRecords.push(...dailyReport.data.records);
      }
    });
    
    const monthlyReport = new Report({
      title: `Monthly Report - ${startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      type: 'monthly',
      generatedBy: adminUser._id,
      period: {
        startDate: startOfMonth,
        endDate: endOfMonth
      },
      data: {
        weeklyReports: weeklyReports.map(r => r._id),
        dailyReports: dailyReports.map(r => r._id),
        records: allRecords,
        statistics: {
          totalRecords,
          verifiedRecords: totalVerified,
          pendingRecords: totalRecords - totalVerified,
          verificationRate: totalRecords > 0 ? Math.round((totalVerified / totalRecords) * 100) : 0
        },
        classroomStats: Object.values(classroomStats)
      },
      summary: {
        totalClassrooms: Object.keys(classroomStats).length,
        totalUtilization: totalRecords,
        averageUtilization: 0,
        underutilizedClassrooms: 0,
        conflicts: 0,
        recommendations: []
      },
      status: 'completed'
    });
    
    await monthlyReport.save();
    console.log(`Monthly report created: ${monthlyReport._id}`);
  } catch (error) {
    console.error('Error generating monthly report:', error);
  }
};

/**
 * Initialize the cron job to run daily at midnight
 * Cron expression: '0 0 * * *' means "At 00:00 (midnight) every day"
 */
export const initializeDailyArchive = () => {
  try {
    // Schedule the job to run at midnight every day
    // Cron expression: '0 0 * * *' means "At 00:00 (midnight) every day"
    cron.schedule('0 0 * * *', async () => {
      console.log('Running scheduled daily archive at midnight...');
      try {
        await archiveDailyRecords();
      } catch (error) {
        console.error('Error in daily archive job:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC" // Using UTC for consistency
    });
    
    console.log('Daily archive cron job initialized. Will run at midnight (UTC) every day.');
  } catch (error) {
    console.error('Error initializing cron job:', error);
    throw error;
  }
};

// Export the archive function for manual testing
export { archiveDailyRecords, generateWeeklyReport, generateMonthlyReport };

