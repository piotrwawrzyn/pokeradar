#!/bin/bash
set -e

echo "Building pokeradar-api with monorepo support..."

# Go to monorepo root
cd ..

# Clean install
echo "Installing dependencies at root..."
npm ci

# Build shared package
echo "Building shared package..."
npm run build:shared

# Build API
echo "Building API..."
cd pokeradar-api
npm run build

echo "Build complete!"
