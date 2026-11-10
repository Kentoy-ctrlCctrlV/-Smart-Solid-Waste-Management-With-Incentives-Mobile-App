# Contributing to EcoLoop

Thank you for your interest in contributing to EcoLoop! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others succeed
- Report issues responsibly

## How to Contribute

### 1. Reporting Bugs
- Check existing issues first
- Provide detailed description
- Include steps to reproduce
- Attach error logs if applicable
- Include system information

### 2. Suggesting Enhancements
- Use issue tracker for suggestions
- Provide use case and benefits
- Include mockups/examples if applicable
- Link to related issues

### 3. Code Contributions

#### Setup Development Environment
```bash
# Clone and setup
git clone https://github.com/vin938/Smart-Solid-Waste-Management-With-Incentives.git
cd miles
npm install
npm --prefix frontend-angular install
npm --prefix backend install
```

#### Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

#### Development Guidelines
- Follow existing code style
- Use TypeScript for type safety
- Write meaningful commit messages
- Test your changes thoroughly
- Document significant changes

#### Commit Message Format
```
[COMPONENT] Brief description

Detailed explanation of changes
- Point 1
- Point 2
```

Examples:
- `[Frontend] Add user profile edit modal`
- `[Backend] Implement ACID transaction rollback`
- `[Docs] Update API endpoint documentation`

#### Frontend Guidelines
- Use Angular 16+ standalone components
- Follow RxJS reactive patterns
- Maintain responsive design
- Test on desktop and mobile
- Use TypeScript strict mode

#### Backend Guidelines
- Use Express middleware appropriately
- Maintain ACID compliance
- Add error handling
- Document API endpoints
- Use environment variables

#### Testing
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend-angular && npm test

# Build verification
npm start
```

#### Submit Pull Request
1. Ensure all tests pass
2. Update documentation
3. Provide clear PR description
4. Reference related issues
5. Request review from maintainers

## Development Workflow

### Local Testing
```bash
# Terminal 1 - Backend
cd backend && node server.js

# Terminal 2 - Frontend (dev mode)
cd frontend-angular && ng serve
```

### Building for Production
```bash
npm start
```

### Database Setup
```bash
# Create .env in backend directory
cp backend/.env.example backend/.env

# Configure database credentials
# Default: localhost:3306, user: root, no password
```

## Documentation

- Update README.md for user-facing changes
- Add inline comments for complex logic
- Generate and commit UML diagrams for architecture changes
- Update CONTRIBUTING.md if workflow changes

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. Create GitHub Release with notes

## Questions?

- Check existing issues and discussions
- Review documentation
- Ask in GitHub Discussions
- Email: info@ecoloop.gov

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- GitHub repository
- Project documentation

Thank you for making EcoLoop better! 🌱
