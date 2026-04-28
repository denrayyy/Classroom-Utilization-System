import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import Classroom from "./models/Classroom.js";

const cleanScheduleTime = (time) => {
  const parts = String(time || "")
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) {
    return String(time || "").trim();
  }

  return `${parts[0]}-${parts[parts.length - 1]}`;
};

const hasExtraParts = (time) =>
  String(time || "")
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean).length > 2;

const run = async () => {
  let fixedClassrooms = 0;
  let fixedSchedules = 0;
  const examples = [];

  try {
    await connectDB();

    const classrooms = await Classroom.find({
      schedules: {
        $elemMatch: {
          time: { $regex: /.+-.+-.+/ },
        },
      },
    });

    for (const classroom of classrooms) {
      let classroomChanged = false;

      classroom.schedules = classroom.schedules.map((schedule) => {
        const originalTime = schedule.time || "";

        if (!hasExtraParts(originalTime)) {
          return schedule;
        }

        const cleanedTime = cleanScheduleTime(originalTime);
        if (cleanedTime === originalTime) {
          return schedule;
        }

        classroomChanged = true;
        fixedSchedules += 1;

        if (examples.length < 5) {
          examples.push({
            classroom: classroom.name,
            before: originalTime,
            after: cleanedTime,
          });
        }

        return {
          ...schedule.toObject(),
          time: cleanedTime,
        };
      });

      if (classroomChanged) {
        await classroom.save();
        fixedClassrooms += 1;
      }
    }

    console.log(`Fixed ${fixedSchedules} schedule time(s) across ${fixedClassrooms} classroom(s).`);

    if (examples.length) {
      console.log("Examples:");
      examples.forEach((example) => {
        console.log(`- ${example.classroom}: "${example.before}" -> "${example.after}"`);
      });
    } else {
      console.log("No malformed schedule times were found.");
    }
  } catch (error) {
    console.error("Failed to fix schedule times:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
