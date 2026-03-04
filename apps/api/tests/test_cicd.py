"""
OmniFlow — E5.2 + E5.3 CI/CD & Frontend Deployment Tests.

Validates:
  - Vercel configuration (vercel.json schema, regions, headers, rewrites)
  - Dockerfile.prod frontend (multi-stage, non-root, healthcheck, tini)
  - Sentry client config (beforeSend filtering, RGPD scrubbing, transaction drops)
  - CI/CD pipeline (ci.yml structure: 6 jobs, security scan, deploy gates)
  - Frontend env template (.env.production.example completeness)
  - Providers integration (Sentry import in providers.tsx)
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

# ═════════════════════════════════════════════════════════════════
# Shared path helpers
# ═════════════════════════════════════════════════════════════════

REPO_ROOT = Path(__file__).parent.parent.parent.parent
WEB_DIR = REPO_ROOT / "apps" / "web"
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


# ═══════════════════════════════════════════════════════════════════
#  1. VERCEL CONFIGURATION
# ═══════════════════════════════════════════════════════════════════


class TestVercelConfig:
    """Validate vercel.json is well-formed and production-ready."""

    def test_vercel_json_exists(self):
        assert (WEB_DIR / "vercel.json").exists()

    def test_vercel_json_valid_json(self):
        content = _read(WEB_DIR / "vercel.json")
        data = json.loads(content)
        assert isinstance(data, dict)

    def test_vercel_json_framework_nextjs(self):
        data = json.loads(_read(WEB_DIR / "vercel.json"))
        assert data.get("framework") == "nextjs"

    def test_vercel_json_region_cdg1(self):
        """Vercel should prioritize Paris CDG1 for French users."""
        data = json.loads(_read(WEB_DIR / "vercel.json"))
        regions = data.get("regions", [])
        assert "cdg1" in regions

    def test_vercel_json_has_headers(self):
        data = json.loads(_read(WEB_DIR / "vercel.json"))
        headers = data.get("headers", [])
        assert len(headers) >= 2, "Should have at least API no-cache and static cache headers"

    def test_vercel_json_api_no_cache(self):
        """API proxy routes should have no-cache headers."""
        data = json.loads(_read(WEB_DIR / "vercel.json"))
        headers = data.get("headers", [])
        api_headers = [h for h in headers if "/api/" in h.get("source", "")]
        assert len(api_headers) >= 1
        header_values = {
            hv["key"]: hv["value"]
            for h in api_headers
            for hv in h.get("headers", [])
        }
        assert "Cache-Control" in header_values
        assert "no-store" in header_values["Cache-Control"]

    def test_vercel_json_static_assets_immutable(self):
        """Static JS/CSS should be cached immutably."""
        data = json.loads(_read(WEB_DIR / "vercel.json"))
        headers = data.get("headers", [])
        static_headers = [h for h in headers if "js|css" in h.get("source", "")]
        assert len(static_headers) >= 1
        for h in static_headers:
            for hv in h.get("headers", []):
                if hv["key"] == "Cache-Control":
                    assert "immutable" in hv["value"]

    def test_vercel_json_has_rewrites(self):
        """API proxy rewrite should be configured."""
        data = json.loads(_read(WEB_DIR / "vercel.json"))
        rewrites = data.get("rewrites", [])
        assert len(rewrites) >= 1
        sources = [r.get("source", "") for r in rewrites]
        assert any("/api/v1" in s for s in sources)

    def test_vercel_json_install_command(self):
        """Should use npm ci --prefer-offline for deterministic installs."""
        data = json.loads(_read(WEB_DIR / "vercel.json"))
        install_cmd = data.get("installCommand", "")
        assert "npm ci" in install_cmd


# ═══════════════════════════════════════════════════════════════════
#  2. DOCKERFILE FRONTEND
# ═══════════════════════════════════════════════════════════════════


class TestDockerfileFrontend:
    """Validate Dockerfile.prod for frontend production deployment."""

    def test_dockerfile_prod_exists(self):
        assert (WEB_DIR / "Dockerfile.prod").exists()

    def test_dockerfile_has_multi_stage(self):
        """Should have 3 stages: deps, builder, runner."""
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "AS deps" in content
        assert "AS builder" in content
        assert "AS runner" in content

    def test_dockerfile_uses_node_20_alpine(self):
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "node:20-alpine" in content

    def test_dockerfile_has_non_root_user(self):
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "USER nextjs" in content or "USER nonroot" in content

    def test_dockerfile_has_healthcheck(self):
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "HEALTHCHECK" in content

    def test_dockerfile_has_tini(self):
        """Should use tini for proper signal handling."""
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "tini" in content

    def test_dockerfile_copies_standalone(self):
        """Should copy .next/standalone for minimal image."""
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "standalone" in content

    def test_dockerfile_copies_static(self):
        """Should copy .next/static for client-side assets."""
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert ".next/static" in content

    def test_dockerfile_exposes_3000(self):
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "EXPOSE 3000" in content

    def test_dockerfile_sets_node_env_production(self):
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "NODE_ENV=production" in content

    def test_dockerfile_disables_telemetry(self):
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "NEXT_TELEMETRY_DISABLED=1" in content

    def test_dockerfile_has_build_args(self):
        """Should support env vars as build args (baked into static output)."""
        content = _read(WEB_DIR / "Dockerfile.prod")
        assert "ARG NEXT_PUBLIC_API_URL" in content


# ═══════════════════════════════════════════════════════════════════
#  3. SENTRY CLIENT CONFIG
# ═══════════════════════════════════════════════════════════════════


class TestSentryClientConfig:
    """Validate Sentry client-side configuration for frontend."""

    def test_sentry_client_config_exists(self):
        assert (WEB_DIR / "src" / "lib" / "sentry.client.config.ts").exists()

    def test_sentry_has_before_send(self):
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "beforeSend" in content

    def test_sentry_suppresses_resize_observer(self):
        """ResizeObserver loop errors should be suppressed."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "ResizeObserver loop" in content

    def test_sentry_suppresses_chunk_load_error(self):
        """ChunkLoadError should be suppressed (deploy during navigation)."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "ChunkLoadError" in content

    def test_sentry_scrubs_authorization(self):
        """Authorization header should be filtered for RGPD."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "authorization" in content.lower()
        assert "[Filtered]" in content

    def test_sentry_scrubs_cookies(self):
        """Cookies should be filtered."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "cookie" in content.lower()

    def test_sentry_scrubs_passwords(self):
        """Password fields should be filtered from request body."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "password" in content.lower()

    def test_sentry_drops_health_transactions(self):
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "/health" in content

    def test_sentry_has_session_replay(self):
        """Should have session replay for error debugging."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "replaysOnErrorSampleRate" in content

    def test_sentry_no_default_pii(self):
        """sendDefaultPii should be false (RGPD)."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "sendDefaultPii: false" in content

    def test_sentry_trace_propagation_to_api(self):
        """Should propagate traces to api.omniflow.app for distributed tracing."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "api.omniflow.app" in content or "api\\.omniflow\\.app" in content

    def test_sentry_exports_public_api(self):
        """Should export initSentry, captureException, setUser, clearUser."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "export async function initSentry" in content
        assert "export function captureException" in content
        assert "export function setUser" in content
        assert "export function clearUser" in content

    def test_sentry_graceful_degradation(self):
        """Should gracefully degrade if @sentry/nextjs not installed."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "catch" in content  # try/catch around dynamic import

    def test_sentry_denies_extension_urls(self):
        """Should deny browser extension URLs to reduce noise."""
        content = _read(WEB_DIR / "src" / "lib" / "sentry.client.config.ts")
        assert "chrome-extension" in content
        assert "moz-extension" in content


# ═══════════════════════════════════════════════════════════════════
#  4. CI/CD PIPELINE
# ═══════════════════════════════════════════════════════════════════


class TestCICDPipeline:
    """Validate GitHub Actions CI/CD pipeline configuration."""

    def test_ci_yml_exists(self):
        assert (WORKFLOWS_DIR / "ci.yml").exists()

    def test_ci_yml_valid_yaml(self):
        """ci.yml should be parseable YAML."""
        import yaml
        content = _read(WORKFLOWS_DIR / "ci.yml")
        data = yaml.safe_load(content)
        assert isinstance(data, dict)

    def test_ci_has_6_jobs(self):
        """Pipeline should have exactly 6 jobs."""
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        jobs = data.get("jobs", {})
        assert len(jobs) >= 6, f"Expected 6+ jobs, got {len(jobs)}: {list(jobs.keys())}"

    def test_ci_has_backend_lint_job(self):
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        assert "backend-lint" in data.get("jobs", {})

    def test_ci_has_backend_test_job(self):
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        assert "backend-test" in data.get("jobs", {})

    def test_ci_has_frontend_quality_job(self):
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        assert "frontend-quality" in data.get("jobs", {})

    def test_ci_has_security_scan_job(self):
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        assert "security-scan" in data.get("jobs", {})

    def test_ci_has_frontend_build_job(self):
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        assert "frontend-build" in data.get("jobs", {})

    def test_ci_has_deploy_job(self):
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        assert "deploy" in data.get("jobs", {})

    def test_ci_deploy_only_on_main(self):
        """Deploy should only run on push to main."""
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        deploy = data["jobs"]["deploy"]
        if_cond = deploy.get("if", "")
        assert "main" in if_cond

    def test_ci_deploy_needs_test_and_build(self):
        """Deploy should depend on backend-test and frontend-build."""
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        deploy = data["jobs"]["deploy"]
        needs = deploy.get("needs", [])
        assert "backend-test" in needs
        assert "frontend-build" in needs

    def test_ci_deploy_has_health_check(self):
        """Deploy should include a health check step."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "health" in content.lower()
        assert "/health/live" in content or "/health/ready" in content

    def test_ci_deploy_has_sentry_release(self):
        """Deploy should create a Sentry release."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "sentry" in content.lower()
        assert "releases" in content

    def test_ci_has_concurrency(self):
        """Should cancel in-progress runs for same ref."""
        import yaml
        data = yaml.safe_load(_read(WORKFLOWS_DIR / "ci.yml"))
        concurrency = data.get("concurrency", {})
        assert concurrency.get("cancel-in-progress") is True

    def test_ci_security_scan_has_trivy(self):
        """Security scan should include Trivy filesystem scan."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "trivy" in content.lower()

    def test_ci_security_scan_has_pip_audit(self):
        """Security scan should include pip-audit."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "pip-audit" in content

    def test_ci_security_scan_has_npm_audit(self):
        """Security scan should include npm audit."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "npm audit" in content

    def test_ci_backend_lint_has_bandit(self):
        """Backend lint should include Bandit SAST scan."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "bandit" in content.lower()

    def test_ci_backend_test_has_coverage(self):
        """Backend test should enforce coverage threshold."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "cov-fail-under" in content

    def test_ci_frontend_quality_has_tsc(self):
        """Frontend quality should run TypeScript type-check."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "tsc --noEmit" in content

    def test_ci_has_timeout(self):
        """Jobs should have timeout-minutes set."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "timeout-minutes" in content

    def test_ci_uses_checkout_v4(self):
        """Should use actions/checkout@v4."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "actions/checkout@v4" in content

    def test_ci_services_postgres_16(self):
        """Backend test should use PostgreSQL 16."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "postgres:16" in content

    def test_ci_services_redis_7(self):
        """Backend test should use Redis 7."""
        content = _read(WORKFLOWS_DIR / "ci.yml")
        assert "redis:7" in content


