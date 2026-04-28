import Holiday from "../models/Holiday.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";

/**
 * Get all holidays with optional filters
 */
export const getHolidays = async (req, res) => {
  try {
    const { year, month, active = true } = req.query;

    let filter = {};
    if (active === 'true') filter.isActive = true;

    if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year) + 1, 0, 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }

    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }

    const holidays = await Holiday.find(filter).sort({ date: 1 });

    res.json(holidays);
  } catch (error) {
    console.error("Error fetching holidays:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Check if a specific date is a holiday
 */
export const checkHoliday = async (req, res) => {
  try {
    const { date } = req.params;
    const checkDate = new Date(date);

    const holiday = await Holiday.findOne({
      date: {
        $gte: new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate()),
        $lt: new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() + 1)
      },
      isActive: true
    });

    res.json({
      isHoliday: !!holiday,
      holiday: holiday || null
    });
  } catch (error) {
    console.error("Error checking holiday:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * ✅ Check if TODAY is a holiday (used by TimeIn)
 */
export const checkTodayHoliday = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const holiday = await Holiday.findOne({
      date: { $gte: today, $lt: tomorrow },
      isActive: true
    });
    
    res.json({
      isHoliday: !!holiday,
      holiday: holiday || null
    });
  } catch (error) {
    console.error("Error checking today holiday:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create new holiday
 */
export const createHoliday = async (req, res) => {
  try {
    const { date, name, type, description } = req.body;

    if (!date || !name) {
      return res.status(400).json({
        message: "Date and name are required"
      });
    }

    const holiday = new Holiday({
      date: new Date(date),
      name,
      type: type || "regular",
      description
    });

    await holiday.save();

    res.status(201).json({
      message: "Holiday created successfully",
      holiday
    });
  } catch (error) {
    console.error("Error creating holiday:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "A holiday already exists for this date"
      });
    }

    res.status(500).json({ message: error.message });
  }
};

/**
 * Update holiday
 */
export const updateHoliday = async (req, res) => {
  try {
    const version = requireVersion(req.body.version);
    const { date, name, type, description, isActive } = req.body;

    const updateDoc = buildVersionedUpdateDoc({
      date: date ? new Date(date) : undefined,
      name,
      type,
      description,
      isActive
    });

    const holiday = await runVersionedUpdate(
      Holiday,
      req.params.id,
      updateDoc,
      version
    );

    res.json({
      message: "Holiday updated successfully",
      holiday
    });
  } catch (error) {
    console.error("Error updating holiday:", error);

    if (isVersionError(error)) {
      return respondWithConflict(res, error);
    }

    if (error.code === 11000) {
      return res.status(400).json({
        message: "A holiday already exists for this date"
      });
    }

    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete/archive holiday
 */
export const deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    res.json({
      message: "Holiday archived successfully",
      holiday
    });
  } catch (error) {
    console.error("Error deleting holiday:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * ✅ Seed Philippine holidays for a specific year
 */
export const seedHolidays = async (req, res) => {
  try {
    const { year } = req.body;
    const targetYear = year || new Date().getFullYear();
    
    const phHolidays = [
      { name: "New Year's Day", date: `${targetYear}-01-01`, type: 'regular', description: 'Regular holiday' },
      { name: "EDSA People Power Anniversary", date: `${targetYear}-02-25`, type: 'special', description: 'Special non-working day' },
      { name: "Araw ng Kagitingan", date: `${targetYear}-04-09`, type: 'regular', description: 'Day of Valor' },
      { name: "Labor Day", date: `${targetYear}-05-01`, type: 'regular', description: 'Regular holiday' },
      { name: "Independence Day", date: `${targetYear}-06-12`, type: 'regular', description: 'Regular holiday' },
      { name: "Ninoy Aquino Day", date: `${targetYear}-08-21`, type: 'special', description: 'Special non-working day' },
      { name: "National Heroes Day", date: `${targetYear}-08-25`, type: 'regular', description: 'Regular holiday' },
      { name: "All Saints' Day", date: `${targetYear}-11-01`, type: 'special', description: 'Special non-working day' },
      { name: "Bonifacio Day", date: `${targetYear}-11-30`, type: 'regular', description: 'Regular holiday' },
      { name: "Feast of the Immaculate Conception", date: `${targetYear}-12-08`, type: 'special', description: 'Special non-working day' },
      { name: "Christmas Day", date: `${targetYear}-12-25`, type: 'regular', description: 'Regular holiday' },
      { name: "Rizal Day", date: `${targetYear}-12-30`, type: 'regular', description: 'Regular holiday' },
      { name: "Last Day of the Year", date: `${targetYear}-12-31`, type: 'special', description: 'Special non-working day' },
    ];
    
    let created = 0;
    let skipped = 0;
    
    for (const holiday of phHolidays) {
      const date = new Date(holiday.date);
      const exists = await Holiday.findOne({ date });
      
      if (!exists) {
        await Holiday.create({
          ...holiday,
          date,
          year: targetYear,
          isActive: true
        });
        created++;
      } else {
        skipped++;
      }
    }
    
    res.json({
      success: true,
      message: `Seeded ${created} new holidays for ${targetYear} (${skipped} already existed)`,
      created,
      skipped,
      year: targetYear
    });
  } catch (error) {
    console.error("Error seeding holidays:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * ✅ Get active holidays count for dashboard
 */
export const getHolidayCount = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear();
    
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear + 1, 0, 1);
    
    const count = await Holiday.countDocuments({
      date: { $gte: startDate, $lt: endDate },
      isActive: true
    });
    
    res.json({ year: targetYear, count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};