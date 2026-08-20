#!/bin/bash

# Without the line below, errors occur
export NODE_OPTIONS=--openssl-legacy-provider

# Step 1: make sure you are at the correct tag/version
# Step 2: make sure you set up the correct environment in webpack.config.js (which is either 'production' or 'demo')
# Step 3: make sure you have the latest version of manual/, check out the slate repos

if [ -z "$1" ]
then
  echo "Error: please specify the output path" && exit 1
fi

if [ ! -d "$1" ]
then
  echo "Error: directory does not exist" && exit 1
fi

APPNAME="builderjs"
VERSION=$(git tag --points-at HEAD)

if [ -z "$VERSION" ]
then
  echo "Error: no version (tag) found" && exit 1
fi

APPDIR="$APPNAME"
APPZIP="$APPNAME-$VERSION.zip"
OUTPUT="$1/$APPDIR"
CURDIR=$(pwd)

if [ -d "$OUTPUT" ]; then
  echo "Error: directory [$OUTPUT] already exists" && exit 1
fi

CURPATH=$(pwd)

# Build
rm -fr dist
npm run build

# Copy
# Copy folder sample, make it the primary folder
cp -r $CURPATH $OUTPUT

# Change dir to Output
cd $OUTPUT
# rm -fr templates/other/*
# mv free_templates/* templates/other/
# rm -fr tmp/*

# Delete git
rm .git -fr
rm -fr node_modules
rm README.MD
rm fix_theme_templates.ps1
rm fix_theme_templates_clean.ps1

# Clean up themes
rm -fr demo/themes/career
rm -fr demo/themes/carousel
rm -fr demo/themes/extended
rm -fr demo/themes/other
rm -fr demo/themes/popup
rm -fr demo/themes/system

chmod 755 -R .
chmod 775 -R ./tmp

# create version file
touch VERSION
echo "$VERSION" > VERSION
touch "$VERSION"

# ZIP
cd ../
zip -r "$APPZIP" "$APPDIR"
rm -fr "$APPDIR"

echo "File exported [$APPZIP]"
