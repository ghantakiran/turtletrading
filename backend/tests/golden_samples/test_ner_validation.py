"""
NER Validation Test Runner using Golden Labeled Samples.

This module validates the Named Entity Recognition system against manually
labeled golden samples to ensure accuracy and consistency.
"""

import pytest
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Tuple
from datetime import datetime
import asyncio

from app.services.nlp_pipeline_service import NLPPipelineService, create_nlp_pipeline_service
from app.models.sentiment_ner_models import (
    EntityType, SentimentPolarity, ContentType, ProcessedContent
)


class NERValidationRunner:
    """Validates NER system against golden labeled samples."""

    def __init__(self, nlp_service: NLPPipelineService):
        self.nlp_service = nlp_service
        self.validation_results = {
            "total_samples": 0,
            "passed_samples": 0,
            "failed_samples": 0,
            "entity_accuracy": {},
            "sentiment_accuracy": {},
            "ticker_mapping_accuracy": 0.0,
            "detailed_results": []
        }

    def load_golden_samples(self, file_path: str) -> Dict[str, Any]:
        """Load golden samples from JSON file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    async def validate_sample(
        self,
        sample: Dict[str, Any],
        evaluation_criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate a single sample against ground truth."""

        # Process content through NLP pipeline
        try:
            processed = await self.nlp_service.process_content(
                content_id=sample["sample_id"],
                text=sample["text"],
                content_type=getattr(ContentType, sample["content_type"]),
                source_url=sample["source_url"],
                metadata=sample.get("metadata", {})
            )
        except Exception as e:
            return {
                "sample_id": sample["sample_id"],
                "status": "ERROR",
                "error": str(e),
                "entity_results": {},
                "sentiment_results": {},
                "ticker_mapping_results": {}
            }

        # Validate entities
        entity_results = self._validate_entities(
            processed.named_entities,
            sample["ground_truth_entities"],
            evaluation_criteria
        )

        # Validate sentiment
        sentiment_results = self._validate_sentiment(
            processed,
            sample["expected_sentiment"],
            evaluation_criteria
        )

        # Validate ticker mapping
        ticker_mapping_results = self._validate_ticker_mapping(
            processed,
            sample["ground_truth_entities"],
            evaluation_criteria
        )

        # Calculate overall score
        overall_score = self._calculate_overall_score(
            entity_results, sentiment_results, ticker_mapping_results
        )

        return {
            "sample_id": sample["sample_id"],
            "status": "PASS" if overall_score >= 0.8 else "FAIL",
            "overall_score": overall_score,
            "entity_results": entity_results,
            "sentiment_results": sentiment_results,
            "ticker_mapping_results": ticker_mapping_results,
            "processed_entities": len(processed.named_entities),
            "expected_entities": len(sample["ground_truth_entities"])
        }

    def _validate_entities(
        self,
        extracted_entities: List,
        ground_truth_entities: List[Dict],
        criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate extracted entities against ground truth."""

        entity_criteria = criteria["entity_matching"]
        results = {
            "total_expected": len(ground_truth_entities),
            "total_extracted": len(extracted_entities),
            "exact_matches": 0,
            "partial_matches": 0,
            "type_matches": 0,
            "missed_entities": 0,
            "false_positives": 0,
            "precision": 0.0,
            "recall": 0.0,
            "f1_score": 0.0,
            "by_type": {}
        }

        # Convert extracted entities to comparable format
        extracted_list = []
        for entity in extracted_entities:
            extracted_list.append({
                "text": entity.text,
                "start_position": entity.start_position,
                "end_position": entity.end_position,
                "entity_type": entity.entity_type.value,
                "confidence": entity.confidence,
                "mapped_ticker": entity.mapped_ticker,
                "ticker_confidence": entity.ticker_confidence
            })

        # Track matches
        gt_matched = set()
        extracted_matched = set()

        # Find exact and partial matches
        for i, gt_entity in enumerate(ground_truth_entities):
            best_match = None
            best_score = 0

            for j, ext_entity in enumerate(extracted_list):
                if j in extracted_matched:
                    continue

                score = self._calculate_entity_match_score(
                    gt_entity, ext_entity, entity_criteria
                )

                if score > best_score and score >= 0.7:  # Minimum match threshold
                    best_score = score
                    best_match = j

            if best_match is not None:
                gt_matched.add(i)
                extracted_matched.add(best_match)

                if best_score >= 0.95:
                    results["exact_matches"] += 1
                else:
                    results["partial_matches"] += 1

                # Track by entity type
                entity_type = gt_entity["entity_type"]
                if entity_type not in results["by_type"]:
                    results["by_type"][entity_type] = {"found": 0, "total": 0}
                results["by_type"][entity_type]["found"] += 1

        # Count missed entities and false positives
        results["missed_entities"] = len(ground_truth_entities) - len(gt_matched)
        results["false_positives"] = len(extracted_list) - len(extracted_matched)

        # Count totals by type
        for gt_entity in ground_truth_entities:
            entity_type = gt_entity["entity_type"]
            if entity_type not in results["by_type"]:
                results["by_type"][entity_type] = {"found": 0, "total": 0}
            results["by_type"][entity_type]["total"] += 1

        # Calculate metrics
        true_positives = results["exact_matches"] + results["partial_matches"]
        if len(extracted_list) > 0:
            results["precision"] = true_positives / len(extracted_list)
        if len(ground_truth_entities) > 0:
            results["recall"] = true_positives / len(ground_truth_entities)

        if results["precision"] + results["recall"] > 0:
            results["f1_score"] = (
                2 * results["precision"] * results["recall"] /
                (results["precision"] + results["recall"])
            )

        return results

    def _calculate_entity_match_score(
        self,
        gt_entity: Dict,
        ext_entity: Dict,
        criteria: Dict
    ) -> float:
        """Calculate match score between ground truth and extracted entity."""
        score = 0.0

        # Text match (40% of score)
        if gt_entity["text"].lower() == ext_entity["text"].lower():
            score += 0.4
        elif gt_entity["text"].lower() in ext_entity["text"].lower() or \
             ext_entity["text"].lower() in gt_entity["text"].lower():
            score += 0.2

        # Position match (30% of score)
        pos_tolerance = 3  # Allow 3 character tolerance
        if (abs(gt_entity["start_position"] - ext_entity["start_position"]) <= pos_tolerance and
            abs(gt_entity["end_position"] - ext_entity["end_position"]) <= pos_tolerance):
            score += 0.3
        elif (abs(gt_entity["start_position"] - ext_entity["start_position"]) <= pos_tolerance * 2 and
              abs(gt_entity["end_position"] - ext_entity["end_position"]) <= pos_tolerance * 2):
            score += 0.15

        # Type match (30% of score)
        if gt_entity["entity_type"] == ext_entity["entity_type"]:
            score += 0.3

        return score

    def _validate_sentiment(
        self,
        processed: ProcessedContent,
        expected_sentiment: Dict,
        criteria: Dict
    ) -> Dict[str, Any]:
        """Validate sentiment analysis results."""

        sentiment_criteria = criteria["sentiment_matching"]
        results = {
            "overall_sentiment_correct": False,
            "overall_score_diff": 0.0,
            "overall_polarity_correct": False,
            "ticker_sentiments_correct": 0,
            "ticker_sentiments_total": 0,
            "sentiment_accuracy": 0.0
        }

        # Validate overall sentiment
        if processed.overall_sentiment:
            score_diff = abs(
                processed.overall_sentiment.score - expected_sentiment["overall_score"]
            )
            results["overall_score_diff"] = score_diff
            results["overall_sentiment_correct"] = score_diff <= sentiment_criteria["score_tolerance"]

            # Map polarity enum to string for comparison
            extracted_polarity = processed.overall_sentiment.polarity.value
            expected_polarity = expected_sentiment["polarity"]
            results["overall_polarity_correct"] = extracted_polarity == expected_polarity

        # Validate ticker-specific sentiments
        expected_ticker_sentiments = expected_sentiment.get("ticker_sentiments", {})
        results["ticker_sentiments_total"] = len(expected_ticker_sentiments)

        for ticker, expected_ticker_sentiment in expected_ticker_sentiments.items():
            if ticker in processed.ticker_sentiments:
                extracted_ticker_sentiment = processed.ticker_sentiments[ticker]

                score_diff = abs(
                    extracted_ticker_sentiment.score - expected_ticker_sentiment["score"]
                )

                if score_diff <= sentiment_criteria["score_tolerance"]:
                    # Check polarity match
                    extracted_polarity = extracted_ticker_sentiment.polarity.value
                    expected_polarity = expected_ticker_sentiment["polarity"]

                    if extracted_polarity == expected_polarity:
                        results["ticker_sentiments_correct"] += 1

        # Calculate overall sentiment accuracy
        overall_weight = 0.5
        ticker_weight = 0.5

        overall_accuracy = (
            (1.0 if results["overall_sentiment_correct"] and results["overall_polarity_correct"] else 0.0) *
            overall_weight
        )

        ticker_accuracy = 0.0
        if results["ticker_sentiments_total"] > 0:
            ticker_accuracy = (
                results["ticker_sentiments_correct"] / results["ticker_sentiments_total"] *
                ticker_weight
            )

        results["sentiment_accuracy"] = overall_accuracy + ticker_accuracy

        return results

    def _validate_ticker_mapping(
        self,
        processed: ProcessedContent,
        ground_truth_entities: List[Dict],
        criteria: Dict
    ) -> Dict[str, Any]:
        """Validate ticker mapping accuracy."""

        results = {
            "primary_tickers_correct": 0,
            "primary_tickers_total": 0,
            "entity_mappings_correct": 0,
            "entity_mappings_total": 0,
            "mapping_accuracy": 0.0
        }

        # Check primary tickers
        expected_tickers = set()
        for entity in ground_truth_entities:
            if (entity["entity_type"] == "TICKER" and
                entity.get("mapped_ticker")):
                expected_tickers.add(entity["mapped_ticker"])

        results["primary_tickers_total"] = len(expected_tickers)
        found_tickers = set(processed.primary_tickers)
        results["primary_tickers_correct"] = len(expected_tickers.intersection(found_tickers))

        # Check entity-level ticker mappings
        for gt_entity in ground_truth_entities:
            if gt_entity.get("mapped_ticker"):
                results["entity_mappings_total"] += 1

                # Find corresponding extracted entity
                for ext_entity in processed.named_entities:
                    if (self._entities_match_for_mapping(gt_entity, ext_entity) and
                        ext_entity.mapped_ticker == gt_entity["mapped_ticker"]):
                        results["entity_mappings_correct"] += 1
                        break

        # Calculate mapping accuracy
        if results["entity_mappings_total"] > 0:
            results["mapping_accuracy"] = (
                results["entity_mappings_correct"] / results["entity_mappings_total"]
            )

        return results

    def _entities_match_for_mapping(self, gt_entity: Dict, ext_entity) -> bool:
        """Check if entities match for ticker mapping validation."""
        return (
            gt_entity["text"].lower() == ext_entity.text.lower() and
            gt_entity["entity_type"] == ext_entity.entity_type.value
        )

    def _calculate_overall_score(
        self,
        entity_results: Dict,
        sentiment_results: Dict,
        ticker_mapping_results: Dict
    ) -> float:
        """Calculate overall validation score."""

        # Weight different aspects
        entity_weight = 0.5
        sentiment_weight = 0.3
        mapping_weight = 0.2

        entity_score = entity_results["f1_score"]
        sentiment_score = sentiment_results["sentiment_accuracy"]
        mapping_score = ticker_mapping_results["mapping_accuracy"]

        overall_score = (
            entity_score * entity_weight +
            sentiment_score * sentiment_weight +
            mapping_score * mapping_weight
        )

        return overall_score

    async def run_validation(self, samples_directory: str) -> Dict[str, Any]:
        """Run validation on all golden samples."""

        samples_dir = Path(samples_directory)

        # Load all sample files
        sample_files = list(samples_dir.glob("*.json"))

        all_results = []

        for sample_file in sample_files:
            print(f"Validating samples from: {sample_file.name}")

            # Load samples
            golden_data = self.load_golden_samples(str(sample_file))
            samples = golden_data["samples"]
            criteria = golden_data["evaluation_criteria"]

            # Validate each sample
            for sample in samples:
                result = await self.validate_sample(sample, criteria)
                all_results.append(result)

                if result["status"] == "PASS":
                    self.validation_results["passed_samples"] += 1
                else:
                    self.validation_results["failed_samples"] += 1

                self.validation_results["total_samples"] += 1
                self.validation_results["detailed_results"].append(result)

        # Calculate aggregate metrics
        self._calculate_aggregate_metrics()

        return self.validation_results

    def _calculate_aggregate_metrics(self):
        """Calculate aggregate validation metrics."""

        if self.validation_results["total_samples"] == 0:
            return

        # Overall accuracy
        total_samples = self.validation_results["total_samples"]
        passed_samples = self.validation_results["passed_samples"]

        overall_accuracy = passed_samples / total_samples

        # Entity type accuracies
        entity_type_stats = {}
        sentiment_scores = []
        mapping_scores = []

        for result in self.validation_results["detailed_results"]:
            if result["status"] != "ERROR":
                # Collect entity type stats
                for entity_type, stats in result["entity_results"].get("by_type", {}).items():
                    if entity_type not in entity_type_stats:
                        entity_type_stats[entity_type] = {"found": 0, "total": 0}
                    entity_type_stats[entity_type]["found"] += stats["found"]
                    entity_type_stats[entity_type]["total"] += stats["total"]

                # Collect sentiment and mapping scores
                sentiment_scores.append(result["sentiment_results"]["sentiment_accuracy"])
                mapping_scores.append(result["ticker_mapping_results"]["mapping_accuracy"])

        # Calculate entity accuracy by type
        for entity_type, stats in entity_type_stats.items():
            if stats["total"] > 0:
                accuracy = stats["found"] / stats["total"]
                self.validation_results["entity_accuracy"][entity_type] = accuracy

        # Calculate average sentiment and mapping accuracy
        if sentiment_scores:
            self.validation_results["sentiment_accuracy"]["average"] = sum(sentiment_scores) / len(sentiment_scores)

        if mapping_scores:
            self.validation_results["ticker_mapping_accuracy"] = sum(mapping_scores) / len(mapping_scores)

        # Add overall accuracy
        self.validation_results["overall_accuracy"] = overall_accuracy

    def generate_report(self, output_file: str = None) -> str:
        """Generate a detailed validation report."""

        report = []
        report.append("=" * 80)
        report.append("NER VALIDATION REPORT")
        report.append("=" * 80)
        report.append(f"Generated: {datetime.utcnow().isoformat()}")
        report.append(f"Total Samples: {self.validation_results['total_samples']}")
        report.append(f"Passed: {self.validation_results['passed_samples']}")
        report.append(f"Failed: {self.validation_results['failed_samples']}")
        report.append(f"Overall Accuracy: {self.validation_results.get('overall_accuracy', 0):.2%}")
        report.append("")

        # Entity accuracy by type
        report.append("ENTITY ACCURACY BY TYPE:")
        report.append("-" * 40)
        for entity_type, accuracy in self.validation_results["entity_accuracy"].items():
            report.append(f"{entity_type:20}: {accuracy:.2%}")
        report.append("")

        # Sentiment accuracy
        report.append("SENTIMENT ANALYSIS ACCURACY:")
        report.append("-" * 40)
        sentiment_acc = self.validation_results["sentiment_accuracy"].get("average", 0)
        report.append(f"Average Sentiment Accuracy: {sentiment_acc:.2%}")
        report.append("")

        # Ticker mapping accuracy
        report.append("TICKER MAPPING ACCURACY:")
        report.append("-" * 40)
        mapping_acc = self.validation_results["ticker_mapping_accuracy"]
        report.append(f"Ticker Mapping Accuracy: {mapping_acc:.2%}")
        report.append("")

        # Failed samples
        failed_samples = [r for r in self.validation_results["detailed_results"] if r["status"] == "FAIL"]
        if failed_samples:
            report.append("FAILED SAMPLES:")
            report.append("-" * 40)
            for failed in failed_samples[:10]:  # Show first 10 failures
                report.append(f"Sample: {failed['sample_id']}")
                report.append(f"  Overall Score: {failed['overall_score']:.2f}")
                report.append(f"  Entity F1: {failed['entity_results']['f1_score']:.2f}")
                report.append(f"  Sentiment Accuracy: {failed['sentiment_results']['sentiment_accuracy']:.2f}")
                report.append("")

        report_text = "\n".join(report)

        if output_file:
            with open(output_file, 'w') as f:
                f.write(report_text)

        return report_text


# Test runner
class TestNERValidation:
    """Test class for NER validation using golden samples."""

    @pytest.fixture
    async def nlp_service(self):
        """Create NLP service for testing."""
        # Mock Redis for testing
        from unittest.mock import AsyncMock
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        mock_redis.setex = AsyncMock()

        from app.services.nlp_pipeline_service import NLPPipelineService
        service = NLPPipelineService(mock_redis)
        return service

    @pytest.mark.asyncio
    async def test_ner_validation_financial_news(self, nlp_service):
        """Test NER validation on financial news samples."""

        validator = NERValidationRunner(nlp_service)

        samples_dir = Path(__file__).parent / "ner_validation"
        results = await validator.run_validation(str(samples_dir))

        # Generate report
        report = validator.generate_report()
        print("\n" + report)

        # Assertions
        assert results["total_samples"] > 0
        assert results["overall_accuracy"] >= 0.7  # At least 70% accuracy

        # Entity type accuracy thresholds
        entity_thresholds = {
            "TICKER": 0.95,
            "COMPANY": 0.85,
            "PERSON": 0.80,
            "MONEY": 0.90
        }

        for entity_type, threshold in entity_thresholds.items():
            if entity_type in results["entity_accuracy"]:
                accuracy = results["entity_accuracy"][entity_type]
                assert accuracy >= threshold, f"{entity_type} accuracy {accuracy:.2%} below threshold {threshold:.2%}"

        # Sentiment accuracy threshold
        sentiment_accuracy = results["sentiment_accuracy"].get("average", 0)
        assert sentiment_accuracy >= 0.75, f"Sentiment accuracy {sentiment_accuracy:.2%} below 75%"

        # Ticker mapping accuracy threshold
        mapping_accuracy = results["ticker_mapping_accuracy"]
        assert mapping_accuracy >= 0.85, f"Ticker mapping accuracy {mapping_accuracy:.2%} below 85%"


if __name__ == "__main__":
    # Run validation directly
    async def main():
        from unittest.mock import AsyncMock

        # Mock Redis
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        mock_redis.setex = AsyncMock()

        # Create NLP service
        from app.services.nlp_pipeline_service import NLPPipelineService
        nlp_service = NLPPipelineService(mock_redis)

        # Run validation
        validator = NERValidationRunner(nlp_service)
        samples_dir = Path(__file__).parent / "ner_validation"
        results = await validator.run_validation(str(samples_dir))

        # Generate and print report
        report = validator.generate_report("ner_validation_report.txt")
        print(report)

        return results

    # Run if executed directly
    asyncio.run(main())