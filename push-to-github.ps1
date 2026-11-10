#!/usr/bin/env pwsh

# EcoLoop GitHub Push Script
# This script helps initialize and push the project to GitHub

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "EcoLoop - Smart Waste Management System" -ForegroundColor Cyan
Write-Host "GitHub Repository Setup" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is installed
Write-Host "Checking Git installation..." -ForegroundColor Yellow
$gitCheck = git --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "After installation, restart PowerShell and run this script again." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Git found: $gitCheck" -ForegroundColor Green
Write-Host ""

# Prompt for GitHub URL
Write-Host "GitHub Repository URL:" -ForegroundColor Yellow
Write-Host "Enter your GitHub repository URL (e.g., https://github.com/username/Smart-Solid-Waste-Management-With-Incentives.git)" -ForegroundColor Gray
$repoUrl = Read-Host "Repository URL"

if ([string]::IsNullOrWhiteSpace($repoUrl)) {
    Write-Host "[ERROR] Repository URL cannot be empty" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Initializing Git repository..." -ForegroundColor Yellow

# Initialize git if not already initialized
if (!(Test-Path .git)) {
    git init
    Write-Host "[OK] Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "[OK] Git repository already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "Configuring Git..." -ForegroundColor Yellow

# Configure git (optional)
$name = Read-Host "Enter your name (or press Enter to skip)"
$email = Read-Host "Enter your email (or press Enter to skip)"

if (![string]::IsNullOrWhiteSpace($name)) {
    git config user.name "$name"
    Write-Host "[OK] Git user name configured" -ForegroundColor Green
}

if (![string]::IsNullOrWhiteSpace($email)) {
    git config user.email "$email"
    Write-Host "[OK] Git user email configured" -ForegroundColor Green
}

Write-Host ""
Write-Host "Adding files to staging..." -ForegroundColor Yellow
git add .
Write-Host "[OK] All files staged for commit" -ForegroundColor Green

Write-Host ""
Write-Host "Creating initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit: EcoLoop - Smart Waste Management System"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Initial commit created" -ForegroundColor Green
} else {
    Write-Host "[WARN] Commit already exists or error occurred" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setting up remote repository..." -ForegroundColor Yellow

# Check if remote already exists
$remoteExists = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[WARN] Remote 'origin' already exists: $remoteExists" -ForegroundColor Yellow
    $removeRemote = Read-Host "Do you want to replace it? (yes/no)"
    if ($removeRemote.ToLower() -eq "yes") {
        git remote remove origin
        Write-Host "[OK] Old remote removed" -ForegroundColor Green
        git remote add origin $repoUrl
        Write-Host "[OK] New remote added" -ForegroundColor Green
    }
} else {
    git remote add origin $repoUrl
    Write-Host "[OK] Remote 'origin' added" -ForegroundColor Green
}

Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "Note: This may prompt for authentication (GitHub token/password)" -ForegroundColor Gray

# Attempt to push
git branch -M main
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your repository is ready at: $repoUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Visit your repository on GitHub" -ForegroundColor Gray
    Write-Host "2. Configure branch protection rules (optional)" -ForegroundColor Gray
    Write-Host "3. Set up collaborators if needed" -ForegroundColor Gray
    Write-Host "4. Enable GitHub Pages for documentation (optional)" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "[ERROR] Push failed. Common reasons:" -ForegroundColor Red
    Write-Host "- Authentication failed (incorrect token/password)" -ForegroundColor Gray
    Write-Host "- Repository not found" -ForegroundColor Gray
    Write-Host "- Network connection issue" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Verify repository URL is correct" -ForegroundColor Gray
    Write-Host "2. Create a personal access token: https://github.com/settings/tokens" -ForegroundColor Gray
    Write-Host "3. Use your token as password when prompted" -ForegroundColor Gray
    Write-Host "4. Try manual push: git push -u origin main" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "Setup Complete! Happy coding!" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
