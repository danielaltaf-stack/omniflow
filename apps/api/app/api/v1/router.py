"""
OmniFlow — V1 API Router (aggregates all sub-routers).
"""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.banks import router as banks_router
from app.api.v1.connections import router as connections_router
from app.api.v1.accounts import router as accounts_router
from app.api.v1.networth import router as networth_router
from app.api.v1.crypto import router as crypto_router
from app.api.v1.stocks import router as stocks_router
from app.api.v1.realestate import router as realestate_router
from app.api.v1.cashflow import router as cashflow_router
from app.api.v1.budget import router as budget_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.insights import router as insights_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.ws import router as ws_router
from app.api.v1.advisor import router as advisor_router
from app.api.v1.profiles import router as profiles_router
from app.api.v1.project_budgets import router as projects_router
from app.api.v1.debts import router as debts_router
from app.api.v1.market import router as market_router
from app.api.v1.ws_markets import router as ws_markets_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.watchlists import router as watchlists_router
from app.api.v1.retirement import router as retirement_router
from app.api.v1.heritage import router as heritage_router
from app.api.v1.fee_negotiator import router as fee_negotiator_router
from app.api.v1.fiscal_radar import router as fiscal_radar_router
from app.api.v1.wealth_autopilot import router as autopilot_router
from app.api.v1.digital_vault import router as vault_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.push import router as push_router
from app.api.v1.settings import router as settings_router
from app.api.v1.feedback import router as feedback_router
from app.api.v1.changelog import router as changelog_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(banks_router)
router.include_router(connections_router)
router.include_router(accounts_router)
router.include_router(networth_router)
router.include_router(crypto_router)
router.include_router(stocks_router)
router.include_router(realestate_router)
router.include_router(cashflow_router)
router.include_router(budget_router)
router.include_router(dashboard_router)
router.include_router(insights_router)
router.include_router(notifications_router)
router.include_router(ws_router)
router.include_router(advisor_router)
router.include_router(profiles_router)
router.include_router(projects_router)
router.include_router(debts_router)
router.include_router(market_router)
router.include_router(ws_markets_router)
router.include_router(alerts_router)
router.include_router(watchlists_router)
router.include_router(retirement_router)
router.include_router(heritage_router)
router.include_router(fee_negotiator_router)
router.include_router(fiscal_radar_router)
router.include_router(autopilot_router)
router.include_router(vault_router)
router.include_router(calendar_router)
router.include_router(push_router)
router.include_router(settings_router)
router.include_router(feedback_router)
router.include_router(changelog_router)
