# GitHub Team Setup & Deployment

## Quick Links
- **Repository**: https://github.com/raydennnx/ClaUsys
- **Issues**: https://github.com/raydennnx/ClaUsys/issues
- **Discussions**: https://github.com/raydennnx/ClaUsys/discussions
- **Project Board**: https://github.com/users/raydennnx/projects/ClaUsys

## Getting Started with GitHub

### 1. Clone the Repository

```bash
git clone https://github.com/raydennnx/ClaUsys.git
cd ClaUsys
```

### 2. Add Your Remote (if working from a fork)

```bash
# Add upstream to sync with main repository
git remote add upstream https://github.com/raydennnx/ClaUsys.git
git remote -v  # Verify both origin and upstream exist
```

### 3. Complete Local Setup

```bash
cp .env.example .env
npm install
cd client && npm install && cd ..
npm run dev
```

## GitHub Workflows

### Branch Naming Convention

```
feature/description           # New features
bugfix/description           # Bug fixes
docs/description            # Documentation updates
refactor/description        # Code refactoring
chore/description           # Maintenance tasks
```

Examples:
```
feature/add-email-notifications
bugfix/fix-schedule-conflict-detection
docs/update-setup-guide
refactor/optimize-database-queries
```

### Working with Branches

```bash
# Create and checkout new branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "✨ Add feature description"

# Push to your fork (or directly if you have permission)
git push origin feature/your-feature-name

# Create Pull Request on GitHub
# https://github.com/raydennnx/ClaUsys/compare
```

### Keeping Your Fork Updated

```bash
# Fetch latest changes from upstream
git fetch upstream main

# Rebase your branch on latest main
git rebase upstream/main

# Push updated branch
git push origin feature/your-feature-name --force-with-lease
```

## Pull Request Process

### Before Submitting PR

1. ✅ Test thoroughly: `npm run dev`
2. ✅ Update documentation if needed
3. ✅ No console errors or warnings
4. ✅ Commits are clean and meaningful
5. ✅ Code follows project standards

### PR Checklist

Your PR title should be descriptive:
```
✨ Add email notification for schedule changes
🐛 Fix race condition in database queries
📚 Update setup guide with MongoDB Atlas instructions
```

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
How to test these changes:
1. Start server: npm run dev
2. Test step 1
3. Test step 2

## Screenshots (if UI changes)
[Add screenshots here]

## Checklist
- [ ] Code follows style guidelines
- [ ] No console errors or warnings
- [ ] Tests pass (if applicable)
- [ ] Documentation updated
- [ ] Commits are meaningful
- [ ] No sensitive data in commits

## Related Issues
Fixes #123
Related to #456
```

## Code Review Guidelines

### For Reviewers

- ✅ Check for code quality and best practices
- ✅ Verify tests are included
- ✅ Ensure documentation is updated
- ✅ Look for security issues
- ✅ Request changes if necessary
- ✅ Approve when satisfied

### For Contributors

- ✅ Respond to review comments promptly
- ✅ Make requested changes
- ✅ Commit changes with clear messages
- ✅ Re-request review when ready
- ✅ Don't force-push after review starts

## Issue Management

### Creating an Issue

Use appropriate labels:
- `bug` - Something is broken
- `enhancement` - Feature request
- `documentation` - Doc updates needed
- `question` - Questions or clarification needed
- `help wanted` - Need assistance
- `good first issue` - Good for beginners

### Issue Title Format

```
[TYPE] Description

[BUG] Classroom schedule conflicts not detected
[FEATURE] Add email notifications for schedule changes
[DOCS] Update deployment guide for production
[QUESTION] How to configure Google OAuth for staging?
```

### Issue Description Template

```markdown
## Description
Clear description of the issue.

## Steps to Reproduce (for bugs)
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: Windows/Mac/Linux
- Node version: 
- MongoDB: Local/Atlas
- Browser: (if frontend related)

## Screenshots/Logs
[Add relevant information]

## Possible Solution
[If you have an idea]
```

## Team Communication

### GitHub Discussions
Use for:
- Architecture discussions
- Best practices questions
- Roadmap planning
- Team announcements

### Issues
Use for:
- Bug reports
- Feature requests
- Documentation needs

### Pull Requests
Use for:
- Code review and merging changes
- Team feedback on implementations

## Deployment from GitHub

### Staging Deployment
```bash
# After PR is merged to main
git checkout main
git pull origin main
npm install
npm run build
npm run build:server
```

### Production Deployment
```bash
# Create a release tag
git tag v1.0.0
git push origin v1.0.0

# Or use GitHub releases for deployment automation
```

## Git Commands Cheat Sheet

```bash
# Check status
git status

# View recent commits
git log --oneline -10

# View branches
git branch -a

# Create new branch
git checkout -b feature/name
git switch -c feature/name

# Switch branches
git checkout main
git switch main

# Add and commit
git add .
git commit -m "message"

# Push changes
git push origin branch-name

# Pull latest
git pull origin main
git fetch upstream && git rebase upstream/main

# Undo last commit (keep changes)
git reset --soft HEAD~1

# View file history
git log --oneline file.js

# Check what changed
git diff
git diff --cached
```

## Team Members

| Role | GitHub Username | Responsibilities |
|------|-----------------|------------------|
| Project Lead | [@raydennnx](https://github.com/raydennnx) | Overall project management, releases |
| Backend | [Team Member] | Server, API, Database |
| Frontend | [Team Member] | UI, React components |
| DevOps | [Team Member] | Deployment, Infrastructure |

## Security

### Never Commit
- `.env` files with secrets
- API keys or credentials
- Private configuration
- Sensitive data

### Always Review
- Dependencies for vulnerabilities
- Code changes for security issues
- External API integrations

### Use
- `.env.example` for configuration templates
- GitHub Secrets for CI/CD sensitive data
- HTTPS for all external communications

## Useful GitHub Links

- [GitHub Docs](https://docs.github.com)
- [Markdown Guide](https://guides.github.com/features/mastering-markdown/)
- [GitHub CLI](https://cli.github.com/)
- [Git Best Practices](https://git-scm.com/docs)

## Tips for Success

1. **Keep PRs small** - Easier to review and merge
2. **Write descriptive commits** - Helps with history
3. **Communicate early** - Ask questions before coding
4. **Test thoroughly** - Catch issues before review
5. **Update docs** - Keep team informed
6. **Review others' work** - Share knowledge
7. **Be respectful** - Professional communication

---

**Happy coding! We're glad to have you on the team!** 🚀
