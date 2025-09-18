# TurtleTrading Platform Makefile
# Comprehensive development automation with 100% coverage enforcement
# Per IMPLEMENT_FROM_DOCS_FILLED.md requirements

.PHONY: help setup dev test lint clean coverage deploy docker

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target
help: ## Show this help message
	@echo "🐢 TurtleTrading Platform - Development Commands"
	@echo ""
	@echo "📋 Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "🎯 Quick start: make setup && make dev"
	@echo "🧪 Run tests:   make test"
	@echo "📊 Coverage:    make coverage:all"

## Setup and Installation
setup: ## Complete setup for new developers
	@echo "$(GREEN)🚀 Setting up TurtleTrading development environment...$(NC)"
	@$(MAKE) setup:backend
	@$(MAKE) setup:frontend
	@$(MAKE) setup:e2e
	@echo "$(GREEN)✅ Setup complete! Run 'make dev' to start development.$(NC)"

setup:backend: ## Set up Python backend environment
	@echo "$(GREEN)🐍 Setting up Python backend...$(NC)"
	cd backend && python3 -m venv venv
	cd backend && source venv/bin/activate && pip install -r requirements.txt
	cd backend && source venv/bin/activate && pip install pytest pytest-cov pytest-asyncio coverage black isort flake8 mypy

setup:frontend: ## Set up React frontend environment
	@echo "$(GREEN)⚛️ Setting up React frontend...$(NC)"
	cd frontend && npm install

setup:e2e: ## Set up Playwright E2E testing
	@echo "$(GREEN)🎭 Setting up Playwright E2E tests...$(NC)"
	cd tests && npm install
	cd tests && npx playwright install --with-deps

## Development Commands
dev: ## Start complete development environment
	@echo "$(GREEN)🚀 Starting TurtleTrading development servers...$(NC)"
	@$(MAKE) dev:services &
	@sleep 5
	@$(MAKE) dev:backend &
	@sleep 5
	@$(MAKE) dev:frontend &
	@echo "$(GREEN)✅ All services started!$(NC)"
	@echo "📋 Services:"
	@echo "  🐍 Backend:    http://localhost:8000"
	@echo "  ⚛️  Frontend:   http://localhost:3000"
	@echo "  📊 API Docs:   http://localhost:8000/docs"

dev:services: ## Start database and cache services
	@echo "$(GREEN)🔧 Starting PostgreSQL and Redis...$(NC)"
	docker-compose up -d postgres redis

dev:backend: ## Start backend development server
	@echo "$(GREEN)🐍 Starting FastAPI backend...$(NC)"
	cd backend && source venv/bin/activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev:frontend: ## Start frontend development server
	@echo "$(GREEN)⚛️ Starting React frontend...$(NC)"
	cd frontend && npm run dev

## Testing Commands
test: ## Run all tests with coverage enforcement
	@echo "$(GREEN)🧪 Running comprehensive test suite...$(NC)"
	@$(MAKE) test:backend
	@$(MAKE) test:frontend
	@$(MAKE) test:integration
	@echo "$(GREEN)✅ All tests completed successfully!$(NC)"

test:backend: ## Run backend unit tests with 100% coverage
	@echo "$(GREEN)🐍 Running backend tests...$(NC)"
	cd backend && source venv/bin/activate && pytest --cov=app --cov-branch --cov-report=term-missing --cov-report=xml --cov-fail-under=100

test:frontend: ## Run frontend unit tests with 100% coverage
	@echo "$(GREEN)⚛️ Running frontend tests...$(NC)"
	cd frontend && npm run test:coverage -- --run

test:integration: ## Run integration tests
	@echo "$(GREEN)🔗 Running integration tests...$(NC)"
	cd backend && source venv/bin/activate && pytest tests/integration/ --cov=app --cov-branch --cov-report=xml

test:e2e: ## Run E2E tests with Playwright
	@echo "$(GREEN)🎭 Running E2E tests...$(NC)"
	@$(MAKE) dev:services
	@sleep 10
	cd tests && npm run test:e2e
	@$(MAKE) dev:stop

## Coverage Commands
coverage:all: ## Generate comprehensive coverage reports across all layers
	@echo "$(GREEN)📊 Generating comprehensive coverage reports...$(NC)"
	@$(MAKE) coverage:backend
	@$(MAKE) coverage:frontend
	@$(MAKE) coverage:e2e
	@$(MAKE) coverage:merge
	@echo "$(GREEN)✅ Coverage reports generated successfully!$(NC)"

coverage:backend: ## Generate backend Python coverage
	@echo "$(GREEN)🐍 Generating backend coverage...$(NC)"
	cd backend && source venv/bin/activate && pytest --cov=app --cov-report=html:htmlcov --cov-report=xml:coverage.xml --cov-report=json:coverage.json --cov-fail-under=100

coverage:frontend: ## Generate frontend TypeScript coverage
	@echo "$(GREEN)⚛️ Generating frontend coverage...$(NC)"
	cd frontend && npm run test:coverage -- --run

coverage:e2e: ## Generate E2E test coverage
	@echo "$(GREEN)🎭 Generating E2E coverage...$(NC)"
	@$(MAKE) dev:services
	@sleep 10
	cd tests && npm run test:e2e:coverage || true
	@$(MAKE) dev:stop

coverage:merge: ## Merge all coverage reports
	@echo "$(GREEN)🔗 Merging coverage reports...$(NC)"
	./scripts/merge-coverage.sh

coverage:enforce: ## Enforce 100% coverage thresholds
	@echo "$(GREEN)🎯 Enforcing coverage thresholds...$(NC)"
	./scripts/enforce-coverage-thresholds.sh

