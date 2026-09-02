@echo off
REM Build Pathfinder C++ to WebAssembly using Emscripten
REM Install Emscripten: https://emscripten.org/docs/getting_started/downloads.html

where emcc >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: emcc not found. Install Emscripten SDK first.
    echo   git clone https://github.com/emscripten-core/emsdk.git
    echo   cd emsdk ^&^& emsdk install latest ^&^& emsdk activate latest
    echo   emsdk_env.bat
    exit /b 1
)

if not exist "wasm" mkdir wasm

echo Building pathfinder WASM...
emcc cpp/pathfinder.cpp cpp/bindings.cpp ^
    -o wasm/pathfinder.js ^
    -O3 ^
    -s WASM=1 ^
    -s MODULARIZE=1 ^
    -s EXPORT_ES6=1 ^
    -s EXPORT_NAME=createPathfinderModule ^
    -s EXPORTED_FUNCTIONS=["_pf_init","_pf_set_wall","_pf_set_weight","_pf_set_start","_pf_set_end","_pf_clear_walls","_pf_reset","_pf_run","_pf_free","_malloc","_free"] ^
    -s EXPORTED_RUNTIME_METHODS=["HEAP32"] ^
    -s ALLOW_MEMORY_GROWTH=1 ^
    -s ENVIRONMENT=web ^
    -std=c++17

if %ERRORLEVEL% equ 0 (
    echo.
    echo Build successful! Output in wasm/
    echo Serve the project with: npx serve .
) else (
    echo Build failed.
    exit /b 1
)