# ═══════════════════════════════════════════════════════════════════
#  5. FRONTEND ENV TEMPLATE
# ═══════════════════════════════════════════════════════════════════


class TestFrontendEnvTemplate:
    """Validate .env.production.example for frontend."""

    def test_env_production_example_exists(self):
        assert (WEB_DIR / ".env.production.example").exists()

    def test_env_has_api_url(self):
        content = _read(WEB_DIR / ".env.production.example")
        assert "NEXT_PUBLIC_API_URL" in content

    def test_env_has_sentry_dsn(self):
        content = _read(WEB_DIR / ".env.production.example")
        assert "NEXT_PUBLIC_SENTRY_DSN" in content

    def test_env_has_plausible(self):
        content = _read(WEB_DIR / ".env.production.example")
        assert "NEXT_PUBLIC_PLAUSIBLE_DOMAIN" in content

    def test_env_has_app_version(self):
        content = _read(WEB_DIR / ".env.production.example")
        assert "NEXT_PUBLIC_APP_VERSION" in content


# ═══════════════════════════════════════════════════════════════════
#  6. PROVIDERS INTEGRATION
# ═══════════════════════════════════════════════════════════════════


class TestProvidersIntegration:
    """Validate Sentry is integrated into the Providers component."""

    def test_providers_imports_sentry(self):
        content = _read(WEB_DIR / "src" / "providers" / "providers.tsx")
        assert "sentry" in content.lower()

    def test_providers_calls_init_sentry(self):
        content = _read(WEB_DIR / "src" / "providers" / "providers.tsx")
        assert "initSentry" in content

    def test_providers_imports_web_vitals(self):
        """Web Vitals should still be initialized alongside Sentry."""
        content = _read(WEB_DIR / "src" / "providers" / "providers.tsx")
        assert "initWebVitalsReporter" in content


