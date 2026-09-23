#!/bin/bash

# List of tests to run in sequence
TESTS=(
    "tests/Secure/instanceSetting.spec.js"
    "tests/Secure/addClient.spec.js"
)

echo "Starting sequential test execution..."

for test_file in "${TESTS[@]}"; do
    echo "------------------------------------------------"
    echo "Running test: $test_file"
    echo "------------------------------------------------"
    
    npx playwright test "$test_file" --workers=1
    
    # Store the exit code of the last test
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -ne 0 ]; then
        echo "❌ Test failed: $test_file (Exit code: $EXIT_CODE)"
        # Decide if you want to stop on first failure or continue
        # exit $EXIT_CODE 
    else
        echo "✅ Test passed: $test_file"
    fi
done

echo "Sequential test execution completed."