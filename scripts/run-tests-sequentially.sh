#!/bin/bash
set +e

# List of tests to run in sequence
# Format: "test_file|extra_args|report_name"
TESTS=(
    "tests/Secure/login.spec.js||login"
    "tests/Secure/addClient.spec.js||addClient_all"
    # "tests/Secure/addMultiEntity.spec.js||addMultiEntity"
    # "tests/Secure/FramworkSettings/selectMandatoryOptions.spec.js||mandatoryOptions"
    # "tests/Secure/FramworkSettings/selectPartialRepresentation.spec.js||partialRepresentation"
    # "tests/Secure/FramworkSettings/selectFooterOptions.spec.js||footerOptions"
    # "tests/Secure/FramworkSettings/selectQuestionType.spec.js||questionType"
    # "tests/Secure/Collection/addComment.spec.js||addComment"
    # "tests/Secure/Collection/verifyReviewerModal.spec.js||verifyReviewerModal"
    # "tests/Secure/Collection/addAtifact.spec.js||addArtifact"
    # "tests/Secure/Collection/scoreCalculation.spec.js||scoreCalculation"
    # "tests/Secure/Collection/scoreCalculationPercentage.spec.js||scoreCalculationPercentage"
    # "tests/Secure/Collection/reviewerScoreCalculations.spec.js||reviewerScoreCalculation"
    # "tests/Secure/Collection/artifactregistry.spec.js||artifactRegistry"
    # "tests/Secure/RiskRegister/allRisks.spec.js||allRisks"
    # "tests/Secure/RiskRegister/riskGroup.spec.js||riskGroup"
    # "tests/Secure/Remediation/remediation.spec.js||remediation"
    # "tests/Secure/instanceSetting.spec.js||instanceSetting"
    # "tests/Secure/addVendor.spec.js||addVendor"
)

echo "Starting sequential test execution..."
# Clean up previous reports if desired, or let them accumulate in subfolders
# rm -rf playwright-report/sequential

# Track results for summary
PASSED_TESTS=()
FAILED_TESTS=()

for entry in "${TESTS[@]}"; do
    IFS="|" read -r test_file extra_args report_name <<< "$entry"
    
    echo "------------------------------------------------"
    echo "Running test: $test_file (Named: $report_name)"
    [ -n "$extra_args" ] && echo "With args: $extra_args"
    echo "------------------------------------------------"
    
    # Set unique report directory for each test
    REPORT_DIR="playwright-report/sequential/$report_name"
    
    # Run playwright test. CI=1 prevents opening the report on failure so we continue to the next spec.
    # We use a subshell to run the command and capture its status.
    (
        export PLAYWRIGHT_HTML_REPORT="$REPORT_DIR"
        export CI=1
        npx playwright test "$test_file" $extra_args --workers=1
    )
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -ne 0 ]; then
        echo "------------------------------------------------"
        echo "❌ RESULT: $report_name FAILED (Code: $EXIT_CODE)"
        echo "------------------------------------------------"
        FAILED_TESTS+=("$report_name")
    else
        echo "------------------------------------------------"
        echo "✅ RESULT: $report_name PASSED"
        echo "------------------------------------------------"
        PASSED_TESTS+=("$report_name")
    fi
    echo "Report saved to: $REPORT_DIR"
    echo ""
done

echo ""
echo "================================================"
echo "           SEQUENTIAL RUN SUMMARY"
echo "================================================"
echo "Total Tests Executed: ${#TESTS[@]}"
echo "Passed:               ${#PASSED_TESTS[@]}"
echo "Failed:               ${#FAILED_TESTS[@]}"
echo "================================================"

if [ ${#PASSED_TESTS[@]} -ne 0 ]; then
    echo "✅ PASSED TESTS:"
    for test in "${PASSED_TESTS[@]}"; do
        echo "  - $test"
    done
fi

if [ ${#FAILED_TESTS[@]} -ne 0 ]; then
    echo ""
    echo "❌ FAILED TESTS:"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  - $test"
    done
fi
echo ""
echo "Reports saved under: playwright-report/sequential/<report_name>"
echo "To view a report: npx playwright show-report playwright-report/sequential/<report_name>"
echo "================================================"

# The user wants to run all cases no matter if they fail or not.
# Usually, we still want the OVERALL script to exit with 1 if ANY failed 
# for CI/CD purposes, but we ensure the loop finishes first.
if [ ${#FAILED_TESTS[@]} -ne 0 ]; then
    echo "Some tests failed, exiting with code 1."
    exit 1
else
    echo "All tests passed successfully."
    exit 0
fi
