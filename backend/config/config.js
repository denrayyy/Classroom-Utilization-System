export default {
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/classroom_utilization",
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_key_here",
  NODE_ENV: process.env.NODE_ENV || "development"
};
