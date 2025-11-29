# 🔄 QUICK COMMAND REFERENCE FOR YOUR TEAM

## 📋 For Project Lead / You

### 1. Push to GitHub NOW
```bash
cd "c:\Classrom Utilization"
git push origin main
```

### 2. Share Repository Link
```
https://github.com/raydennnx/ClaUsys
```

### 3. Send This to Your Team:
```
Clone: git clone https://github.com/raydennnx/ClaUsys.git
Setup: Read SETUP_GUIDE.md in the repo
Start: npm run dev
Access: http://localhost:3000
Admin: clausys@admin.buksu / admin123
```

---

## 👥 For Your Team Members

### Getting Started (Copy & Paste These Commands)

#### Step 1: Clone Repository
```bash
git clone https://github.com/raydennnx/ClaUsys.git
cd ClaUsys
```

#### Step 2: Create Environment File
```bash
cp .env.example .env
```

**Edit `.env` with:**
- MongoDB connection string
- JWT secret
- Google OAuth secret (optional)

#### Step 3: Install Dependencies
```bash
npm install
cd client
npm install
cd ..
```

#### Step 4: Start Development
```bash
npm run dev
```

#### Step 5: Access System
- Frontend: http://localhost:3000
- API: http://localhost:5000
- Admin: clausys@admin.buksu / admin123

---

## 📚 Documentation Quick Links

### For Setup Issues
```bash
cat SETUP_GUIDE.md
# Or open in VS Code
code SETUP_GUIDE.md
```

### For Development
```bash
cat CONTRIBUTING.md      # Code standards
cat GITHUB_GUIDE.md      # Collaboration
```

### For Deployment
```bash
cat DEPLOYMENT.md        # Production setup
```

### For Google OAuth
```bash
cat GOOGLE_OAUTH_SETUP.md
```

### For Form Protection
```bash
cat RECAPTCHA_SETUP.md
```

---

## 🔧 Troubleshooting Commands

### MongoDB Not Running?
```bash
# Windows
mongod

# Mac
mongod --dbpath /usr/local/var/mongodb

# Check MongoDB is running
mongosh
```

### Port Already in Use?
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :5000
kill -9 <PID>
```

### Clear npm Cache
```bash
npm cache clean --force
```

### Reinstall Everything
```bash
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json
npm install
cd client && npm install && cd ..
```

### Check Git Status
```bash
git status
git log --oneline -5
git remote -v
```

---

## 🚀 Development Workflow

### Make Changes
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
# Edit files...

# Stage changes
git add .

# Commit with meaningful message
git commit -m "✨ Add your feature description"
```

### Push Changes
```bash
# Push to your fork/branch
git push origin feature/your-feature-name
```

### Create Pull Request
- Go to GitHub
- Click "Create Pull Request"
- Add description
- Request review

### Update from Main
```bash
# Fetch latest
git fetch origin

# Rebase on main
git rebase origin/main

# Push updated branch
git push origin feature/your-feature-name --force-with-lease
```

---

## 📊 Useful Git Commands

```bash
# Check status
git status

# View commits
git log --oneline -10

# View branches
git branch -a

# Switch branch
git checkout branch-name

# Create branch
git checkout -b branch-name

# Add files
git add .

# Commit
git commit -m "message"

# Push
git push origin branch-name

# Pull latest
git pull origin main

# See what changed
git diff
git diff --cached

# Undo last commit
git reset --soft HEAD~1

# View file history
git log --oneline file.js
```

---

## 🎯 Command Cheat Sheet by Role

### Frontend Developer
```bash
# Development
npm run dev
cd client && npm start

# Build
npm run build

# Check types
cd client && npm test
```

### Backend Developer
```bash
# Development with auto-reload
npm run server

# Production
npm start

# Production with build
npm run build:server
```

### DevOps / Deployment
```bash
# Build everything
npm run build

# Start production
npm run build:server

# Check environment
cat .env
echo $MONGO_URI    # Check env variables
```

---

## 🔐 Security Commands

### Never Commit These
```bash
# Check for .env file (should NOT exist)
ls -la .env              # Should show "not found"

# Check for node_modules
ls -la node_modules      # Should be empty/not exist

# Check for build artifacts
ls -la dist/
ls -la build/
```

