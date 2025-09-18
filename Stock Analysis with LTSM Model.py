# %%
import yfinance as yf
import pandas as pd
import ta
from datetime import datetime, timedelta
import numpy as np
import warnings
warnings.filterwarnings('ignore')

# Import TensorFlow/Keras for LSTM
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
import matplotlib.pyplot as plt
import great_tables as gt
# Email functionality imports
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import io
import sys
import os
from contextlib import redirect_stdout

from loguru import logger

# Remove the default logger, then add your sinks
logger.remove()
logger.add(sys.stdout, level="INFO", colorize=True, format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | <cyan>{module}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>")
logger.add("stock_analysis.log", rotation="10 MB", retention="5 days", level="DEBUG", compression="zip")

# %%
# Email Configuration
EMAIL_CONFIG = {
    'smtp_server': 'smtp.gmail.com',  # Change as needed (outlook: smtp-mail.outlook.com)
    'smtp_port': 587,
    'sender_email': 'nchakstks@gmail.com',  # Replace with your email
    'sender_password': 'hgyh hzqp rstx afnx',   # Replace with your app password
    'distribution_list': [
        'nchakilam@gmail.com',  # Replace with actual recipients
        'chakdum@gmail.com',
    ]
}

# Weighted Scoring Configuration
DEFAULT_WEIGHTS = {
    "RSI": 0.12,
    "MACD": 0.16,
    "EMA20": 0.12,
    "SMA50": 0.10,
    "SMA200": 0.10,
    "Stoch": 0.10,
    "Bollinger": 0.10,
    "ADX": 0.12,
    "OBV": 0.08,
}

# HTML Output Capture Class
class HTMLCapture:
    def __init__(self):
        self.content = []
        self.original_stdout = sys.stdout
        
    def start_capture(self):
        sys.stdout = self
        
    def stop_capture(self):
        sys.stdout = self.original_stdout
        
    def write(self, text):
        # Write to both HTML content and original stdout
        self.content.append(text)
        self.original_stdout.write(text)
        
    def flush(self):
        self.original_stdout.flush()
        
    def get_html_content(self):
        # Convert captured content to HTML
        full_text = ''.join(self.content)
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Stock Analysis Report - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</title>
            <style>
                body {{
                    font-family: 'Courier New', monospace;
                    line-height: 1.4;
                    margin: 20px;
                    background-color: #f5f5f5;
                }}
                .header {{
                    background-color: #2c3e50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    margin-bottom: 20px;
                    border-radius: 8px;
                }}
                .content {{
                    background-color: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                .analysis-section {{
                    margin: 20px 0;
                    padding: 15px;
                    background-color: #f8f9fa;
                    border-left: 4px solid #007bff;
                }}
                .stock-highlight {{
                    background-color: #e8f4fd;
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 5px;
                }}
                .summary-box {{
                    background-color: #d4edda;
                    border: 1px solid #c3e6cb;
                    padding: 15px;
                    margin: 15px 0;
                    border-radius: 5px;
                }}
                pre {{
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-size: 12px;
                }}
                .emoji {{
                    font-size: 16px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📈 LSTM Stock Analysis Report</h1>
                <p>Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
            </div>
            <div class="content">
                <pre>{full_text}</pre>
            </div>
        </body>
        </html>
        """
        return html_content

def send_email_report(html_content, csv_file_path=None):
    """
    Send HTML report via email with optional CSV attachment
    """
    try:
        # Create message container
        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG['sender_email']
        msg['To'] = ', '.join(EMAIL_CONFIG['distribution_list'])
        msg['Subject'] = f"📊 Stock Analysis Report - {datetime.now().strftime('%Y-%m-%d')}"
        
        # Add HTML body
        msg.attach(MIMEText(html_content, 'html'))
        
        # Add CSV attachment if provided
        if csv_file_path and os.path.exists(csv_file_path):
            with open(csv_file_path, "rb") as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
            
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {os.path.basename(csv_file_path)}'
            )
            msg.attach(part)
        
        # Create secure connection and send email
        context = ssl.create_default_context()
        with smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port']) as server:
            server.starttls(context=context)
            server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
            text = msg.as_string()
            server.sendmail(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['distribution_list'], text)
        
        logger.info(f"\n✅ Email sent successfully to {len(EMAIL_CONFIG['distribution_list'])} recipients!")
        return True
        
    except Exception as e:
        logger.info(f"\n❌ Error sending email: {e}")
        return False

def save_html_report(html_content, filename=None):
    """
    Save HTML content to file
    """
    if filename is None:
        filename = f"stock_analysis_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        logger.info(f"\n📄 HTML report saved as: {filename}")
        return filename
    except Exception as e:
        logger.error(f"\n❌ Error saving HTML report: {e}")
        return None

def calculate_weighted_technical_score(criteria_results, weights=None):
    """
    Calculate weighted technical score based on indicator performance
    
    Args:
        criteria_results: Dictionary of indicator results (True/False)
        weights: Dictionary of weights for each indicator category
        
    Returns:
        Weighted technical score (0-1 scale)
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS
    
    # Map criteria to weight categories
    weight_mapping = {
        'RSI > 50': 'RSI',
        'MACD > Signal': 'MACD', 
        'MACD Crossover Last 3 Days': 'MACD',
        'Price > EMA20 > SMA50': 'EMA20',
        'Golden Cross (SMA50 > SMA200)': 'SMA200',
        'Stoch K > D': 'Stoch',
        'Price > BB Lower': 'Bollinger',
        'Price Above BB Middle': 'Bollinger',
        'Strong Trend (ADX > 25)': 'ADX',
        'Bullish ADX (+DI > -DI)': 'ADX',
        'ADX Rising': 'ADX',
        'Positive Volume Flow (OBV > EMA)': 'OBV',
        'OBV Uptrend': 'OBV'
    }
    
    weighted_score = 0.0
    category_totals = {}
    category_achieved = {}
    
    # Initialize category tracking
    for category in weights.keys():
        category_totals[category] = 0
        category_achieved[category] = 0
    
    # Calculate weighted contributions
    for criterion, result in criteria_results.items():
        if criterion in weight_mapping:
            category = weight_mapping[criterion]
            category_totals[category] += 1
            if result:
                category_achieved[category] += 1
    
    # Calculate final weighted score
    for category, weight in weights.items():
        if category_totals[category] > 0:
            category_score = category_achieved[category] / category_totals[category]
            weighted_score += weight * category_score
            
    return weighted_score

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

tickers = ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA", "JPM", "QQQ", "SPY", "SE", "MRVL", "CRM", "UNH", "NFLX"]
# tickers = ["MRVL", "TSLA", "CRM", "UNH"]
# tickers = ["CRM",]
results = []

# Use today's day-of-year (skip Feb 29)
today = datetime.today()
target_doy = today.timetuple().tm_yday

# LSTM Configuration Parameters
LOOKBACK_DAYS = 90  # Number of days to look back for LSTM input
PREDICTION_DAYS = 5  # Number of days to predict forward
LSTM_UNITS = 50  # Number of LSTM units in each layer
EPOCHS = 75  # Training epochs
BATCH_SIZE = 32  # Batch size for training
VALIDATION_SPLIT = 0.2  # Validation data split

def safe_float_extract(value):
    """Safely extract float value from pandas Series or scalar"""
    if hasattr(value, 'iloc') and len(value) > 0:
        return float(value.iloc[0])
    elif hasattr(value, 'item'):
        return float(value.item())
    else:
        return float(value)

def prepare_lstm_data(df, lookback_days=60):
    """
    Prepare data for LSTM model
    Creates sequences of historical data for training
    
    Args:
        df: DataFrame with stock data
        lookback_days: Number of days to use as input sequence
    
    Returns:
        X: Input sequences (3D array: samples x timesteps x features)
        y: Target values (next day's closing price)
        scaler: Fitted MinMaxScaler for inverse transformation
        feature_names: List of feature names used
    """
    
    # Select features for LSTM (including new indicators)
    features = ['Close', 'Volume', 'High', 'Low', 'Open']
    
    # Add technical indicators as features
    if 'rsi' in df.columns:
        features.append('rsi')
    if 'macd' in df.columns:
        features.append('macd')
    if 'ema_20' in df.columns:
        features.append('ema_20')
    if 'sma_50' in df.columns:
        features.append('sma_50')
    if 'adx' in df.columns:
        features.append('adx')
    if 'obv' in df.columns:
        features.append('obv')
    
    # Filter available features
    available_features = [f for f in features if f in df.columns]
    feature_data = df[available_features].values
    
    # Scale the features to [0, 1] range for better LSTM performance
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(feature_data)
    
    X, y = [], []
    
    # Create sequences for LSTM
    for i in range(lookback_days, len(scaled_data) - 1):
        # Input: lookback_days of historical data
        X.append(scaled_data[i-lookback_days:i])
        # Output: next day's closing price (index 0 is Close price)
        y.append(scaled_data[i, 0])
    
    X, y = np.array(X), np.array(y)
    
    return X, y, scaler, available_features

def build_lstm_model(input_shape, units=50):
    """
    Build and compile LSTM model
    
    Args:
        input_shape: Shape of input data (timesteps, features)
        units: Number of LSTM units
    
    Returns:
        Compiled Keras model
    """
    
    model = Sequential()
    
    # First LSTM layer with return sequences for stacking
    model.add(LSTM(units=units, 
                   return_sequences=True, 
                   input_shape=input_shape))
    model.add(Dropout(0.2))  # Dropout for regularization
    
    # Second LSTM layer
    model.add(LSTM(units=units, 
                   return_sequences=False))
    model.add(Dropout(0.2))
    
    # Dense layers for output
    model.add(Dense(units=25))
    model.add(Dense(units=1))  # Single output for price prediction
    
    # Compile model with Adam optimizer
    model.compile(optimizer='adam', 
                  loss='mean_squared_error',
                  metrics=['mae'])  # Mean Absolute Error as additional metric
    
    return model

def train_lstm_model(model, X_train, y_train, epochs=50, batch_size=32, validation_split=0.2):
    """
    Train the LSTM model
    
    Args:
        model: Compiled Keras model
        X_train: Training input sequences
        y_train: Training target values
        epochs: Number of training epochs
        batch_size: Batch size for training
        validation_split: Fraction of data to use for validation
    
    Returns:
        Training history object
    """
    
    # Early stopping to prevent overfitting
    early_stop = EarlyStopping(monitor='val_loss', 
                              patience=10, 
                              restore_best_weights=True)
    
    # Train the model
    history = model.fit(X_train, y_train,
                       epochs=epochs,
                       batch_size=batch_size,
                       validation_split=validation_split,
                       callbacks=[early_stop],
                       verbose=0)  # Set to 1 to see training progress
    
    return history

def predict_future_prices(model, last_sequence, scaler, days_ahead=5):
    """
    Predict future prices using trained LSTM model
    
    Args:
        model: Trained Keras model
        last_sequence: Last sequence of historical data
        scaler: MinMaxScaler used for data transformation
        days_ahead: Number of days to predict
    
    Returns:
        Array of predicted prices
    """
    
    predictions = []
    current_sequence = last_sequence.copy()
    
    for _ in range(days_ahead):
        # Predict next price
        pred = model.predict(current_sequence.reshape(1, *current_sequence.shape), verbose=0)
        predictions.append(pred[0, 0])
        
        # Update sequence for next prediction
        # Shift sequence and add new prediction
        new_row = current_sequence[-1].copy()
        new_row[0] = pred[0, 0]  # Update close price with prediction
        current_sequence = np.vstack([current_sequence[1:], new_row])
    
    # Inverse transform predictions to get actual prices
    # Create dummy array with same shape as original features
    dummy_array = np.zeros((len(predictions), scaler.n_features_in_))
    dummy_array[:, 0] = predictions  # Put predictions in Close price column
    
    # Inverse transform and extract Close prices
    actual_predictions = scaler.inverse_transform(dummy_array)[:, 0]
    
    return actual_predictions

def analyze_stock_with_lstm(ticker, weights=None):
    """
    Enhanced stock analysis with LSTM predictions and weighted technical scoring
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS
        
    try:
        logger.info(f"Analyzing {ticker} with LSTM and weighted scoring...")
        
        # Download more historical data for LSTM training
        df = yf.download(ticker, period="3y", interval="1d", progress=False)
        
        if df.empty or len(df) < LOOKBACK_DAYS + 50:
            logger.error(f"  Insufficient data for {ticker}")
            return None

        # Handle multi-level columns if present
        if df.columns.nlevels > 1:
            df.columns = df.columns.droplevel(1)

        df.dropna(inplace=True)
        
        if len(df) < LOOKBACK_DAYS + 50:
            return None
            
        close = df['Close'].squeeze()
        high = df['High'].squeeze()
        low = df['Low'].squeeze()
        volume = df['Volume'].squeeze()

        # Calculate technical indicators
        df['rsi'] = ta.momentum.RSIIndicator(close=close).rsi()
        
        # MACD
        macd_indicator = ta.trend.MACD(close)
        df['macd'] = macd_indicator.macd()
        df['macd_signal'] = macd_indicator.macd_signal()
        
        # Bollinger Bands
        bb_indicator = ta.volatility.BollingerBands(close=close)
        df['bb_upper'] = bb_indicator.bollinger_hband()
        df['bb_lower'] = bb_indicator.bollinger_lband()
        df['bb_middle'] = bb_indicator.bollinger_mavg()
        
        # On-Balance Volume (OBV)
        obv_indicator = ta.volume.OnBalanceVolumeIndicator(close=close, volume=volume)
        df['obv'] = obv_indicator.on_balance_volume()
        
        # Calculate OBV trend (20-day EMA of OBV for trend detection)
        df['obv_ema'] = df['obv'].ewm(span=20, adjust=False).mean()
        
        # Average Directional Index (ADX) - measures trend strength
        adx_indicator = ta.trend.ADXIndicator(high=high, low=low, close=close, window=14)
        df['adx'] = adx_indicator.adx()
        df['adx_pos'] = adx_indicator.adx_pos()  # +DI
        df['adx_neg'] = adx_indicator.adx_neg()  # -DI
        
        # Stochastic Oscillator
        stoch_indicator = ta.momentum.StochasticOscillator(high=high, low=low, close=close)
        df['stoch_k'] = stoch_indicator.stoch()
        df['stoch_d'] = stoch_indicator.stoch_signal()
        
        # Moving Averages
        df['ema_20'] = ta.trend.EMAIndicator(close=close, window=20).ema_indicator()
        df['sma_50'] = ta.trend.SMAIndicator(close=close, window=50).sma_indicator()
        df['sma_200'] = ta.trend.SMAIndicator(close=close, window=200).sma_indicator()

        # Drop NaN values after adding indicators
        df.dropna(inplace=True)
        
        if len(df) < LOOKBACK_DAYS + 50:
            return None

        # Prepare LSTM data
        logger.info(f"  Preparing LSTM data for {ticker}...")
        X, y, scaler, feature_names = prepare_lstm_data(df, LOOKBACK_DAYS)
        
        if len(X) < 100:  # Need enough samples for training
            logger.error(f"  Insufficient samples for {ticker}")
            return None
        
        # Split data for training (use last 20% for testing)
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Build and train LSTM model
        logger.info(f"  Training LSTM model for {ticker}...")
        model = build_lstm_model(input_shape=(X.shape[1], X.shape[2]), units=LSTM_UNITS)
        history = train_lstm_model(model, X_train, y_train, 
                                  epochs=EPOCHS, 
                                  batch_size=BATCH_SIZE,
                                  validation_split=VALIDATION_SPLIT)
        
        # Evaluate model on test data
        test_predictions = model.predict(X_test, verbose=0)
        
        # Calculate metrics (inverse transform for actual prices)
        dummy_test = np.zeros((len(test_predictions), scaler.n_features_in_))
        dummy_test[:, 0] = test_predictions.flatten()
        test_pred_actual = scaler.inverse_transform(dummy_test)[:, 0]
        
        dummy_true = np.zeros((len(y_test), scaler.n_features_in_))
        dummy_true[:, 0] = y_test
        test_true_actual = scaler.inverse_transform(dummy_true)[:, 0]
        
        mse = mean_squared_error(test_true_actual, test_pred_actual)
        mae = mean_absolute_error(test_true_actual, test_pred_actual)
        accuracy_pct = (1 - mae / test_true_actual.mean()) * 100
        
        # Predict future prices
        logger.info(f"  Generating predictions for {ticker}...")
        last_sequence = X[-1]
        future_predictions = predict_future_prices(model, last_sequence, scaler, PREDICTION_DAYS)
        
        # Get current technical analysis scores with enhanced indicators
        latest = df.iloc[-1]
        criteria = {}

        # Extract values safely
        price = safe_float_extract(close.iloc[-1])
        rsi_val = safe_float_extract(latest['rsi'])
        macd_val = safe_float_extract(latest['macd'])
        macd_signal_val = safe_float_extract(latest['macd_signal'])
        ema_20_val = safe_float_extract(latest['ema_20'])
        sma_50_val = safe_float_extract(latest['sma_50'])
        sma_200_val = safe_float_extract(latest['sma_200']) if 'sma_200' in latest else 0
        stoch_k_val = safe_float_extract(latest['stoch_k'])
        stoch_d_val = safe_float_extract(latest['stoch_d'])
        bb_lower_val = safe_float_extract(latest['bb_lower'])
        bb_upper_val = safe_float_extract(latest['bb_upper'])
        bb_middle_val = safe_float_extract(latest['bb_middle'])
        
        # ADX values
        adx_val = safe_float_extract(latest['adx'])
        adx_pos_val = safe_float_extract(latest['adx_pos'])
        adx_neg_val = safe_float_extract(latest['adx_neg'])
        
        # OBV values
        obv_val = safe_float_extract(latest['obv'])
        obv_ema_val = safe_float_extract(latest['obv_ema'])

        # Enhanced technical scoring with new indicators
        
        # Original criteria
        criteria['RSI > 50'] = rsi_val > 50
        criteria['MACD > Signal'] = macd_val > macd_signal_val
        
        # MACD crossover check
        criteria['MACD Crossover Last 3 Days'] = False
        try:
            for i in range(1, min(4, len(df))):
                if (i + 1) < len(df):
                    macd_current = safe_float_extract(df['macd'].iloc[-i])
                    macd_signal_current = safe_float_extract(df['macd_signal'].iloc[-i])
                    macd_prev = safe_float_extract(df['macd'].iloc[-i - 1])
                    macd_signal_prev = safe_float_extract(df['macd_signal'].iloc[-i - 1])
                    
                    if macd_current > macd_signal_current and macd_prev <= macd_signal_prev:
                        criteria['MACD Crossover Last 3 Days'] = True
                        break
        except (IndexError, ValueError):
            criteria['MACD Crossover Last 3 Days'] = False
        
        criteria['Price > EMA20 > SMA50'] = price > ema_20_val > sma_50_val
        criteria['Stoch K > D'] = stoch_k_val > stoch_d_val
        criteria['Price > BB Lower'] = price > bb_lower_val
        
        # NEW ADX criteria
        # ADX > 25 indicates strong trend
        criteria['Strong Trend (ADX > 25)'] = adx_val > 25
        # +DI > -DI indicates bullish trend
        criteria['Bullish ADX (+DI > -DI)'] = adx_pos_val > adx_neg_val
        # ADX rising indicates strengthening trend
        if len(df) >= 5:
            adx_5days_ago = safe_float_extract(df['adx'].iloc[-5])
            criteria['ADX Rising'] = adx_val > adx_5days_ago
        else:
            criteria['ADX Rising'] = False
        
        # NEW OBV criteria
        # OBV above its EMA indicates positive volume flow
        criteria['Positive Volume Flow (OBV > EMA)'] = obv_val > obv_ema_val
        # OBV trend - check if OBV is making higher highs
        if len(df) >= 20:
            obv_20days_ago = safe_float_extract(df['obv'].iloc[-20])
            criteria['OBV Uptrend'] = obv_val > obv_20days_ago
        else:
            criteria['OBV Uptrend'] = False
        
        # Additional Bollinger Band criteria
        criteria['Price Above BB Middle'] = price > bb_middle_val
        
        # Golden Cross check (50 SMA > 200 SMA)
        if sma_200_val > 0:
            criteria['Golden Cross (SMA50 > SMA200)'] = sma_50_val > sma_200_val
        else:
            criteria['Golden Cross (SMA50 > SMA200)'] = False
        
        # Calculate weighted technical score (0-1 scale)
        weighted_technical_score = calculate_weighted_technical_score(criteria, weights)
        
        # LSTM-based scoring (normalized to 0-1 scale)
        predicted_return = (future_predictions[-1] - price) / price * 100
        
        # Normalize LSTM signal to 0-1 scale
        lstm_signal = 0.0
        if predicted_return > 5:
            lstm_signal = 1.0
        elif predicted_return > 2:
            lstm_signal = 0.75
        elif predicted_return > 0:
            lstm_signal = 0.5
        elif predicted_return > -2:
            lstm_signal = 0.25
        else:
            lstm_signal = 0.0
        
        # Check if predictions show upward trend (bonus)
        if all(future_predictions[i] <= future_predictions[i+1] 
               for i in range(len(future_predictions)-1)):
            lstm_signal = min(1.0, lstm_signal + 0.1)
        
        # Daily seasonality
        seasonality_score, avg_ret = get_daily_seasonality_score(ticker, target_doy)
        
        # Combined score using the specified weighting: 50% LSTM + 50% Technical
        final_score = 0.5 * lstm_signal + 0.5 * weighted_technical_score
        
        # Add seasonality boost (small addition)
        final_score += (seasonality_score * 0.1)  # 10% weight for seasonality
        
        # Risk/Reward with LSTM prediction
        lstm_target = future_predictions.max()
        stop_loss = min(ema_20_val, future_predictions.min() * 0.98)
        risk = price - stop_loss
        reward = lstm_target - price
        lstm_rr_ratio = round(reward / risk, 2) if risk > 0 else None

        return {
            "Ticker": ticker,
            "Close": round(price, 2),
            "Weighted Technical Score": round(weighted_technical_score, 3),
            "LSTM Signal": round(lstm_signal, 3),
            "Final Score": round(final_score, 3),
            "Seasonality Boost": seasonality_score,
            "ADX": round(adx_val, 2),
            "+DI": round(adx_pos_val, 2),
            "-DI": round(adx_neg_val, 2),
            "OBV Trend": "Positive" if obv_val > obv_ema_val else "Negative",
            "5-Day Prediction": round(future_predictions[-1], 2),
            "Predicted Return %": round(predicted_return, 2),
            "LSTM Accuracy %": round(accuracy_pct, 2),
            "LSTM Target": round(lstm_target, 2),
            "Stop Loss": round(stop_loss, 2),
            "Risk/Reward Ratio": lstm_rr_ratio,
            "1-Day Pred": round(future_predictions[0], 2) if len(future_predictions) > 0 else None,
            "3-Day Pred": round(future_predictions[2], 2) if len(future_predictions) > 2 else None,
            **criteria
        }
        
    except Exception as e:
        logger.error(f"Error in analyze_stock_with_lstm for {ticker}: {e}")
        return None

def get_daily_seasonality_score(ticker, day_of_year):
    """Get daily seasonality score (unchanged from original)"""
    try:
        logger.info(f"  Getting seasonality data for {ticker}...")
        df = yf.download(ticker, period="10y", interval="1d", progress=False)
        
        if df.empty:
            return 0, 0
            
        # Handle multi-level columns if present
        if df.columns.nlevels > 1:
            df.columns = df.columns.droplevel(1)
            
        df = df[['Close']].dropna()
        
        # Remove Feb 29 to normalize years
        df = df[~((df.index.month == 2) & (df.index.day == 29))]

        if len(df) < 100:  # Need sufficient data
            return 0, 0

        df['doy'] = df.index.dayofyear
        df['Return'] = df['Close'].pct_change()
        df.dropna(inplace=True)
        
        if df.empty:
            return 0, 0
            
        day_returns = df.groupby('doy')['Return'].mean()

        if day_returns.empty:
            return 0, 0

        # Normalize scores from 0 to 1
        max_ret = day_returns.max()
        min_ret = day_returns.min()
        
        if pd.isna(max_ret) or pd.isna(min_ret) or (max_ret - min_ret) == 0:
            return 0, 0
            
        normalized = (day_returns - min_ret) / (max_ret - min_ret + 1e-9)

        seasonality_score = normalized.get(day_of_year, 0)
        avg_return = day_returns.get(day_of_year, 0)
        
        return round(float(seasonality_score), 2), round(float(avg_return) * 100, 3)
        
    except Exception as e:
        logger.error(f"  Error getting seasonality for {ticker}: {e}")
        return 0, 0

# %%
# Initialize HTML capture
html_capture = HTMLCapture()
html_capture.start_capture()

print("\n🎯 WEIGHTED TECHNICAL ANALYSIS SYSTEM")
print("="*60)
print("Weight Distribution:")
for indicator, weight in DEFAULT_WEIGHTS.items():
    print(f"  • {indicator}: {weight:.1%}")
print(f"Final Score Formula: 50% LSTM Signal + 50% Weighted Technical Score")
print("="*60)

# Run enhanced analysis with LSTM
print(f"\nStarting LSTM-enhanced analysis with weighted scoring for {len(tickers)} stocks...")
print(f"Target day of year: {target_doy} ({today.strftime('%B %d')})")
print(f"LSTM Configuration: {LOOKBACK_DAYS} days lookback, {PREDICTION_DAYS} days prediction")
print(f"Enhanced with weighted ADX & OBV analysis\n")

for ticker in tickers:
    result = analyze_stock_with_lstm(ticker)
    if result:
        results.append(result)
    logger.info(f"Completed {ticker}\n")

# %%
csv_filename = None
if results:
    # Prepare and export results
    df = pd.DataFrame(results)
    
    # Sort by Final Score first, then by Risk/Reward Ratio
    df['RR_Sort'] = df['Risk/Reward Ratio'].fillna(-999)
    df = df.sort_values(by=["Final Score", "RR_Sort"], ascending=[False, False])
    df = df.drop('RR_Sort', axis=1)
    
    # Export to CSV
    csv_filename = "weighted_stocks_lstm_predictions.csv"
    df.to_csv(csv_filename, index=False)
    
    # # Create HTML table from DataFrame
    # html_table = df.to_html(index=False, classes='table table-striped', border=0, justify='center')
    # print("\n🔗 HTML Table Preview:\n")
    # print(html_table)
    
    # Display results
    print("\n🎯 WEIGHTED LSTM-Enhanced Analysis:\n")
    print("="*120)
    
    # Main display columns with weighted scores
    display_df = df[[
        "Ticker", "Close", "1-Day Pred", "3-Day Pred", "5-Day Prediction", "Weighted Technical Score", "LSTM Signal", "Seasonality Boost", "Final Score", 
         "ADX", "OBV Trend",  "Predicted Return %", "LSTM Accuracy %", "Risk/Reward Ratio"
    ]].copy()
    
    pd.set_option('display.float_format', '{:.3f}'.format)
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    # %%
    my_table = (gt.GT(display_df).tab_header(
                    title="Stock Analysis Results",
                    subtitle="Model predictions and technical scores"
                ).tab_source_note(
                    source_note="Generated by Stock-Analysis-with-LSTM-Model"
                ))
    my_table = my_table.fmt_currency(columns=["Close", "5-Day Prediction", "1-Day Pred", "3-Day Pred"])
    my_table
    # %%
    # print(display_df.to_string(index=False))
    
    print("\n" + "="*120)
    
    # Display detailed scoring breakdown for top 5
    print("\n🏆 TOP 5 DETAILED SCORING BREAKDOWN:")
    print("-" * 80)
    for i in range(min(5, len(df))):
        stock = df.iloc[i]
        print(f"\n{i+1}. {stock['Ticker']} - Final Score: {stock['Final Score']:.3f}")
        print(f"   Weighted Technical: {stock['Weighted Technical Score']:.3f} (50% weight)")
        print(f"   LSTM Signal: {stock['LSTM Signal']:.3f} (50% weight)")
        print(f"   Seasonality Boost: {stock['Seasonality Boost']:.3f} (10% weight)")
        print(f"   Predicted Return: {stock['Predicted Return %']:.2f}%")
        print(f"   ADX: {stock['ADX']:.1f}, OBV: {stock['OBV Trend']}")
    
    # Display ADX Analysis
    print(f"\n📊 ADX Analysis (Trend Strength):")
    adx_df = df[["Ticker", "ADX", "+DI", "-DI", "Strong Trend (ADX > 25)", 
                 "Bullish ADX (+DI > -DI)", "ADX Rising"]].head(10)
    print(adx_df.to_string(index=False))
    
    # Display OBV Analysis
    print(f"\n📈 OBV Analysis (Volume Flow):")
    obv_df = df[["Ticker", "OBV Trend", "Positive Volume Flow (OBV > EMA)", 
                 "OBV Uptrend"]].head(10)
    print(obv_df.to_string(index=False))
    
    print("\n" + "="*120)
    print(f"\n📁 Full results exported to: {csv_filename}")
    print(f"📊 Successfully analyzed {len(df)} stocks with Weighted LSTM Scoring")
    
    # Summary statistics
    print(f"\n📈 Summary Statistics:")
    print(f"  • Average Weighted Technical Score: {df['Weighted Technical Score'].mean():.3f}")
    print(f"  • Average LSTM Signal: {df['LSTM Signal'].mean():.3f}")
    print(f"  • Average Final Score: {df['Final Score'].mean():.3f}")
    print(f"  • Average Seasonality Boost: {df['Seasonality Boost'].mean():.2f}")
    print(f"  • Average LSTM Accuracy: {df['LSTM Accuracy %'].mean():.1f}%")
    print(f"  • Average Predicted 5-Day Return: {df['Predicted Return %'].mean():.2f}%")
    print(f"  • Average ADX (Trend Strength): {df['ADX'].mean():.1f}")
    print(f"  • Stocks with Strong Trends (ADX>25): {df['Strong Trend (ADX > 25)'].sum()}/{len(df)}")
    print(f"  • Stocks with Positive Volume Flow: {(df['OBV Trend'] == 'Positive').sum()}/{len(df)}")
    
    # Top picks
    print(f"\n🏆 Top 3 Picks by Final Score:")
    for i in range(min(3, len(df))):
        stock = df.iloc[i]
        print(f"  {i+1}. {stock['Ticker']}: Score {stock['Final Score']:.3f} "
              f"(Tech: {stock['Weighted Technical Score']:.3f}, LSTM: {stock['LSTM Signal']:.3f}), "
              f"ADX {stock['ADX']:.1f}, {stock['OBV Trend']} Volume, "
              f"Predicted +{stock['Predicted Return %']:.2f}% "
              f"(Accuracy: {stock['LSTM Accuracy %']:.1f}%)")
    
    # Best weighted technical scores
    print(f"\n⚖️ Top 3 by Weighted Technical Score:")
    df_by_tech = df.sort_values('Weighted Technical Score', ascending=False)
    for i in range(min(3, len(df_by_tech))):
        stock = df_by_tech.iloc[i]
        print(f"  {i+1}. {stock['Ticker']}: {stock['Weighted Technical Score']:.3f} "
              f"(ADX: {stock['ADX']:.1f}, OBV: {stock['OBV Trend']})")
    
    # Best LSTM signals
    print(f"\n🤖 Top 3 by LSTM Signal:")
    df_by_lstm = df.sort_values('LSTM Signal', ascending=False)
    for i in range(min(3, len(df_by_lstm))):
        stock = df_by_lstm.iloc[i]
        print(f"  {i+1}. {stock['Ticker']}: {stock['LSTM Signal']:.3f} "
              f"(Predicted: +{stock['Predicted Return %']:.2f}%)")
    
    # Best predicted returns
    print(f"\n💰 Top 3 by Predicted Returns:")
    df_by_returns = df.sort_values('Predicted Return %', ascending=False)
    for i in range(min(3, len(df_by_returns))):
        stock = df_by_returns.iloc[i]
        print(f"  {i+1}. {stock['Ticker']}: +{stock['Predicted Return %']:.2f}% "
              f"(Current: ${stock['Close']:.2f}, Target: ${stock['5-Day Prediction']:.2f})")
    
    # Create visualization of predictions for top stock
    top_ticker = df.iloc[0]['Ticker']
    print(f"\n📊 Generating prediction chart for top pick: {top_ticker}")
    
    # Create enhanced visualization with weighted scoring info
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))
    
    # Price predictions plot
    days = ['Current', 'Day 1', 'Day 3', 'Day 5']
    prices = [
        df.iloc[0]['Close'],
        df.iloc[0]['1-Day Pred'],
        df.iloc[0]['3-Day Pred'],
        df.iloc[0]['5-Day Prediction']
    ]
    
    ax1.plot(days, prices, marker='o', linewidth=2, markersize=8, color='blue')
    ax1.set_title(f'{top_ticker} - LSTM Price Predictions', fontsize=14, fontweight='bold')
    ax1.set_xlabel('Time Period')
    ax1.set_ylabel('Price ($)')
    ax1.grid(True, alpha=0.3)
    
    # Add value labels on points
    for i, (day, price) in enumerate(zip(days, prices)):
        if price is not None:
            ax1.annotate(f'${price:.2f}', 
                       xy=(i, price), 
                       xytext=(0, 10),
                       textcoords='offset points',
                       ha='center')
    
    # Weighted scoring summary
    scoring_text = f"Final Score: {df.iloc[0]['Final Score']:.3f}\n"
    scoring_text += f"Weighted Technical: {df.iloc[0]['Weighted Technical Score']:.3f} (50%)\n"
    scoring_text += f"LSTM Signal: {df.iloc[0]['LSTM Signal']:.3f} (50%)\n"
    scoring_text += f"ADX: {df.iloc[0]['ADX']:.1f} | OBV: {df.iloc[0]['OBV Trend']}"
    
    ax2.text(0.5, 0.5, scoring_text, transform=ax2.transAxes, 
             fontsize=11, ha='center', va='center',
             bbox=dict(boxstyle='round,pad=1', facecolor='lightgreen', alpha=0.8))
    ax2.set_xlim(0, 1)
    ax2.set_ylim(0, 1)
    ax2.axis('off')
    ax2.set_title('Weighted Scoring Summary', fontsize=14, fontweight='bold')
    
    plt.tight_layout()
    
    # Save chart
    chart_filename = f"{top_ticker}_weighted_lstm_chart.png"
    plt.savefig(chart_filename, dpi=150, bbox_inches='tight')
    print(f"📈 Chart saved as: {chart_filename}")
    plt.close()
    
    print("\n" + "="*120)
    print("🎯 Weighted Analysis Complete!")
    
else:
    print("\n❌ No results to display")

# Stop HTML capture
html_capture.stop_capture()

# Generate HTML report
html_content = html_capture.get_html_content()

# Save HTML report
html_filename = save_html_report(html_content)

# Send email report
logger.info(f"\n📧 Sending email report...")
if html_filename and csv_filename:
    email_success = send_email_report(html_content, csv_filename)
    if email_success:
        logger.info("✅ Email report sent successfully!")
        logger.info(f"📎 Attachments: {csv_filename}")
        logger.info(f"📄 HTML report also saved locally as: {html_filename}")
    else:
        print("❌ Failed to send email, but HTML report saved locally")
        print(f"📄 You can manually send: {html_filename}")
else:
    print("❌ Could not generate complete report for emailing")

logger.info(f"\n✨ Weighted Report Generation Complete! ✨")
# %%