#!/bin/bash

# Exit on error
set -e

# Check platform
platform=$(uname)

if [[ "$platform" == "Darwin" ]]; then
    echo "Running on macOS. Note that the AppImage created will only work on Linux systems."
    if ! command -v docker &> /dev/null; then
        echo "Docker Desktop for Mac is not installed. Please install it from https://www.docker.com/products/docker-desktop"
        exit 1
    fi
elif [[ "$platform" == "Linux" ]]; then
    echo "Running on Linux. Proceeding with AppImage creation..."
else
    echo "This script is intended to run on macOS or Linux. Current platform: $platform"
    exit 1
fi

# Enable BuildKit
export DOCKER_BUILDKIT=1

BUILD_IMAGE_NAME="zyntheo-appimage-builder"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

# Check and install Buildx if needed
if ! docker buildx version >/dev/null 2>&1; then
    echo "Installing Docker Buildx..."
    mkdir -p ~/.docker/cli-plugins/
    curl -SL https://github.com/docker/buildx/releases/download/v0.13.1/buildx-v0.13.1.linux-amd64 -o ~/.docker/cli-plugins/docker-buildx
    chmod +x ~/.docker/cli-plugins/docker-buildx
fi

# Download appimagetool if not present
if [ ! -f "appimagetool" ]; then
    echo "Downloading appimagetool..."
    wget -O appimagetool "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x appimagetool
fi

# Delete any existing AppImage to avoid bloating the build
rm -f Zyntheo-x86_64.AppImage

# Create build Dockerfile
echo "Creating build Dockerfile..."
cat > Dockerfile.build << 'EOF'
# syntax=docker/dockerfile:1
FROM ubuntu:20.04

# Install required dependencies
RUN apt-get update && apt-get install -y \
    libfuse2 \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxss1 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libdrm2 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
EOF

# Create .dockerignore file
echo "Creating .dockerignore file..."
cat > .dockerignore << EOF
Dockerfile.build
.dockerignore
.git
.gitignore
.DS_Store
*~
*.swp
*.swo
*.tmp
*.bak
*.log
*.err
node_modules/
venv/
*.egg-info/
*.tox/
dist/
EOF

# Build Docker image without cache
echo "Building Docker image (no cache)..."
docker build --no-cache -t "$BUILD_IMAGE_NAME" -f Dockerfile.build .

# Create AppImage using local appimagetool
echo "Creating AppImage..."
docker run --rm --privileged -v "$(pwd):/app" "$BUILD_IMAGE_NAME" bash -c '
cd /app && \
rm -rf ZyntheoApp.AppDir && \
mkdir -p ZyntheoApp.AppDir/usr/bin ZyntheoApp.AppDir/usr/lib ZyntheoApp.AppDir/usr/share/applications && \
find . -maxdepth 1 ! -name ZyntheoApp.AppDir ! -name "." ! -name ".." -exec cp -r {} ZyntheoApp.AppDir/usr/bin/ \; && \
cp zyntheo.png ZyntheoApp.AppDir/ && \
echo "[Desktop Entry]" > ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name=Zyntheo IDE" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Comment=Intelligence in Every Line." >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "GenericName=Text Editor" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Exec=zyntheo %F" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Icon=zyntheo" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Type=Application" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "StartupNotify=false" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "StartupWMClass=Zyntheo" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Categories=TextEditor;Development;IDE;" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "MimeType=application/x-zyntheo-workspace;" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Keywords=zyntheo;" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Actions=new-empty-window;" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "[Desktop Action new-empty-window]" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name=New Empty Window" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name[de]=Neues leeres Fenster" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name[es]=Nueva ventana vacía" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name[fr]=Nouvelle fenêtre vide" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name[it]=Nuova finestra vuota" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name[ja]=新しい空のウィンドウ" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name[ko]=새 빈 창" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name[ru]=Новое пустое окно" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name[zh_CN]=新建空窗口" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Name[zh_TW]=開新空視窗" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Exec=zyntheo --new-window %F" >> ZyntheoApp.AppDir/zyntheo.desktop && \
echo "Icon=zyntheo" >> ZyntheoApp.AppDir/zyntheo.desktop && \
chmod +x ZyntheoApp.AppDir/zyntheo.desktop && \
cp ZyntheoApp.AppDir/zyntheo.desktop ZyntheoApp.AppDir/usr/share/applications/ && \
echo "[Desktop Entry]" > ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "Name=Zyntheo IDE - URL Handler" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "Comment=Intelligence in Every Line." >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "GenericName=Text Editor" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "Exec=zyntheo --open-url %U" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "Icon=zyntheo" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "Type=Application" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "NoDisplay=true" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "StartupNotify=true" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "Categories=Utility;TextEditor;Development;IDE;" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "MimeType=x-scheme-handler/zyntheo;" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
echo "Keywords=zyntheo;" >> ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
chmod +x ZyntheoApp.AppDir/zyntheo-url-handler.desktop && \
cp ZyntheoApp.AppDir/zyntheo-url-handler.desktop ZyntheoApp.AppDir/usr/share/applications/ && \
echo "#!/bin/bash" > ZyntheoApp.AppDir/AppRun && \
echo "HERE=\$(dirname \"\$(readlink -f \"\${0}\")\")" >> ZyntheoApp.AppDir/AppRun && \
echo "export PATH=\${HERE}/usr/bin:\${PATH}" >> ZyntheoApp.AppDir/AppRun && \
echo "export LD_LIBRARY_PATH=\${HERE}/usr/lib:\${LD_LIBRARY_PATH}" >> ZyntheoApp.AppDir/AppRun && \
echo "exec \${HERE}/usr/bin/zyntheo --no-sandbox \"\$@\"" >> ZyntheoApp.AppDir/AppRun && \
chmod +x ZyntheoApp.AppDir/AppRun && \
chmod -R 755 ZyntheoApp.AppDir && \

# Strip unneeded symbols from the binary to reduce size
strip --strip-unneeded ZyntheoApp.AppDir/usr/bin/zyntheo

ls -la ZyntheoApp.AppDir/ && \
ARCH=x86_64 ./appimagetool -n ZyntheoApp.AppDir Zyntheo-x86_64.AppImage
'

# Clean up
rm -rf ZyntheoApp.AppDir .dockerignore appimagetool

echo "AppImage creation complete! Your AppImage is: Zyntheo-x86_64.AppImage"
