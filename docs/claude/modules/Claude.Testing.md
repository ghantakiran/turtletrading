# Claude.Testing

- **Purpose**: Provide comprehensive testing framework with unit, integration, and E2E testing capabilities ensuring 100% coverage across all modules
- **Scope (in/out)**:
  - **In**: Pytest backend testing, Vitest frontend testing, Playwright E2E testing, test data fixtures, mocking frameworks, coverage reporting, CI/CD integration
  - **Out**: Production monitoring (handled by Infrastructure), user acceptance testing (handled by UserInterface), performance benchmarking (handled by specific modules)
- **Public API (signatures, inputs/outputs, errors)**:
  - `TestRunner.run_unit_tests() → TestResults`
  - `TestRunner.run_integration_tests() → TestResults`
  - `PlaywrightRunner.run_e2e_tests() → E2EResults`
  - `CoverageReporter.generate_report() → CoverageReport`
  - `MockDataFactory.create_stock_data(symbol) → MockStockData`
- **Data contracts (schemas, invariants)**:
  - TestResults: total_tests(int≥0), passed(int≥0), failed(int≥0), coverage_percentage(0≤float≤100), duration_ms(int>0)
  - MockStockData: symbol(str), prices(Array<float>), volume(Array<int>), timestamps(Array<datetime>), valid_date_range(boolean)
  - CoverageReport: module_name(str), line_coverage(0≤float≤100), branch_coverage(0≤float≤100), function_coverage(0≤float≤100)
  - E2EResults: scenarios_run(int≥0), scenarios_passed(int≥0), browser_coverage(Array<string>), screenshots(Array<string>)
- **Dependencies (internal/external)**:
  - **Internal**: All modules (StockAnalysis, MarketData, Authentication, UserInterface, DataSources, Infrastructure)
  - **External**: pytest, pytest-asyncio, pytest-cov, vitest, playwright, faker, factory-boy, responses, aioresponses
- **State & concurrency model**: Stateless test execution with isolated test environments, parallel test execution with resource locking, deterministic test data generation
- **Failure modes & retries**: Test environment isolation prevents cross-test contamination; flaky test detection with 3 retries; test data cleanup on failure
- **Performance/SLOs**: Unit tests <10s total, integration tests <60s total, E2E tests <300s total, 100% line/branch/function coverage mandatory
- **Security/permissions**: Test environment isolation, no production data access, mock credential management, secure test data generation
- **Observability (logs/metrics/traces)**: Test execution timing, coverage trends, failure analysis, flaky test detection, CI/CD integration metrics
- **Change risks & migration notes**: New modules require test specs; coverage thresholds block deployment; test data schema changes need fixture updates

## TDD: Requirements → Tests

### REQ-TEST-01: 100% code coverage enforcement with branch and function coverage
- **Unit tests**:
  - UT-TEST-01.1: Given module with uncovered lines When run_coverage_check() Then fail build and report missing lines
  - UT-TEST-01.2: Given module with uncovered branches When run_coverage_check() Then fail build and report missing branches
  - UT-TEST-01.3: Given module with 100% coverage When run_coverage_check() Then pass and generate coverage badge
- **Edge/negative/property tests**:
  - ET-TEST-01.1: Given malformed source code When calculate_coverage() Then handle gracefully and report parsing errors
  - ET-TEST-01.2: Given dynamic code execution When measure_coverage() Then capture runtime coverage accurately
  - PT-TEST-01.1: Property: coverage percentage monotonic with test additions, no false positives in coverage reporting
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock coverage.py with controllable coverage scenarios
  - Stub file system for coverage report generation
  - Fake source code with known coverage patterns
- **Coverage mapping**:
  - Lines/branches/functions covered: CoverageReporter, CoverageEnforcer, coverage_check(), generate_badge()

### REQ-TEST-02: Comprehensive mock data generation for all trading scenarios
- **Unit tests**:
  - UT-TEST-02.1: Given stock symbol When generate_mock_price_data() Then return realistic OHLCV data with proper trends
  - UT-TEST-02.2: Given market scenario When generate_mock_market_data() Then return consistent index and sentiment data
  - UT-TEST-02.3: Given user profile When generate_mock_user_data() Then return valid user with proper permissions
