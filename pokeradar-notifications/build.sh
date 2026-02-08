#!/bin/bash
set -e

echo "Building pokeradar-notifications with monorepo support..."

# Go to monorepo root
cd ..

# Clean install
echo "Installing dependencies at root..."
npm ci

# Build shared package
echo "Building shared package..."
npm run build:shared

# Build notifications
echo "Building notifications service..."
cd pokeradar-notifications
npm run build

echo "Build complete!"
