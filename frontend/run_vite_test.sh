#!/bin/bash
npm run dev > vite_output.log 2>&1 &
VITE_PID=$!
sleep 5
curl -s http://localhost:5173 > test_output.html
KILL_CMD="kill $VITE_PID"
eval $KILL_CMD
echo "Vite testing complete."
