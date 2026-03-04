# ────────────────────────────────────────────────────────
# OmniFlow — Development Commands
# ────────────────────────────────────────────────────────

.PHONY: dev stop build migrate logs test lint

# Start all services (db + redis + api)
dev:
	docker compose up --build -d
	@echo ""
	@echo "🚀 OmniFlow Backend running at http://localhost:8000"
	@echo "📖 Swagger docs at http://localhost:8000/docs"
	@echo ""

# Stop all services
stop:
	docker compose down

# Rebuild containers
build:
	docker compose build --no-cache

# Run Alembic migrations inside the api container
migrate:
	docker compose exec api alembic upgrade head

# View api logs
logs:
	docker compose logs -f api

# Run backend tests
test:
	docker compose exec api pytest -v

# Lint backend
lint:
	docker compose exec api ruff check .

# Full reset (destroy volumes and rebuild)
reset:
	docker compose down -v
	docker compose up --build -d
	@sleep 5
	docker compose exec api alembic upgrade head
	@echo "✅ Full reset complete"

# ── Production deployment targets ───────────────────────────────

# Validate production readiness (run before deploy)
check-prod:
	@echo "🔍 Checking production readiness..."
	@cd apps/api && python -c "\
from app.core.config import Settings; \
import os; \
os.environ['ENVIRONMENT'] = 'development'; \
s = Settings(); \
print(f'  App: {s.APP_NAME} v{s.APP_VERSION}'); \
print(f'  Env: {s.ENVIRONMENT}'); \
print(f'  Sentry: {\"configured\" if s.SENTRY_DSN else \"disabled\"}'); \
print(f'  Launch: {s.LAUNCH_MODE}'); \
print('✅ Config loads successfully')"

# Run unit tests (no DB required)
test-unit:
	cd apps/api && python -m pytest tests/ -k "unit" -v --tb=short

# Run all tests with coverage
test-cov:
	cd apps/api && python -m pytest tests/ -v --tb=short --cov=app --cov-report=term-missing

# Lint backend
lint-backend:
	cd apps/api && ruff check . && ruff format --check .

# Lint frontend
lint-frontend:
	cd apps/web && npm run lint && npx tsc --noEmit

# Build frontend (production)
build-frontend:
	cd apps/web && npm ci && npm run build