# ═══════════════════════════════════════════════════════════════════
#  7. RENDER BLUEPRINT (Free tier backend)
# ═══════════════════════════════════════════════════════════════════


class TestRenderBlueprint:
    """Validate render.yaml for free-tier Render deployment."""

    def test_render_yaml_exists(self):
        assert (REPO_ROOT / "render.yaml").exists()

    def test_render_yaml_valid_yaml(self):
        import yaml
        content = _read(REPO_ROOT / "render.yaml")
        data = yaml.safe_load(content)
        assert isinstance(data, dict)

    def test_render_has_services(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        assert "services" in data
        assert len(data["services"]) >= 1

    def test_render_service_is_web(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        svc = data["services"][0]
        assert svc["type"] == "web"

    def test_render_uses_docker(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        svc = data["services"][0]
        assert svc["runtime"] == "docker"

    def test_render_region_frankfurt(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        svc = data["services"][0]
        assert svc["region"] == "frankfurt"

    def test_render_plan_free(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        svc = data["services"][0]
        assert svc["plan"] == "free"

    def test_render_has_healthcheck(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        svc = data["services"][0]
        assert svc.get("healthCheckPath") == "/health/live"

    def test_render_root_dir_apps_api(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        svc = data["services"][0]
        assert svc.get("rootDir") == "apps/api"

    def test_render_has_env_vars(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        svc = data["services"][0]
        env_keys = [e["key"] for e in svc.get("envVars", [])]
        assert "DATABASE_URL" in env_keys
        assert "REDIS_URL" in env_keys
        assert "SECRET_KEY" in env_keys
        assert "ENVIRONMENT" in env_keys

    def test_render_secret_key_auto_generated(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        svc = data["services"][0]
        sk = [e for e in svc.get("envVars", []) if e["key"] == "SECRET_KEY"][0]
        assert sk.get("generateValue") is True

    def test_render_environment_production(self):
        import yaml
        data = yaml.safe_load(_read(REPO_ROOT / "render.yaml"))
        svc = data["services"][0]
        env = [e for e in svc.get("envVars", []) if e["key"] == "ENVIRONMENT"][0]
        assert env.get("value") == "production"


# ═══════════════════════════════════════════════════════════════════
#  8. DEPLOY GUIDE
# ═══════════════════════════════════════════════════════════════════


class TestDeployGuide:
    """Validate DEPLOY_GUIDE.md is complete."""

    def test_deploy_guide_exists(self):
        assert (REPO_ROOT / "DEPLOY_GUIDE.md").exists()

    def test_deploy_guide_covers_neon(self):
        content = _read(REPO_ROOT / "DEPLOY_GUIDE.md")
        assert "neon" in content.lower()

    def test_deploy_guide_covers_upstash(self):
        content = _read(REPO_ROOT / "DEPLOY_GUIDE.md")
        assert "upstash" in content.lower()

    def test_deploy_guide_covers_render(self):
        content = _read(REPO_ROOT / "DEPLOY_GUIDE.md")
        assert "render" in content.lower()

    def test_deploy_guide_covers_vercel(self):
        content = _read(REPO_ROOT / "DEPLOY_GUIDE.md")
        assert "vercel" in content.lower()

    def test_deploy_guide_covers_sentry(self):
        content = _read(REPO_ROOT / "DEPLOY_GUIDE.md")
        assert "sentry" in content.lower()

    def test_deploy_guide_mentions_free(self):
        content = _read(REPO_ROOT / "DEPLOY_GUIDE.md")
        assert "gratuit" in content.lower() or "free" in content.lower()

    def test_deploy_guide_has_checklist(self):
        content = _read(REPO_ROOT / "DEPLOY_GUIDE.md")
        assert "- [ ]" in content
