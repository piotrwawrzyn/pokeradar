#!/bin/bash
set -e

echo "Building pokeradar-scrapper with monorepo support..."

# Go to monorepo root
cd ..

# Clean install
echo "Installing dependencies at root..."
npm ci

# Build shared package
echo "Building shared package..."
npm run build:shared

# Build scrapper
echo "Building scrapper service..."
cd pokeradar-scrapper
npm run build

# Install Chrome for Patchright
echo "Installing Chrome for Patchright..."
npx patchright install chrome

echo "Build complete!"