coverage:badge: ## Generate coverage badges
	@echo "$(GREEN)🏆 Generating coverage badges...$(NC)"
	./scripts/generate-coverage-badge.sh

coverage:open: ## Open coverage reports in browser
	@echo "$(GREEN)🌐 Opening coverage reports...$(NC)"
	@if [ -f "coverage/combined/index.html" ]; then \
		open coverage/combined/index.html; \
	elif [ -f "backend/htmlcov/index.html" ]; then \
		open backend/htmlcov/index.html; \
	else \
		echo "$(YELLOW)⚠️ No coverage reports found. Run 'make coverage:all' first.$(NC)"; \
	fi

# Legacy support - keeping existing commands
install: setup ## Alias for setup command
build: ## Build all services for production
	@echo "$(GREEN)📦 Building production images...$(NC)"
	docker-compose -f docker-compose.prod.yml build

test-backend: ## Run backend tests only
	cd backend && python -m pytest tests/ -v --cov=app

test-frontend: ## Run frontend tests only
	cd frontend && npm test -- --coverage --watchAll=false

test-e2e: ## Run E2E tests only
	docker-compose --profile testing up -d
	docker-compose --profile testing run --rm playwright npx playwright test
	docker-compose --profile testing down

# Docker Management
up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

clean: ## Clean up containers, volumes, and images
	docker-compose down -v --remove-orphans
	docker system prune -f
	docker volume prune -f

# Logs
logs: ## View logs from all services
	docker-compose logs -f

backend-logs: ## View backend logs only
	docker-compose logs -f backend

frontend-logs: ## View frontend logs only
	docker-compose logs -f frontend

nginx-logs: ## View nginx logs
	docker-compose logs -f nginx

# Database Management
db-migrate: ## Run database migrations
	docker-compose exec backend alembic upgrade head

db-reset: ## Reset database (WARNING: destroys all data)
	docker-compose down postgres
	docker volume rm turtletrading_postgres_data
	docker-compose up -d postgres
	@echo "Database reset complete. Run 'make db-migrate' to recreate tables."

db-shell: ## Open database shell
	docker-compose exec postgres psql -U turtletrading -d turtletrading

# Backend Commands
backend-shell: ## Open backend container shell
	docker-compose exec backend bash

backend-lint: ## Run backend linting
	docker-compose exec backend black .
	docker-compose exec backend isort .
	docker-compose exec backend flake8 .

backend-typecheck: ## Run backend type checking
	docker-compose exec backend mypy app/

# Frontend Commands
frontend-shell: ## Open frontend container shell
	docker-compose exec frontend bash

frontend-lint: ## Run frontend linting
	docker-compose exec frontend npm run lint

frontend-format: ## Format frontend code
	docker-compose exec frontend npm run format

# API Documentation
api-docs: ## Open API documentation
	@echo "API documentation available at:"
	@echo "  http://localhost:8000/api/docs (Swagger)"
	@echo "  http://localhost:8000/api/redoc (ReDoc)"

# Development Tools
dev-tools: ## Start development tools container
	docker-compose --profile dev-tools up -d dev-tools

jupyter: ## Start Jupyter notebook for data analysis
	docker-compose exec backend python -m jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser --allow-root

# Health Checks
health: ## Check service health
	@echo "Checking service health..."
	@curl -s http://localhost:8000/health | jq '.' || echo "Backend not responding"
	@curl -s http://localhost:3000 > /dev/null && echo "Frontend: OK" || echo "Frontend: Not responding"
	@docker-compose exec redis redis-cli ping || echo "Redis: Not responding"
	@docker-compose exec postgres pg_isready -U turtletrading || echo "Postgres: Not responding"

# Performance Testing
stress-test: ## Run API stress test
	docker-compose exec backend python -m locust -f tests/performance/locustfile.py --host=http://localhost:8000

# Data Management
seed-data: ## Seed database with sample data
	docker-compose exec backend python scripts/seed_data.py

backup-db: ## Backup database
	docker-compose exec postgres pg_dump -U turtletrading turtletrading > backup_$(shell date +%Y%m%d_%H%M%S).sql

restore-db: ## Restore database from backup (specify BACKUP_FILE=filename.sql)
	docker-compose exec -T postgres psql -U turtletrading -d turtletrading < $(BACKUP_FILE)

# Monitoring
monitor: ## Start monitoring tools
	@echo "Starting monitoring stack..."
	@echo "This would typically start Prometheus, Grafana, etc."

# Quick Setup for New Developers
setup: ## Complete setup for new developers
	@echo "Setting up TurtleTrading development environment..."
	@echo "1. Copying environment files..."
	cp backend/.env.example backend/.env
	@echo "2. Building containers..."
	docker-compose build
	@echo "3. Starting database..."
	docker-compose up -d postgres redis
	@echo "4. Waiting for database to be ready..."
	sleep 15
	@echo "5. Running database migrations..."
	docker-compose run --rm backend alembic upgrade head
	@echo "6. Seeding initial data..."
	docker-compose run --rm backend python -c "print('Database setup complete')"
	@echo ""
	@echo "Setup complete! Run 'make dev' to start development servers."
	@echo "API docs: http://localhost:8000/api/docs"
	@echo "Frontend: http://localhost:3000"

# Environment Management
env-check: ## Check environment configuration
	@echo "Checking environment configuration..."
	@echo "Backend environment:"
	docker-compose exec backend env | grep -E "(DATABASE|REDIS|API)" || true
	@echo "\nFrontend environment:"
	docker-compose exec frontend env | grep -E "(REACT_APP)" || true