- **Edge/negative/property tests**:
  - ET-TEST-02.1: Given extreme market conditions When generate_mock_data() Then handle edge cases like market crashes
  - ET-TEST-02.2: Given invalid input parameters When create_mock_data() Then validate inputs and return appropriate errors
  - PT-TEST-02.1: Property: generated data maintains financial constraints (volume≥0, price>0), temporal consistency
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock external APIs with deterministic responses
  - Stub random number generation for reproducible tests
  - Fake time providers for temporal testing
- **Coverage mapping**:
  - Lines/branches/functions covered: MockDataFactory, generate_stock_data(), generate_user_data(), validate_mock_data()

### REQ-TEST-03: Playwright E2E testing with multi-browser support and CI integration
- **Unit tests**:
  - UT-TEST-03.1: Given browser configuration When launch_playwright() Then start browser with proper capabilities
  - UT-TEST-03.2: Given E2E test scenario When execute_test() Then navigate UI and validate interactions
  - UT-TEST-03.3: Given test failure When capture_evidence() Then save screenshots and logs for debugging
- **Edge/negative/property tests**:
  - ET-TEST-03.1: Given browser crash When handle_browser_failure() Then restart browser and retry test
  - ET-TEST-03.2: Given network interruption When E2E_test_running() Then handle gracefully with timeout
  - PT-TEST-03.1: Property: tests idempotent across browsers, UI state consistent after test completion
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock backend APIs with controllable responses
  - Stub browser APIs for headless testing
  - Fake network conditions for resilience testing
- **Coverage mapping**:
  - Lines/branches/functions covered: PlaywrightRunner, execute_e2e_test(), capture_screenshot(), browser_manager()

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-TEST-01 | UT-TEST-01.1-3 | ET-TEST-01.1-2 | PT-TEST-01.1 | IT-TEST-01 |
| REQ-TEST-02 | UT-TEST-02.1-3 | ET-TEST-02.1-2 | PT-TEST-02.1 | IT-TEST-02 |
| REQ-TEST-03 | UT-TEST-03.1-3 | ET-TEST-03.1-2 | PT-TEST-03.1 | IT-TEST-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **Test Execution**: discover_tests() → setup_environment() → run_parallel_tests() → collect_results() → generate_reports()
2. **Coverage Analysis**: instrument_code() → execute_tests() → measure_coverage() → enforce_thresholds() → generate_badges()
3. **E2E Testing**: start_services() → launch_browsers() → execute_scenarios() → capture_evidence() → cleanup()

### Pseudocode (reference)
```python
class TestRunner:
    async def run_comprehensive_tests(self) -> TestResults:
        # Setup test environment
        await self.setup_test_db()
        await self.start_mock_services()

        # Run unit tests with coverage
        unit_results = await self.run_unit_tests_with_coverage()
        if unit_results.coverage < 100:
            raise CoverageThresholdError(f"Coverage {unit_results.coverage}% < 100%")

        # Run integration tests
        integration_results = await self.run_integration_tests()

        # Run E2E tests
        e2e_results = await self.run_e2e_tests()

        # Generate comprehensive report
        return TestResults(
            unit=unit_results,
            integration=integration_results,
            e2e=e2e_results,
            total_coverage=unit_results.coverage
        )
```

### Error Handling & Retries
- **Flaky tests**: 3 automatic retries with exponential backoff, quarantine persistently failing tests
- **Environment failures**: Clean test database recreation, service restart, browser session reset
- **Coverage failures**: Detailed line-by-line reporting, suggest missing test cases
- **CI integration**: Fail-fast on coverage violations, detailed failure reports, parallel execution

### Config/flags
```python
TESTING_CONFIG = {
    "COVERAGE_THRESHOLD": 100,  # Mandatory 100% coverage
    "PARALLEL_WORKERS": 4,
    "TEST_TIMEOUT": 300,  # 5 minutes max per test
    "RETRY_FLAKY_TESTS": 3,
    "BROWSER_HEADLESS": True,
    "MOCK_EXTERNAL_APIS": True,
    "TEST_DB_URL": "postgresql://test:test@localhost:5432/test_db",
    "E2E_BROWSERS": ["chromium", "firefox", "webkit"],
    "COVERAGE_FORMATS": ["html", "xml", "json", "lcov"]
}
```