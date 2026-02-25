#!/bin/bash
npx vite &
sleep 5
curl -s http://localhost:5173 > /dev/null
if [ $? -eq 0 ]; then
  echo "Vite is running"
else
  echo "Vite failed to start"
fi
kill %1
