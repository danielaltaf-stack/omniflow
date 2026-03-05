"""
OmniFlow — Woob Worker: production-only bank synchronization.

load_backend connects to real French banks via Woob.
No demo mode, no mock data, no fallbacks.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.woob_engine.normalizer import NormalizedAccount, NormalizedTransaction
from app.woob_engine.categorizer import categorize_batch
from app.woob_engine.banks import get_bank_info

logger = logging.getLogger("omniflow.woob")

# Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = [2, 4, 8]
SYNC_TIMEOUT_SECONDS = 120

# ── Per-user concurrency limiter (max 3 concurrent syncs) ────
_user_semaphores: dict[str, asyncio.Semaphore] = {}


def _get_user_semaphore(user_id: str) -> asyncio.Semaphore:
    """Get or create a semaphore limiting concurrent syncs per user."""
    if user_id not in _user_semaphores:
        _user_semaphores[user_id] = asyncio.Semaphore(3)
    return _user_semaphores[user_id]


@dataclass
class SyncResult:
    success: bool
    accounts: list[NormalizedAccount]
    transactions: dict[str, list[NormalizedTransaction]]
    error: str | None = None
    sca_required: bool = False
    metadata: dict | None = None  # Extra data (e.g. TR positions for stock/crypto sync)


class WoobWorker:
    """
    One worker = one sync session for a user + bank.
    Production only — requires woob to be installed.
    """

    def __init__(
        self,
        user_id: str,
        bank_module: str,
        credentials: dict[str, str],
    ):
        self.user_id = user_id
        self.bank_module = bank_module
        self.credentials = credentials
        self.status = "initializing"
        self._progress_callback: Any = None

    def on_progress(self, callback):
        self._progress_callback = callback

    async def _emit(self, event: str, data: dict | None = None):
        if self._progress_callback:
            await self._progress_callback(event, data or {})

    async def sync(self) -> SyncResult:
        """Run a full sync with per-user concurrency limit and distributed lock."""
        sem = _get_user_semaphore(self.user_id)
        if sem.locked():
            logger.info("[woob] User %s has max concurrent syncs, waiting...", self.user_id)
        async with sem:
            return await self._sync_with_retry()

    async def _sync_with_retry(self) -> SyncResult:
        """Retry logic with exponential backoff."""
        last_error: str | None = None

        for attempt in range(MAX_RETRIES):
            try:
                result = await asyncio.wait_for(
                    self._sync_real(),
                    timeout=SYNC_TIMEOUT_SECONDS,
                )
                return result
            except asyncio.TimeoutError:
                last_error = f"Timeout après {SYNC_TIMEOUT_SECONDS}s (tentative {attempt + 1}/{MAX_RETRIES})"
                logger.warning(f"[woob] {last_error}")
            except Exception as e:
                last_error = str(e)
                # Don't retry auth/SCA errors
                if any(keyword in last_error.lower() for keyword in ["incorrect", "sca", "2fa", "password"]):
                    return SyncResult(success=False, accounts=[], transactions={}, error=last_error)
                logger.warning(f"[woob] Attempt {attempt + 1}/{MAX_RETRIES} failed: {e}")

            if attempt < MAX_RETRIES - 1:
                backoff = RETRY_BACKOFF_SECONDS[attempt]
                logger.info(f"[woob] Retrying in {backoff}s...")
                await asyncio.sleep(backoff)

        return SyncResult(
            success=False,
            accounts=[],
            transactions={},
            error=f"Échec après {MAX_RETRIES} tentatives: {last_error}",
        )

    async def _sync_real(self) -> SyncResult:
        """Real Woob sync — production only, no fallback."""
        try:
            from woob.core import Woob  # type: ignore
        except ImportError:
            raise RuntimeError(
                "Woob n'est pas installé. Installez-le avec: pip install woob. "
                "Aucun mode démo disponible."
            )

        # Ensure cragr module is patched (safety net)
        try:
            from app.woob_engine.patch_cragr_runtime import apply_all_cragr_patches
            apply_all_cragr_patches()
        except Exception:
            pass  # Non-critical

        try:
            from woob.exceptions import (  # type: ignore
                ActionNeeded,
                BrowserIncorrectPassword,
                BrowserQuestion,
                BrowserUnavailable,
                NeedInteractiveFor2FA,
            )
        except ImportError:
            from woob.exceptions import BrowserIncorrectPassword  # type: ignore
            ActionNeeded = Exception
            BrowserQuestion = Exception
            BrowserUnavailable = Exception
            NeedInteractiveFor2FA = Exception

        try:
            await self._emit("progress", {"step": "connecting", "percent": 10})

            woob = Woob()

            # Merge credentials with default params from bank config
            params = dict(self.credentials)
            bank_info = get_bank_info(self.bank_module)
            if bank_info and bank_info.default_params:
                for key, val in bank_info.default_params.items():
                    if key not in params:
                        params[key] = val

            # Auto-fill optional non-transient config fields the module may
            # reference.  SKIP ValueTransient fields (code, request_information,
            # otp …) — they must NOT appear in params at all or woob rejects
            # them with "Value can't be empty".
            try:
                mod = woob.modules_loader.get_or_load_module(self.bank_module)
                for key, val in mod.config.items():
                    if key in params:
                        continue
                    if getattr(val, "transient", False):
                        continue  # Never inject transient fields
                    if not getattr(val, "required", False):
                        default = getattr(val, "default", None)
                        if default is not None:
                            params[key] = str(default)
            except Exception:
                pass  # Non-critical — proceed with what we have

            # All Woob calls are blocking (mechanize/requests) — run in thread pool
            backend = await asyncio.to_thread(
                woob.load_backend,
                self.bank_module,
                self.bank_module,
                params,
            )

            await self._emit("progress", {"step": "fetching_accounts", "percent": 30})
            raw_accounts = await asyncio.to_thread(
                lambda: list(backend.iter_accounts())
            )

            accounts: list[NormalizedAccount] = []
            for raw in raw_accounts:
                accounts.append(
                    NormalizedAccount(
                        external_id=str(raw.id),
                        type=self._map_account_type(raw.type),
                        label=raw.label.strip() if raw.label else "Compte",
                        balance=int(raw.balance * 100),
                        currency=getattr(raw, "currency", "EUR") or "EUR",
                    )
                )

            await self._emit("progress", {"step": "fetching_transactions", "percent": 50})
            transactions: dict[str, list[NormalizedTransaction]] = {}

            for i, raw_acc in enumerate(raw_accounts):
                raw_txns = await asyncio.to_thread(
                    lambda acc=raw_acc: list(backend.iter_history(acc))
                )
                txns: list[NormalizedTransaction] = []
                for raw_t in raw_txns:
                    label_clean = (raw_t.label or "Transaction").strip()
                    # Normalize spaces
                    label_clean = " ".join(label_clean.split())
                    txns.append(
                        NormalizedTransaction(
                            external_id=str(raw_t.id) if raw_t.id else uuid.uuid4().hex[:12],
                            date=raw_t.date,
                            amount=int(raw_t.amount * 100),
                            label=label_clean,
                            raw_label=(raw_t.raw or raw_t.label or "").strip(),
                            type=self._map_transaction_type(raw_t.type),
                        )
                    )
                # Auto-categorize all transactions
                txns = categorize_batch(txns)
                transactions[str(raw_acc.id)] = txns

                pct = 50 + int((i + 1) / len(raw_accounts) * 40)
                await self._emit("progress", {
                    "step": "fetching_transactions",
                    "percent": pct,
                    "account": raw_acc.label,
                })

            await self._emit("progress", {"step": "completed", "percent": 100})
            self.status = "completed"

            logger.info(
                f"[woob] Sync OK: {self.bank_module} — "
                f"{len(accounts)} comptes, "
                f"{sum(len(t) for t in transactions.values())} transactions"
            )

            return SyncResult(success=True, accounts=accounts, transactions=transactions)

        except BrowserIncorrectPassword:
            return SyncResult(
                success=False, accounts=[], transactions={},
                error="Identifiants incorrects. Vérifiez votre login et mot de passe.",
            )
        except NeedInteractiveFor2FA:
            return SyncResult(
                success=False, accounts=[], transactions={},
                sca_required=True,
                error="Authentification forte (SCA) requise. Validez sur votre application bancaire.",
            )
        except BrowserQuestion as e:
            return SyncResult(
                success=False, accounts=[], transactions={},
                sca_required=True,
                error=f"Question de sécurité de votre banque: {e}",
            )
        except ActionNeeded as e:
            return SyncResult(
                success=False, accounts=[], transactions={},
                error=(
                    "Action requise sur le site de votre banque : "
                    "connectez-vous directement sur le site officiel de votre banque "
                    "pour accepter les conditions générales ou effectuer les réglages demandés, "
                    "puis réessayez la synchronisation ici."
                ),
            )
        except BrowserUnavailable as e:
            msg = str(e).lower()
            # Many banks (notably Crédit Agricole) raise BrowserUnavailable
            # when credentials are wrong instead of BrowserIncorrectPassword.
            if any(kw in msg for kw in ("identifiant", "mot de passe", "code personnel", "credentials", "authentification")):
                error_msg = (
                    "Identifiants incorrects. Vérifiez votre identifiant "
                    "et code personnel, puis réessayez."
                )
            else:
                error_msg = (
                    "Votre banque est temporairement indisponible. "
                    "Réessayez dans quelques minutes."
                )
            return SyncResult(
                success=False, accounts=[], transactions={},
                error=error_msg,
            )
        except Exception as e:
            logger.exception(f"[woob] Sync failed for {self.bank_module}")
            err_str = str(e)
            # Fortuneo (and similar) raise a bare KeyError('code') when
            # the OAuth redirect doesn't contain the expected parameter,
            # which almost always means the credentials are wrong.
            if isinstance(e, KeyError) and err_str in ("'code'", "'code_url'"):
                err_str = (
                    "Identifiants incorrects ou authentification forte requise. "
                    "Vérifiez votre login / mot de passe et réessayez."
                )
            return SyncResult(
                success=False, accounts=[], transactions={},
                error=f"Erreur de synchronisation: {err_str}",
            )

    @staticmethod
    def _map_account_type(woob_type: int) -> str:
        """Map Woob account types to OmniFlow AccountType values."""
        mapping = {
            1: "checking",       # TYPE_CHECKING
            2: "savings",        # TYPE_SAVINGS
            3: "deposit",        # TYPE_DEPOSIT
            4: "market",         # TYPE_MARKET
            5: "loan",           # TYPE_LOAN
            6: "pea",            # TYPE_PEA
            7: "life_insurance", # TYPE_LIFE_INSURANCE
            8: "credit_card",    # TYPE_CARD (credit card)
            9: "mortgage",       # TYPE_MORTGAGE
            10: "revolving_credit", # TYPE_REVOLVING_CREDIT
            11: "per",           # TYPE_PER
            12: "madelin",       # TYPE_MADELIN
        }
        return mapping.get(woob_type, "other")

    @staticmethod
    def _map_transaction_type(woob_type: int) -> str:
        """Map Woob transaction types to OmniFlow TransactionType values."""
        mapping = {
            0: "other",          # TYPE_UNKNOWN → other
            1: "transfer",       # TYPE_TRANSFER
            2: "order",          # TYPE_ORDER
            3: "check",          # TYPE_CHECK
            4: "deposit",        # TYPE_DEPOSIT
            5: "payback",        # TYPE_PAYBACK
            6: "withdrawal",     # TYPE_WITHDRAWAL → atm
            7: "card",           # TYPE_CARD
            8: "loan_payment",   # TYPE_LOAN_PAYMENT
            9: "insurance",      # TYPE_BANK (insurance fee)
            10: "bank",          # TYPE_BANK
            11: "cash_deposit",  # TYPE_CASH_DEPOSIT
            12: "card_summary",  # TYPE_CARD_SUMMARY
            13: "deferred_card", # TYPE_DEFERRED_CARD
        }
        return mapping.get(woob_type, "other")
