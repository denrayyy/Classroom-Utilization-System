# Contributing to Classroom Utilization System

Thank you for contributing to the Classroom Utilization System! Please follow these guidelines to ensure consistency and quality.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/ClaUsys.git
   cd ClaUsys
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete setup instructions.

Quick setup:
```bash
cp .env.example .env
npm install
cd client && npm install && cd ..
npm run dev
```

## Code Standards

### Backend (Node.js/Express)
- Use **ES6+ syntax** with `import`/`export`
- Follow **consistent naming**: camelCase for variables, PascalCase for classes
- Add **JSDoc comments** for functions:
  ```javascript
  /**
   * Validates user input
   * @param {Object} data - User data
   * @returns {Boolean} True if valid
   */
  function validateUser(data) { }
  ```
- Use **async/await** instead of callbacks
- Handle errors properly with try/catch

### Frontend (React/TypeScript)
- Use **TypeScript** for type safety
- Follow **React best practices**:
  - Functional components with hooks
  - Proper key props in lists
  - Extract components appropriately
- Use **naming conventions**:
  - Components: PascalCase (`UserProfile.tsx`)
  - Files: same as component name
  - Hooks: camelCase with "use" prefix (`useAuth`)
- Add **CSS modules** or keep CSS in separate `.css` files

### General Rules
- **No hardcoded values** - Use configuration/environment variables
- **Never commit** `.env`, `node_modules`, or build artifacts
- **Meaningful commit messages**:
  ```
  ✨ Add new feature
  🐛 Fix bug in authentication
  📚 Update documentation
  ♻️ Refactor database queries
  ```

## Commit Message Format

Use emoji prefixes for clarity:
- `✨` - New feature
- `🐛` - Bug fix
- `📚` - Documentation
- `♻️` - Refactoring
- `🎨` - Style/formatting
- `⚡` - Performance improvement
- `🔒` - Security fix
- `🚀` - Deployment/release

Example:
```bash
git commit -m "✨ Add classroom utilization report export feature"
```

## Before Submitting a Pull Request

1. **Test your changes**:
   ```bash
   npm run dev
   # Test both frontend and backend functionality
   ```

2. **Update tests** if applicable:
   ```bash
   npm test
   ```

3. **Update documentation**:
   - Update `README.md` if adding features
   - Update `SETUP_GUIDE.md` if changing setup steps
   - Add comments to complex code

4. **Check for issues**:
   - No console errors or warnings
   - No hardcoded values
   - Proper error handling
   - Environment variables used correctly

5. **Create a Pull Request** with:
   - Clear title describing the change
   - Description of what changed and why
   - Reference to related issues (if any)
   - Screenshots for UI changes

## PR Review Process

- At least one review required before merge
- Address all comments and suggestions
- Keep commits clean and meaningful
- Rebase on main before merging if needed

## Reporting Issues

When reporting bugs, please include:
- **Description**: What happened?
- **Steps to reproduce**: How to replicate the issue
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: OS, Node version, MongoDB version
- **Screenshots/logs**: If applicable

## Feature Requests

When requesting features:
- **Clear title**: One-line summary
- **Rationale**: Why this feature is needed
- **User impact**: Who benefits and how
- **Suggested implementation**: How it could work
- **Priority**: Low/Medium/High

## Documentation Guidelines

### README.md
- Keep it concise and user-focused
- Include quick start instructions
- Link to detailed guides

### Code Comments
- Explain WHY, not WHAT (code shows what)
- Comment complex logic
- Keep comments up-to-date with code

### Commit Messages
- First line: 50 chars max, clear and imperative
- Blank line, then detailed explanation if needed
- Reference issues: "Fixes #123"

## Deployment Process

1. Create feature branch and make changes
2. Test locally with `npm run dev`
3. Submit pull request
4. Code review and approval
5. Merge to main
6. Build and test on staging
7. Deploy to production

See [DEPLOYMENT.md](./DEPLOYMENT.md) for details.

## Project Structure Best Practices

```
- Keep routes modular and organized
- Group related models together
- Use middleware for common logic
- Keep components small and reusable
- Use proper folder structure
```

## Security Considerations

- ❌ Never commit `.env` files with secrets
- ✅ Use `.env.example` for templates
- ✅ Validate all user inputs
- ✅ Use HTTPS in production
- ✅ Hash passwords properly
- ✅ Protect sensitive routes with auth middleware
- ✅ Keep dependencies updated

## Performance Guidelines

- Optimize database queries
- Use indexes for frequently queried fields
- Minimize API response payloads
- Implement pagination for large datasets
- Cache when appropriate
- Lazy load components in React

## Testing Guidelines

- Write tests for critical functions
- Test authentication and authorization
- Test error scenarios
- Use meaningful test descriptions
- Aim for 80%+ coverage on critical code

```javascript
// ✅ Good test description
test('should validate email format on registration', () => { })

// ❌ Poor test description
test('validates email', () => { })
```

## Questions or Need Help?

1. Check existing documentation
2. Review similar code in the project
3. Ask in the team discussion
4. Create an issue with your question

## Thank You!

Your contributions help make this system better for everyone. We appreciate your effort and time!

---

**Happy coding!** 🚀
