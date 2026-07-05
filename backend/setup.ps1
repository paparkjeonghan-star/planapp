# Backend setup script for Windows (PowerShell)
# Run from repository root: pwsh -File backend/setup.ps1

# Copy example env if missing
if (-Not (Test-Path "backend\.env")) {
  Copy-Item "backend\.env.example" "backend\.env" -Force
  Write-Host ".env created from .env.example"
} else {
  Write-Host ".env already exists"
}

# Install dependencies
Write-Host "Installing backend dependencies..."
Push-Location backend
npm install

# Generate Prisma client
Write-Host "Generating Prisma client..."
npx prisma generate

# Run migrations (creates SQLite dev.db)
Write-Host "Running Prisma migrate..."
npx prisma migrate dev --name init --preview-feature

Write-Host "Setup complete. Start the server with: npm run dev"
Pop-Location
