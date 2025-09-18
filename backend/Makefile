# TurtleTrading Backend Makefile
.PHONY: help test test-unit test-integration test-api test-services test-coverage test-watch lint format clean install dev

# Default target
help:
	@echo "TurtleTrading Backend Development Commands"
	@echo "========================================="
	@echo ""
	@echo "Testing:"
	@echo "  test              Run all tests"
	@echo "  test-unit         Run unit tests only"
	@echo "  test-integration  Run integration tests only"
	@echo "  test-api          Run API tests only"
	@echo "  test-services     Run service tests only"
	@echo "  test-coverage     Run tests with coverage report"
	@echo "  test-watch        Run tests in watch mode"
	@echo ""
	@echo "Development:"
	@echo "  install           Install dependencies"
	@echo "  dev               Run development server"
	@echo "  lint              Run linting"
	@echo "  format            Format code"
	@echo "  clean             Clean cache and temporary files"
	@echo ""

# Testing commands
test:
	@echo "Running all tests..."
	python -m pytest

test-unit:
	@echo "Running unit tests..."
	python -m pytest tests/unit/ -v

test-integration:
	@echo "Running integration tests..."
	python -m pytest tests/integration/ -v

test-api:
	@echo "Running API tests..."
	python -m pytest tests/api/ -v

test-services:
	@echo "Running service tests..."
	python -m pytest tests/services/ -v

test-coverage:
	@echo "Running tests with coverage..."
	python -m pytest --cov=app --cov-report=html --cov-report=term-missing

test-watch:
	@echo "Running tests in watch mode..."
	python -m pytest --watch

# Development commands
install:
	@echo "Installing dependencies..."
	pip install -r requirements.txt

dev:
	@echo "Starting development server..."
	python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

lint:
	@echo "Running linting..."
	@if command -v ruff > /dev/null; then \
		ruff check app tests; \
	elif command -v flake8 > /dev/null; then \
		flake8 app tests; \
	else \
		echo "No linter found. Install ruff or flake8."; \
	fi

format:
	@echo "Formatting code..."
	@if command -v black > /dev/null; then \
		black app tests; \
	else \
		echo "Black not found. Install black for code formatting."; \
	fi
	@if command -v isort > /dev/null; then \
		isort app tests; \
	else \
		echo "isort not found. Install isort for import sorting."; \
	fi

clean:
	@echo "Cleaning cache and temporary files..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache/ 2>/dev/null || true
	rm -rf htmlcov/ 2>/dev/null || true
	rm -rf .coverage 2>/dev/null || true
	rm -f test.db 2>/dev/null || true
	@echo "Cache and temporary files cleaned."

# Quick test commands with specific markers
test-quick:
	@echo "Running quick tests (excluding slow tests)..."
	python -m pytest -m "not slow" -v

test-slow:
	@echo "Running slow tests..."
	python -m pytest -m "slow" -v

test-external:
	@echo "Running tests that require external services..."
	python -m pytest -m "external" -v

# Database commands
db-init:
	@echo "Initializing database..."
	alembic upgrade head

db-migrate:
	@echo "Creating new migration..."
	@read -p "Enter migration message: " msg; \
	alembic revision --autogenerate -m "$$msg"

db-upgrade:
	@echo "Upgrading database..."
	alembic upgrade head

db-downgrade:
	@echo "Downgrading database..."
	alembic downgrade -1

# Docker commands
docker-build:
	@echo "Building Docker image..."
	docker build -t turtletrading-backend .

docker-run:
	@echo "Running Docker container..."
	docker run -p 8000:8000 turtletrading-backend

# Environment setup
setup-dev:
	@echo "Setting up development environment..."
	python -m venv venv
	@echo "Activate virtual environment with: source venv/bin/activate"
	@echo "Then run: make install"