### Verify Clean Commit
```bash
# Show what would be committed
git diff --cached

# Show what changed
git diff

# Verify secrets not exposed
git log -p | grep -E "password|secret|token"
```

---

## 📈 Performance Checks

### Check Dependencies
```bash
npm ls
npm outdated

# Update packages
npm update
cd client && npm update && cd ..
```

### Check for Vulnerabilities
```bash
npm audit
npm audit fix
```

### Check Code Size
```bash
npm run build
ls -lh client/build/
```

---

## 🆘 Emergency Commands

### Something Broken? Reset Local Changes
```bash
# Undo all local changes
git checkout -- .

# Or reset to last commit
git reset --hard HEAD
```

### Wrong Branch? Switch Back
```bash
git checkout main
git pull origin main
```

### Accidental Commit? Undo It
```bash
# Keep changes
git reset --soft HEAD~1

# Lose changes
git reset --hard HEAD~1
```

### Lost Track? View Everything
```bash
git log --all --oneline --graph
git reflog
```

---

## 📱 For Team Communication

### Share Repository
```bash
URL: https://github.com/raydennnx/ClaUsys
Branch: main
First File to Read: SETUP_GUIDE.md
```

### Report Issues
```bash
# Go to GitHub
https://github.com/raydennnx/ClaUsys/issues
Click "New Issue"
Describe problem
Add error message/screenshot
```

### Ask Questions
```bash
# Go to GitHub Discussions
https://github.com/raydennnx/ClaUsys/discussions
Click "New Discussion"
Ask your question
```

### Share Code
```bash
# Make pull request with your changes
# Go to GitHub
# Click "Pull Requests"
# Click "New Pull Request"
```

---

## ✅ Verify Everything Works

### Local Verification
```bash
# Test backend
curl http://localhost:5000/api

# Test frontend
open http://localhost:3000
# or
start http://localhost:3000

# Test admin login
# Email: clausys@admin.buksu
# Password: admin123
```

### Git Verification
```bash
# Check remote
git remote -v

# Check commits
git log --oneline -5

# Check status
git status
# Should show "nothing to commit"
```

---

## 🎯 Step-by-Step Team Onboarding

### Day 1: Setup
1. Clone repo: `git clone https://github.com/raydennnx/ClaUsys.git`
2. Read setup: `cat SETUP_GUIDE.md`
3. Install: `npm install && cd client && npm install && cd ..`
4. Configure: `cp .env.example .env` + edit
5. Start: `npm run dev`
6. Test: `http://localhost:3000`

### Day 2: Learn
1. Read: `README.md` - Features
2. Read: `CONTRIBUTING.md` - Code standards
3. Read: `GITHUB_GUIDE.md` - Workflow
4. Explore: Application features
5. Ask: Questions in GitHub Discussions

### Day 3+: Contribute
1. Create branch: `git checkout -b feature/task`
2. Make changes
3. Test locally
4. Commit: `git commit -m "✨ Description"`
5. Push: `git push origin feature/task`
6. Create PR on GitHub
7. Get review, make changes, merge

---

## 🎓 Learning Resources

### Official Docs
- MongoDB: https://docs.mongodb.com/
- Express: https://expressjs.com/
- React: https://react.dev/
- Node.js: https://nodejs.org/docs/

### GitHub
- GitHub Docs: https://docs.github.com/
- Git Book: https://git-scm.com/book/

### In Project
- README.md - Overview
- SETUP_GUIDE.md - Installation
- Code comments - Explanations
- API endpoints - In README.md

---

## 💡 Pro Tips

✅ Keep .env file SECRET - never commit it  
✅ Write meaningful commit messages  
✅ Pull before pushing to avoid conflicts  
✅ Test locally before pushing  
✅ Read error messages carefully  
✅ Ask questions early  
✅ Help other team members  
✅ Keep documentation updated  

---

## 🎉 You're Ready!

All these commands are your toolkit. Bookmark this page and reference it as needed.

**Main Commands to Remember:**
```
git clone <url>          # Get code
npm install              # Install dependencies
npm run dev             # Start development
git commit -m "msg"     # Save changes
git push origin branch  # Share changes
```

**Questions?**
1. Check relevant .md file
2. Search GitHub issues
3. Ask in GitHub Discussions
4. Ask your team lead

---

**Happy coding!** 🚀
