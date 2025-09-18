# StockAnalysis • LSTM Prediction Tests

- **REQ-IDs covered**: REQ-STOCK-02, REQ-STOCK-04
- **Given/When/Then scenarios**:

## UT-STOCK-02.1: LSTM Model Training and Prediction
**Given**: 90 days of preprocessed stock data with technical indicators
**When**: train_lstm_model() is called with proper parameters
**Then**: Model achieves >70% directional accuracy on validation set

```python
def test_lstm_training_accuracy():
    # Arrange
    training_data = MockDataFactory.create_lstm_training_data("AAPL", days=365)
    model_config = {
        'lookback_window': 90,
        'prediction_horizon': 5,
        'epochs': 75,
        'batch_size': 32
    }

    # Act
    model, metrics = lstm_service.train_lstm_model(training_data, model_config)

    # Assert
    assert metrics['directional_accuracy'] > 0.70
    assert metrics['mae'] < 0.05  # Mean Absolute Error threshold
    assert model.get_config()['layers'][0]['units'] == 128  # Architecture validation
```

## UT-STOCK-02.2: Prediction Confidence Intervals
**Given**: Trained LSTM model and recent stock data
**When**: generate_prediction_with_confidence() is called
**Then**: Return prediction with realistic confidence intervals (80%, 95%)

```python
def test_prediction_confidence_intervals():
    # Arrange
    model = MockModelFactory.create_trained_lstm_model("AAPL")
    recent_data = MockDataFactory.create_stock_data("AAPL", days=90)

    # Act
    prediction = lstm_service.generate_prediction_with_confidence(model, recent_data)

    # Assert
    assert 'price_prediction' in prediction
    assert 'confidence_80' in prediction
    assert 'confidence_95' in prediction
    assert prediction['confidence_95']['lower'] < prediction['confidence_80']['lower']
    assert prediction['confidence_80']['upper'] < prediction['confidence_95']['upper']
```

## ET-STOCK-02.1: Model Overfitting Detection
**Given**: LSTM model trained on limited data
**When**: validate_model_performance() checks training vs validation metrics
**Then**: Detect overfitting when validation loss > training loss * 1.5

```python
def test_overfitting_detection():
    # Arrange
    overfitted_model = MockModelFactory.create_overfitted_model("TSLA")
    validation_data = MockDataFactory.create_stock_data("TSLA", days=30)

    # Act
    validation_result = lstm_service.validate_model_performance(overfitted_model, validation_data)

    # Assert
    assert validation_result['is_overfitted'] == True
    assert validation_result['training_loss'] < validation_result['validation_loss']
    assert validation_result['recommendation'] == 'retrain_with_regularization'
```

## PT-STOCK-02.1: Prediction Stability Property
**Given**: Same input data fed to model multiple times
**When**: generate_prediction() is called repeatedly
**Then**: Predictions remain consistent within 2% variance

```python
def test_prediction_stability():
    # Arrange
    model = MockModelFactory.create_deterministic_model("NVDA")
    input_data = MockDataFactory.create_stock_data("NVDA", days=90)
    predictions = []

    # Act
    for _ in range(10):
        prediction = lstm_service.generate_prediction(model, input_data)
        predictions.append(prediction['price_prediction'])

    # Assert
    mean_prediction = np.mean(predictions)
    for pred in predictions:
        variance_pct = abs(pred - mean_prediction) / mean_prediction
        assert variance_pct < 0.02  # Within 2% variance
```

- **Mocks/stubs/fakes**:
  - MockModelFactory for pre-trained LSTM models with known characteristics
  - Stub TensorFlow/Keras for deterministic model behavior
  - Fake GPU availability for CPU-only testing environments

- **Deterministic seeds & time controls**:
  - TensorFlow random seed: 123 for reproducible model training
  - NumPy random seed: 456 for consistent data preprocessing
  - Fixed validation split: 80/20 train/validation consistently

- **Expected coverage deltas**:
  - Lines: +89 lines (LSTM training, prediction, validation methods)
  - Branches: +16 branches (overfitting checks, confidence calculations)
  - Functions: +5 functions (train_model, predict, validate_performance)