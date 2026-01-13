#!/bin/bash

# Script to create new packages following core-contracts standard
# Usage: ./create-package.sh <folder-name> <package-name> <description>

set -e

FOLDER_NAME=$1
PACKAGE_NAME=$2
DESCRIPTION=$3
FORCE_RECREATE=${4:-false}

if [ -z "$FOLDER_NAME" ] || [ -z "$PACKAGE_NAME" ] || [ -z "$DESCRIPTION" ]; then
  echo "Usage: $0 <folder-name> <package-name> <description>"
  echo "Example: $0 ui-core \"@livai/ui-core\" \"Атомарные UI компоненты\""
  exit 1
fi

PACKAGE_DIR="packages/$FOLDER_NAME"
TEMPLATE_DIR="packages/core-contracts"

echo "🚀 Creating package: $PACKAGE_NAME"
echo "📁 Folder: $PACKAGE_DIR"
echo "📝 Description: $DESCRIPTION"

# Check if package already exists - recreate if empty or force
if [ -d "$PACKAGE_DIR" ]; then
  if [ "$FORCE_RECREATE" = "true" ] || [ -z "$(ls -A $PACKAGE_DIR)" ]; then
    echo "♻️  Recreating existing package $PACKAGE_DIR..."
    rm -rf "$PACKAGE_DIR"/*
  else
    echo "❌ Package $PACKAGE_DIR already exists and not empty!"
    exit 1
  fi
fi

# Check if template exists
if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "❌ Template $TEMPLATE_DIR not found!"
  exit 1
fi

# Create package directory
mkdir -p "$PACKAGE_DIR"

# Copy template
echo "📋 Copying template from core-contracts..."
cp -r "$TEMPLATE_DIR"/* "$PACKAGE_DIR"/

# Remove build artifacts and caches for JS packages (not needed)
if [ "$FOLDER_NAME" != "core-contracts" ]; then
  echo "🧹 Removing .venv, .turbo, dist, node_modules (not needed for JS packages)..."
  rm -rf "$PACKAGE_DIR/.venv"
  rm -rf "$PACKAGE_DIR/.turbo"
  rm -rf "$PACKAGE_DIR/dist"
  rm -rf "$PACKAGE_DIR/node_modules"
fi

# Update package.json
echo "📦 Updating package.json..."
sed -i "s#@livai/core-contracts#$PACKAGE_NAME#g" "$PACKAGE_DIR/package.json"
sed -i "s#Core Contracts - Foundation layer.*#$DESCRIPTION#" "$PACKAGE_DIR/package.json"

# Clean src directory
echo "🧹 Cleaning src directory..."
rm -rf "$PACKAGE_DIR/src"/*
mkdir -p "$PACKAGE_DIR/src"

# Create basic index.ts
cat > "$PACKAGE_DIR/src/index.ts" << EOF
/**
 * @file $PACKAGE_NAME - $DESCRIPTION
 *
 * Этот пакет содержит $DESCRIPTION для LivAi.
 */

// TODO: Add exports here
EOF

# Create basic structure based on package type
case $FOLDER_NAME in
  "ui-core")
    mkdir -p "$PACKAGE_DIR/src/components"
    mkdir -p "$PACKAGE_DIR/src/hooks"
    mkdir -p "$PACKAGE_DIR/src/types"
    ;;
  "ui-features")
    mkdir -p "$PACKAGE_DIR/src/auth"
    mkdir -p "$PACKAGE_DIR/src/bots"
    mkdir -p "$PACKAGE_DIR/src/chat"
    mkdir -p "$PACKAGE_DIR/src/shared"
    ;;
  "feature-"*)
    mkdir -p "$PACKAGE_DIR/src/domain"
    mkdir -p "$PACKAGE_DIR/src/effects"
    mkdir -p "$PACKAGE_DIR/src/hooks"
    mkdir -p "$PACKAGE_DIR/src/stores"
    mkdir -p "$PACKAGE_DIR/src/types"
    ;;
  "app")
    mkdir -p "$PACKAGE_DIR/src/providers"
    mkdir -p "$PACKAGE_DIR/src/routing"
    mkdir -p "$PACKAGE_DIR/src/middleware"
    mkdir -p "$PACKAGE_DIR/src/composition"
    ;;
esac

# Create tests structure
mkdir -p "$PACKAGE_DIR/tests/unit"

echo "✅ Package $PACKAGE_NAME created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update package.json dependencies and peerDependencies"
echo "2. Implement package logic in src/"
echo "3. Add tests in tests/unit/"
echo "4. Update turbo.json if needed"
echo "5. Run: pnpm install && pnpm build --filter $PACKAGE_NAME"