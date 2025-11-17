import mongoose from "mongoose";
import dotenv from "dotenv";
import Instructor from "../models/Instructor.js";
import connectDB from "../config/db.js";

dotenv.config();

const instructors = [
  "Czarissa Louise Navidad",
  "Louie Labastida",
  "Mark Daniel Dacer",
  "John Lloyd Rojo",
  "Raul Lecaros",
  "Max Macalandag",
  "Rov Japeth Oracion",
  "Gil Nicolas Cagande",
  "Glyza Mae Liebe",
  "Joseph Abella",
  "Peter Rabanes",
  "Sales Aribe",
  "Klevie Jun Caseres",
  "Rj Indapan"
];

async function seedInstructors() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    let created = 0;
    let skipped = 0;

    for (const name of instructors) {
      try {
        // Check if instructor already exists (case-insensitive)
        const existing = await Instructor.findOne({ 
          name: { $regex: new RegExp(`^${name}$`, 'i') } 
        });

        if (!existing) {
          await Instructor.create({ name });
          console.log(`✓ Created: ${name}`);
          created++;
        } else {
          console.log(`⊘ Skipped (already exists): ${name}`);
          skipped++;
        }
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⊘ Skipped (duplicate): ${name}`);
          skipped++;
        } else {
          console.error(`✗ Error creating ${name}:`, error.message);
        }
      }
    }

    console.log(`\n✓ Seeding complete!`);
    console.log(`  Created: ${created}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total: ${instructors.length}`);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding instructors:", error);
    process.exit(1);
  }
}

seedInstructors();

