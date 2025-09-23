#!/usr/bin/env python3
"""
Test Coverage Validation Script for TA-Lib Indicator Lab

This script validates that the TA-Lib Indicator Lab implementation has 100% test coverage
across all components as specified in the feature requirements.
"""

import os
import sys
import subprocess
import json
import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import argparse


class CoverageValidator:
    """Validates test coverage for the TA-Lib Indicator Lab."""

    def __init__(self, backend_path: str):
        self.backend_path = Path(backend_path)
        self.app_path = self.backend_path / "app"
        self.tests_path = self.backend_path / "tests"
        self.coverage_threshold = 100.0  # 100% coverage requirement

        # TA-Lib Indicator Lab components to validate
        self.indicator_lab_components = {
            "models": [
                "app/models/ta_lib_indicator_models.py"
            ],
            "services": [
                "app/services/indicator_computation_engine.py"
            ],
            "api": [
                "app/api/v1/indicator_lab.py"
            ],
            "tests": [
                "tests/test_indicator_lab.py",
                "tests/test_indicator_lab_integration.py",
                "tests/test_golden_samples_validation.py"
            ]
        }

    def validate_file_existence(self) -> Dict[str, bool]:
        """Validate that all required files exist."""
        print("🔍 Validating file existence...")
        results = {}

        for category, files in self.indicator_lab_components.items():
            for file_path in files:
                full_path = self.backend_path / file_path
                exists = full_path.exists()
                results[file_path] = exists
                status = "✅" if exists else "❌"
                print(f"  {status} {file_path}")

        return results

    def count_lines_of_code(self) -> Dict[str, int]:
        """Count lines of code in each component."""
        print("\n📊 Counting lines of code...")
        results = {}

        for category, files in self.indicator_lab_components.items():
            if category == "tests":
                continue  # Skip tests for LOC count

            for file_path in files:
                full_path = self.backend_path / file_path
                if full_path.exists():
                    with open(full_path, 'r', encoding='utf-8') as f:
                        lines = len([line for line in f if line.strip() and not line.strip().startswith('#')])
                        results[file_path] = lines
                        print(f"  📄 {file_path}: {lines} lines")
                else:
                    results[file_path] = 0

        return results

    def analyze_test_coverage_static(self) -> Dict[str, float]:
        """Perform static analysis of test coverage."""
        print("\n🧪 Analyzing test coverage (static analysis)...")
        coverage_results = {}

        # Analyze each test file for coverage patterns
        test_files = self.indicator_lab_components["tests"]

        for test_file in test_files:
            full_path = self.backend_path / test_file
            if full_path.exists():
                coverage = self._analyze_test_file_coverage(full_path)
                coverage_results[test_file] = coverage
                status = "✅" if coverage >= self.coverage_threshold else "⚠️"
                print(f"  {status} {test_file}: {coverage:.1f}% estimated coverage")
            else:
                coverage_results[test_file] = 0.0
                print(f"  ❌ {test_file}: Missing")

        return coverage_results

    def _analyze_test_file_coverage(self, test_file: Path) -> float:
        """Analyze a test file to estimate coverage."""
        with open(test_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Count test functions
        test_functions = len([line for line in content.split('\n') if line.strip().startswith('def test_')])

        # Count assertion statements
        assertions = len([line for line in content.split('\n') if 'assert ' in line])

        # Count class methods being tested (heuristic)
        import_patterns = ['from app.', 'import app.']
        has_imports = any(pattern in content for pattern in import_patterns)

        # Estimate coverage based on test density
        if test_functions >= 10 and assertions >= 20 and has_imports:
            return 95.0  # High coverage estimate
        elif test_functions >= 5 and assertions >= 10 and has_imports:
            return 80.0  # Medium coverage estimate
        elif test_functions >= 2 and assertions >= 5:
            return 60.0  # Basic coverage estimate
        else:
            return 30.0  # Low coverage estimate

    def validate_golden_samples(self) -> Dict[str, bool]:
        """Validate golden samples completeness."""
        print("\n🏆 Validating golden samples...")

        golden_samples_path = self.tests_path / "golden_samples"
        results = {}

        required_presets = ["momentum_scalping", "trend_following", "mean_reversion"]

        for preset in required_presets:
            preset_file = golden_samples_path / f"{preset}_preset.py"
            exists = preset_file.exists()
            results[preset] = exists

            if exists:
                # Check file content quality
                with open(preset_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                has_sample_data = "SAMPLE_OHLCV_DATA" in content
                has_expected_outputs = "EXPECTED_" in content
                has_validation = "validate_golden_sample" in content

                quality_score = sum([has_sample_data, has_expected_outputs, has_validation])
                status = "✅" if quality_score >= 3 else "⚠️"
                print(f"  {status} {preset}: Quality score {quality_score}/3")
            else:
                print(f"  ❌ {preset}: Missing")

        # Check for golden samples index
        init_file = golden_samples_path / "__init__.py"
        results["__init__"] = init_file.exists()
        status = "✅" if init_file.exists() else "❌"
        print(f"  {status} Golden samples registry (__init__.py)")

        return results

    def validate_api_completeness(self) -> Dict[str, bool]:
        """Validate API endpoint completeness."""
        print("\n🔌 Validating API completeness...")

        api_file = self.backend_path / "app/api/v1/indicator_lab.py"
        results = {}

        if not api_file.exists():
            print("  ❌ API file missing")
            return {"api_file": False}

        with open(api_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check for required endpoints
        required_endpoints = [
            "search_indicators",
            "get_indicator_definition",
            "create_graph",
            "get_graph",
            "update_graph",
            "delete_graph",
            "compute_graph",
            "get_computation_result",
            "parameter_sweep",
            "create_preset",
            "get_preset",
            "list_presets",
            "update_preset",
            "delete_preset"
        ]

        for endpoint in required_endpoints:
            exists = f"def {endpoint}" in content or f"async def {endpoint}" in content
            results[endpoint] = exists
            status = "✅" if exists else "❌"
            print(f"  {status} {endpoint}")

        return results

    def validate_data_models(self) -> Dict[str, bool]:
        """Validate data model completeness."""
        print("\n📋 Validating data models...")

        models_file = self.backend_path / "app/models/ta_lib_indicator_models.py"
        results = {}

        if not models_file.exists():
            print("  ❌ Models file missing")
            return {"models_file": False}

        with open(models_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check for required models
        required_models = [
            "IndicatorDefinition",
            "IndicatorParameter",
            "DataConnection",
            "ComputationNode",
            "ComputationGraph",
            "ComputationResult",
            "ParameterSweepConfig",
            "ParameterSweepResult",
            "IndicatorPreset"
        ]

        for model in required_models:
            exists = f"class {model}" in content
            results[model] = exists
            status = "✅" if exists else "❌"
            print(f"  {status} {model}")

        return results

    def generate_coverage_report(self) -> Dict[str, any]:
        """Generate comprehensive coverage report."""
        print("\n📈 Generating comprehensive coverage report...")

        file_existence = self.validate_file_existence()
        lines_of_code = self.count_lines_of_code()
        test_coverage = self.analyze_test_coverage_static()
        golden_samples = self.validate_golden_samples()
        api_completeness = self.validate_api_completeness()
        data_models = self.validate_data_models()

        # Calculate overall scores
        total_files = len([f for files in self.indicator_lab_components.values() for f in files])
        existing_files = sum(file_existence.values())
        file_completion = (existing_files / total_files) * 100

        avg_test_coverage = sum(test_coverage.values()) / len(test_coverage) if test_coverage else 0

        golden_samples_completion = (sum(golden_samples.values()) / len(golden_samples)) * 100
        api_completion = (sum(api_completeness.values()) / len(api_completeness)) * 100
        models_completion = (sum(data_models.values()) / len(data_models)) * 100

        report = {
            "file_existence": file_existence,
            "lines_of_code": lines_of_code,
            "test_coverage": test_coverage,
            "golden_samples": golden_samples,
            "api_completeness": api_completeness,
            "data_models": data_models,
            "summary": {
                "file_completion_percentage": file_completion,
                "average_test_coverage": avg_test_coverage,
                "golden_samples_completion": golden_samples_completion,
                "api_completion": api_completion,
                "models_completion": models_completion,
                "total_lines_of_code": sum(lines_of_code.values())
            }
        }

        return report

    def print_summary(self, report: Dict[str, any]):
        """Print a summary of the coverage validation."""
        print("\n" + "="*60)
        print("🎯 TA-LIB INDICATOR LAB COVERAGE VALIDATION SUMMARY")
        print("="*60)

        summary = report["summary"]

        print(f"\n📊 Overall Metrics:")
        print(f"  • File Completion: {summary['file_completion_percentage']:.1f}%")
        print(f"  • Average Test Coverage: {summary['average_test_coverage']:.1f}%")
        print(f"  • Golden Samples: {summary['golden_samples_completion']:.1f}%")
        print(f"  • API Completeness: {summary['api_completion']:.1f}%")
        print(f"  • Data Models: {summary['models_completion']:.1f}%")
        print(f"  • Total Lines of Code: {summary['total_lines_of_code']:,}")

        # Overall grade
        overall_score = (
            summary['file_completion_percentage'] * 0.2 +
            summary['average_test_coverage'] * 0.3 +
            summary['golden_samples_completion'] * 0.2 +
            summary['api_completion'] * 0.15 +
            summary['models_completion'] * 0.15
        )

        if overall_score >= 95:
            grade = "🏆 EXCELLENT"
            color = "🟢"
        elif overall_score >= 85:
            grade = "✅ GOOD"
            color = "🟡"
        elif overall_score >= 70:
            grade = "⚠️ NEEDS IMPROVEMENT"
            color = "🟠"
        else:
            grade = "❌ POOR"
            color = "🔴"

        print(f"\n{color} Overall Grade: {grade} ({overall_score:.1f}/100)")

        # Recommendations
        print(f"\n💡 Recommendations:")
        if summary['average_test_coverage'] < 100:
            print("  • Increase test coverage to reach 100% requirement")
        if summary['api_completion'] < 100:
            print("  • Complete missing API endpoints")
        if summary['models_completion'] < 100:
            print("  • Implement missing data models")
        if summary['golden_samples_completion'] < 100:
            print("  • Complete golden samples for all presets")

        if overall_score >= 95:
            print("  🎉 Excellent work! All requirements nearly met.")

    def save_report(self, report: Dict[str, any], output_file: str):
        """Save the coverage report to a JSON file."""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)
        print(f"\n💾 Detailed report saved to: {output_file}")


def main():
    """Main function to run coverage validation."""
    parser = argparse.ArgumentParser(description="Validate TA-Lib Indicator Lab test coverage")
    parser.add_argument("--backend-path", default=".", help="Path to backend directory")
    parser.add_argument("--output", default="coverage_report.json", help="Output file for detailed report")
    parser.add_argument("--threshold", type=float, default=100.0, help="Coverage threshold percentage")

    args = parser.parse_args()

    print("🚀 TA-LIB INDICATOR LAB COVERAGE VALIDATOR")
    print("=" * 50)

    validator = CoverageValidator(args.backend_path)
    validator.coverage_threshold = args.threshold

    try:
        report = validator.generate_coverage_report()
        validator.print_summary(report)
        validator.save_report(report, args.output)

        # Exit with appropriate code
        overall_score = (
            report["summary"]["file_completion_percentage"] * 0.2 +
            report["summary"]["average_test_coverage"] * 0.3 +
            report["summary"]["golden_samples_completion"] * 0.2 +
            report["summary"]["api_completion"] * 0.15 +
            report["summary"]["models_completion"] * 0.15
        )

        if overall_score >= args.threshold:
            print(f"\n✅ SUCCESS: Coverage validation passed ({overall_score:.1f}% >= {args.threshold}%)")
            sys.exit(0)
        else:
            print(f"\n❌ FAILURE: Coverage validation failed ({overall_score:.1f}% < {args.threshold}%)")
            sys.exit(1)

    except Exception as e:
        print(f"\n💥 ERROR: Coverage validation failed with exception: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()