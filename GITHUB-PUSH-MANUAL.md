# Manual Git Push Instructions

If the automated script doesn't work, follow these manual steps to push your EcoLoop project to GitHub.

## Prerequisites
1. **Git installed**: Download from https://git-scm.com/download/win
2. **GitHub account**: https://github.com
3. **Repository created**: Create empty repository on GitHub
4. **Personal Access Token**: Generate from https://github.com/settings/tokens

## Step-by-Step Manual Push

### 1. Navigate to Project Directory
```bash
cd c:\Users\User\OneDrive\Desktop\miles
```

### 2. Initialize Git (if not already done)
```bash
git init
```

### 3. Configure Git User (first time only)
```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 4. Add All Files
```bash
git add .
```

### 5. Create Initial Commit
```bash
git commit -m "Initial commit: EcoLoop - Smart Waste Management System with Incentives"
```

### 6. Add Remote Repository
```bash
git remote add origin https://github.com/your-username/Smart-Solid-Waste-Management-With-Incentives.git
```

Replace `your-username` with your actual GitHub username.

### 7. Rename Branch to Main (if needed)
```bash
git branch -M main
```

### 8. Push to GitHub
```bash
git push -u origin main
```

## Authentication

### Using Personal Access Token (Recommended)
1. Generate token: https://github.com/settings/tokens
2. Select scopes: `repo`, `workflow`
3. When prompted for password, paste the token (not your GitHub password)

### Using SSH (Alternative)
1. Generate SSH key: https://docs.github.com/en/github/authenticating-to-github/connecting-to-github-with-ssh
2. Add key to GitHub: https://github.com/settings/keys
3. Update remote URL:
   ```bash
   git remote set-url origin git@github.com:your-username/Smart-Solid-Waste-Management-With-Incentives.git
   ```
4. Push: `git push -u origin main`

## Troubleshooting

### Error: "fatal: not a git repository"
```bash
# Solution: Initialize git first
git init
```

### Error: "Authentication failed"
```bash
# Solution: Use personal access token instead of password
# Or configure SSH keys
```

### Error: "src refspec main does not match any"
```bash
# Solution: Make sure you have commits
git commit -m "Initial commit" --allow-empty
```

### Error: "Everything up-to-date"
```bash
# Solution: You've already pushed, verify at:
# https://github.com/your-username/Smart-Solid-Waste-Management-With-Incentives
```

## Verifying Push Success

1. Visit your repository: `https://github.com/your-username/Smart-Solid-Waste-Management-With-Incentives`
2. Verify files are present
3. Check commit history
4. Confirm main branch is default

## Subsequent Pushes

After initial push, future updates are simple:
```bash
git add .
git commit -m "Your commit message"
git push
```

## Useful Git Commands

```bash
# Check status
git status

# View commit history
git log --oneline

# View changes
git diff

# Create a new branch
git checkout -b feature-name

# Switch branches
git checkout branch-name

# Merge branches
git merge feature-name

# Delete branch
git branch -d feature-name
```

## GitHub Settings to Consider

1. **Branch Protection**: Prevent accidental deletions
2. **Require Pull Reviews**: Ensure code quality
3. **Require Status Checks**: Verify builds pass
4. **Require Signed Commits**: Enhanced security

Visit: https://github.com/your-username/Smart-Solid-Waste-Management-With-Incentives/settings

## Need Help?

- GitHub Docs: https://docs.github.com
- Git Documentation: https://git-scm.com/doc
- Stack Overflow: Tag `git` or `github`
