#!/bin/bash
cd "$(dirname "$0")/app"

if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    osascript -e 'display alert "Python이 설치되어 있지 않습니다." message "python.org에서 Python 3.8 이상을 설치하세요."'
    exit 1
fi

$PYTHON proxy.py &
sleep 2
open http://localhost:5001
