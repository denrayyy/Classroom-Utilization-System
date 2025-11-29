# Complete Setup Guide for Team

Welcome! This guide will help you get the Classroom Utilization System running on your machine.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (5 minutes)](#quick-start)
3. [Configuration Setup](#configuration-setup)
4. [Running the Application](#running-the-application)
5. [Troubleshooting](#troubleshooting)
6. [Admin Account & First Login](#admin-account--first-login)

---

## Prerequisites

Make sure you have the following installed on your machine:

### Required
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
  - Verify: `node --version` and `npm --version`
- **MongoDB** (v4.4 or higher) - [Download](https://www.mongodb.com/try/download/community)
  - Or use MongoDB Atlas (cloud): [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
  - Verify: `mongod --version`

### Optional
- **Git** - [Download](https://git-scm.com/)
- **Visual Studio Code** - [Download](https://code.visualstudio.com/)

---

## Quick Start

### 1. Clone the Repository

```bash
# If you haven't already
git clone https://github.com/raydennnx/ClaUsys.git
cd ClaUsys
```

### 2. Create Environment File

```bash
# Copy the example env file
cp .env.example .env
```

Edit `.env` and configure basic settings:
- `MONGO_URI` - Your MongoDB connection string
- `JWT_SECRET` - A random secret key (or use the generated one)
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth secret (optional for now)

### 3. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 4. Start the Application

```bash
# Start both backend and frontend (from root directory)
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

---

## Configuration Setup

### MongoDB Setup

#### Option A: Local MongoDB

1. **Install MongoDB Community Edition**
   - [Windows](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/)
   - [Mac](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-macos/)
   - [Linux](https://docs.mongodb.com/manual/administration/install-on-linux/)

2. **Start MongoDB Service**
   ```bash
   # Windows
   mongod
   
   # Mac/Linux
   mongod --dbpath /path/to/your/data/directory
   ```

3. **Update `.env`**
   ```env
   MONGO_URI=mongodb://localhost:27017/classroom_utilization
   ```

#### Option B: MongoDB Atlas (Cloud)

1. **Create a Free Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up with email or Google account

2. **Create a Cluster**
   - Choose the free tier
   - Select your region
   - Click "Create" (wait 5-10 minutes for creation)

3. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string

4. **Update `.env`**
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/classroom_utilization
   ```

### Google OAuth Setup (Optional - Required for Google Login)

For detailed instructions, see [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)

**Quick Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials (type: Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3000` (development)
   - `http://localhost:3000/` (with trailing slash)
6. Copy your Client Secret
7. Add to `.env`:
   ```env
   GOOGLE_CLIENT_SECRET=your-secret-here
   GOOGLE_CALLBACK_URL=http://localhost:3000
   ```

### ReCAPTCHA Setup (Optional - For Form Protection)

For detailed instructions, see [RECAPTCHA_SETUP.md](./RECAPTCHA_SETUP.md)

---

## Running the Application

### Development Mode

```bash
# Run both backend and frontend concurrently
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Backend (with auto-reload)
npm run server

# Terminal 2 - Frontend
cd client
npm start
```

### Production Mode

```bash
# Build and run for production
npm run build:server
```

---

## Default Admin Account

The system automatically creates an admin account on first run:

**Email:** `clausys@admin.buksu`
**Password:** `admin123`

**⚠️ Important Security Steps:**
1. Log in with the admin account
2. Change the password immediately
3. Update admin email if needed
4. Only share admin credentials with authorized personnel

---

## First Login & System Setup

### 1. Start the Application
```bash
npm run dev
```

### 2. Access the System
- Frontend: http://localhost:3000
- Admin Login: http://localhost:3000/admin-login

### 3. Login as Admin
- Email: `clausys@admin.buksu`
- Password: `admin123`

### 4. Initial Configuration
Once logged in as admin:
1. **Add Classrooms** - Navigate to Classroom Management
2. **Create Schedule Templates** - Set up recurring schedules
3. **Add Instructors** - Manually add staff or let them self-register
4. **Configure System Settings** - Set holidays, working hours, etc.

### 5. Instructor Registration
Instructors can self-register at:
- URL: http://localhost:3000/register
- Required fields:
  - Full Name
  - Email
  - Employee ID
  - Department
  - Password

---

## Project Structure

```
ClaUsys/
├── client/                     # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/        # React Components
│   │   ├── types/            # TypeScript Types
│   │   └── App.tsx           # Main App Component
│   └── package.json
├── config/                    # Configuration Files
│   ├── config.js             # App Configuration
│   └── db.js                 # Database Connection
├── middleware/               # Express Middleware
├── models/                   # MongoDB Models
│   ├── User.js
│   ├── Classroom.js
│   ├── Schedule.js
│   ├── ClassroomUsage.js
│   ├── Report.js
│   └── ...
├── routes/                   # API Routes
│   ├── auth.js
│   ├── classrooms.js
│   ├── schedules.js
│   ├── usage.js
│   └── ...
├── utils/                    # Utility Functions
│   ├── seedAdmin.js         # Admin Account Creation
│   ├── dailyArchive.js      # Daily Data Archive
│   └── worldTimeAPI.js      # Time Zone Support
├── server.js               # Main Express Server
├── .env.example           # Environment Variables Template
├── package.json           # Backend Dependencies
└── README.md             # Project Overview
```

---

## Available Scripts

### Root Directory

```bash
npm start              # Start production server
npm run server         # Start dev server (with hot reload)
npm run client         # Start React frontend only
npm run dev            # Start both (concurrently)
npm run build          # Build React frontend
npm run build:server   # Build and start production
```

### Client Directory

```bash
cd client
npm start              # Start React dev server
npm run build          # Create production build
npm test               # Run tests
```

---

## Troubleshooting

### Issue: "Cannot find module 'express'"
**Solution:**
```bash
npm install
cd client
npm install
cd ..
```

### Issue: MongoDB Connection Error
**Solution:**
- Verify MongoDB is running: `mongod`
- Check `MONGO_URI` in `.env` file
- Verify connection string format

### Issue: "GOOGLE_CLIENT_SECRET not configured"
**Solution:**
- This is optional - Google login will be disabled
- To enable: Add `GOOGLE_CLIENT_SECRET` to `.env` and restart

### Issue: Port 3000 or 5000 Already in Use
**Solution:**
```bash
# Change port in .env
PORT=5001

# Or kill the process using the port
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :5000
kill -9 <PID>
```

### Issue: React App Not Loading After npm run dev
**Solution:**
1. Clear browser cache: Ctrl+Shift+Delete
2. Try: `npm run build && npm run build:server`
3. Restart both servers
4. Check browser console for errors (F12)

### Issue: CORS Errors
**Solution:**
- Backend CORS is enabled for development
- Check that backend is running on port 5000
- Verify `proxy` in `client/package.json` points to `http://localhost:5000`

---

## Getting Help

### Check the Logs
- **Backend errors**: Look in terminal where `npm run server` is running
- **Frontend errors**: Open browser console (F12)

### Useful Commands for Debugging

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check if ports are in use
netstat -ano | findstr :5000    # Windows
lsof -i :5000                   # Mac/Linux

# View MongoDB data
mongosh
use classroom_utilization
db.users.findOne()
```

### Common API Endpoints

```
GET  /api                           # API Status
POST /api/auth/register            # Register Account
POST /api/auth/login               # Login
GET  /api/classrooms               # Get All Classrooms
POST /api/schedules                # Create Schedule
GET  /api/schedules                # Get Schedules
POST /api/usage/checkin           # Check In
PUT  /api/usage/:id/checkout      # Check Out
GET  /api/reports                 # Get Reports
```

---

## Next Steps

1. ✅ Complete this setup guide
2. 📚 Read [README.md](./README.md) for feature overview
3. 🔐 Configure Google OAuth (see [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md))
4. 🛡️ Set up ReCAPTCHA (see [RECAPTCHA_SETUP.md](./RECAPTCHA_SETUP.md))
5. 🚀 Deploy to production (see [DEPLOYMENT.md](./DEPLOYMENT.md))

---

## Support & Questions

If you encounter issues:
1. Check this guide's Troubleshooting section
2. Review the relevant setup guide (Google OAuth, ReCAPTCHA, etc.)
3. Check browser console and server logs
4. Ask the development team

---

**Version:** 1.0.0  
**Last Updated:** November 2025
