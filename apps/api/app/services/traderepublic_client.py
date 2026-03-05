"""
OmniFlow — Trade Republic API client.

Unofficial reverse-engineered API.  Authentication via phone + PIN + 2FA code.
Data retrieval via WebSocket subscriptions.
Production-only — no mocks.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

import httpx

logger = logging.getLogger("omniflow.traderepublic")

TR_BASE = "https://api.traderepublic.com"
TR_WS = "wss://api.traderepublic.com"
WS_TIMEOUT = 30  # seconds per subscription
MAX_TIMELINE_PAGES = 50  # pages of 20 events = 1000 transactions max


# ── Data classes ─────────────────────────────────────────────

@dataclass
class TRSession:
    """Holds Trade Republic session tokens after successful 2FA."""
    session_token: str
    refresh_token: str
    cookies: dict[str, str]
    created_at: float  # time.time()


@dataclass
class TRPosition:
    """A portfolio position from Trade Republic."""
    isin: str
    name: str
    quantity: float
    buy_price_avg: float  # in EUR
    current_price: float  # in EUR
    currency: str
    asset_type: str = "stock"  # stock, etf, crypto, bond
    sec_acc_no: str = ""  # securities account number


@dataclass
class TRAccountStructure:
    """Account structure parsed from TR JWT claims."""
    # Default (Compte-titres)
    default_sec: list[str]   # e.g. ["0315805902"]
    default_cash: list[str]  # e.g. ["0315805911"]
    # PEA (tax_wrapper_fr)
    pea_sec: list[str]       # e.g. ["0315805903"]
    pea_cash: list[str]      # e.g. ["0315805913"]


@dataclass
class TRCash:
    """Cash balance from Trade Republic."""
    balance: float  # in EUR
    currency: str
    iban: str | None = None


@dataclass
class TRTimelineEvent:
    """A timeline event (transaction) from Trade Republic."""
    event_id: str
    event_type: str  # PAYMENT_INBOUND, PAYMENT_OUTBOUND, TRADE_INVOICE, etc.
    title: str
    amount: float  # signed, in EUR
    date: date
    icon: str | None = None
    subtitle: str = ""


@dataclass
class TRSavingsPlan:
    """A savings plan (plan d'investissement programmé) from Trade Republic."""
    savings_plan_id: str
    isin: str
    name: str
    amount: float  # monthly amount in EUR
    interval: str  # e.g. "monthly", "weekly"
    is_active: bool


@dataclass
class TRInterestDetail:
    """Interest / Saveback details from Trade Republic."""
    accrued_interest: float  # current accrued interest in EUR
    annual_rate: float  # e.g. 0.035 = 3.5%
    currency: str
    next_payout_date: date | None = None


# ── Client ───────────────────────────────────────────────────

class TradeRepublicClient:
    """
    Trade Republic API client.

    Usage:
        client = TradeRepublicClient()
        process_id = await client.login("+33612345678", "1234")
        # User receives 2FA code on their phone
        session = await client.verify_2fa(process_id, "5678")
        portfolio = await client.fetch_portfolio(session)
        cash = await client.fetch_cash(session)
        timeline = await client.fetch_timeline(session)
    """

    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
    CLIENT_VERSION = "1.22.6"

    # ── Authentication ───────────────────────────────────────

    async def login(self, phone_number: str, pin: str) -> str:
        """
        Initiate Trade Republic login.

        Args:
            phone_number: International format, e.g. "+33612345678"
            pin: 4-digit numeric PIN

        Returns:
            processId — needed for 2FA verification

        Raises:
            TradeRepublicAuthError on invalid credentials
        """
        async with httpx.AsyncClient(
            headers={"User-Agent": self.USER_AGENT},
            timeout=15,
        ) as client:
            try:
                resp = await client.post(
                    f"{TR_BASE}/api/v1/auth/web/login",
                    json={"phoneNumber": phone_number, "pin": pin},
                )
            except httpx.RequestError as e:
                raise TradeRepublicError(
                    f"Impossible de contacter Trade Republic: {e}"
                ) from e

            if resp.status_code == 401:
                raise TradeRepublicAuthError(
                    "Numéro de téléphone ou PIN incorrect."
                )
            if resp.status_code == 429:
                raise TradeRepublicRateLimitError(
                    "Trop de tentatives. Réessayez dans quelques minutes."
                )
            if resp.status_code >= 400:
                raise TradeRepublicError(
                    f"Erreur Trade Republic (HTTP {resp.status_code}): {resp.text[:200]}"
                )

            data = resp.json()
            process_id = data.get("processId")
            if not process_id:
                raise TradeRepublicError(
                    "Réponse inattendue de Trade Republic (processId manquant)."
                )

            logger.info(f"[TR] Login initiated, processId={process_id[:8]}...")
            return process_id

    async def verify_2fa(self, process_id: str, code: str) -> TRSession:
        """
        Complete 2FA verification with the code received on phone.

        Args:
            process_id: From login() response
            code: 4-digit 2FA code

        Returns:
            TRSession with session tokens and cookies

        Raises:
            TradeRepublicAuthError on invalid code
        """
        # Sanitize code
        code = code.strip()
        if not code.isdigit() or len(code) != 4:
            raise TradeRepublicAuthError(
                "Le code 2FA doit être composé de 4 chiffres."
            )

        async with httpx.AsyncClient(
            headers={"User-Agent": self.USER_AGENT},
            timeout=15,
        ) as client:
            try:
                resp = await client.post(
                    f"{TR_BASE}/api/v1/auth/web/login/{process_id}/{code}",
                )
            except httpx.RequestError as e:
                raise TradeRepublicError(
                    f"Impossible de contacter Trade Republic: {e}"
                ) from e

            if resp.status_code == 401:
                raise TradeRepublicAuthError(
                    "Code 2FA invalide ou expiré. Réessayez."
                )
            if resp.status_code == 410:
                raise TradeRepublicAuthError(
                    "Le code 2FA a expiré. Veuillez recommencer la connexion."
                )
            if resp.status_code >= 400:
                raise TradeRepublicError(
                    f"Erreur Trade Republic 2FA (HTTP {resp.status_code}): {resp.text[:200]}"
                )

            # Extract session from cookies / response
            # httpx.Cookies can contain duplicate cookie names (different paths/domains)
            # Use the jar items directly to avoid "Multiple cookies exist" error
            cookies: dict[str, str] = {}
            for cookie in resp.cookies.jar:
                cookies[cookie.name] = cookie.value  # last value wins for duplicates
            session_token = cookies.get("tr_session", "")
            refresh_token = cookies.get("tr_refresh", "")

            # Some TR versions return tokens in JSON body
            if resp.text:
                try:
                    body = resp.json()
                    if "sessionToken" in body:
                        session_token = body["sessionToken"]
                    if "refreshToken" in body:
                        refresh_token = body["refreshToken"]
                except (json.JSONDecodeError, KeyError):
                    pass

            if not session_token and not cookies:
                raise TradeRepublicError(
                    "Authentification réussie mais aucun jeton de session reçu."
                )

            logger.info(f"[TR] 2FA verified, session obtained (cookies: {list(cookies.keys())})")

            return TRSession(
                session_token=session_token,
                refresh_token=refresh_token,
                cookies=cookies,
                created_at=time.time(),
            )

    # ── Data Retrieval via WebSocket ─────────────────────────

    async def _ws_subscribe(
        self,
        session: TRSession,
        subscription: dict,
        timeout: float = WS_TIMEOUT,
    ) -> dict | list:
        """
        Open a WebSocket, subscribe to a channel, get the response.
        Each subscription opens a fresh connection (TR requires it).
        """
        try:
            import websockets
        except ImportError:
            raise RuntimeError(
                "Le package 'websockets' est requis pour Trade Republic. "
                "pip install websockets"
            )

        # Build cookie header from session
        cookie_parts = []
        if session.session_token:
            cookie_parts.append(f"tr_session={session.session_token}")
        if session.refresh_token:
            cookie_parts.append(f"tr_refresh={session.refresh_token}")
        for k, v in session.cookies.items():
            if k not in ("tr_session", "tr_refresh"):
                cookie_parts.append(f"{k}={v}")

        extra_headers = {
            "User-Agent": self.USER_AGENT,
            "Origin": "https://app.traderepublic.com",
        }
        if cookie_parts:
            extra_headers["Cookie"] = "; ".join(cookie_parts)

        try:
            async with websockets.connect(
                TR_WS,
                additional_headers=extra_headers,
                close_timeout=5,
            ) as ws:
                # 1. Connect with protocol handshake
                connect_payload = json.dumps({
                    "locale": "fr",
                    "platformId": "webtrading",
                    "platformVersion": "chrome - 120.0.0",
                    "clientId": "app.traderepublic.com",
                    "clientVersion": self.CLIENT_VERSION,
                })
                await ws.send(f"connect 31 {connect_payload}")

                # Wait for "connected"
                msg = await asyncio.wait_for(ws.recv(), timeout=10)
                msg_str = str(msg)
                logger.debug(f"[TR] WS connect response: {msg_str[:200]}")
                if "connected" not in msg_str.lower():
                    # Detect session expiry from handshake error
                    if "token" in msg_str.lower() and ("failed" in msg_str.lower() or "invalid" in msg_str.lower() or "expired" in msg_str.lower()):
                        raise TradeRepublicSessionExpiredError(
                            f"Session TR expirée (handshake): {msg_str[:100]}"
                        )
                    raise TradeRepublicError(
                        f"Échec de connexion WebSocket TR: {msg_str[:100]}"
                    )

                # 2. Subscribe to data channel
                sub_id = 1
                sub_payload = json.dumps(subscription)
                await ws.send(f"sub {sub_id} {sub_payload}")

                # 3. Wait for response
                deadline = time.time() + timeout
                while time.time() < deadline:
                    raw = await asyncio.wait_for(
                        ws.recv(),
                        timeout=max(1, deadline - time.time()),
                    )
                    raw_str = str(raw)

                    # Parse: "{id} A {json}" or "{id} E {json}"
                    parts = raw_str.split(" ", 2)
                    if len(parts) >= 2:
                        msg_id = parts[0]
                        msg_type = parts[1]

                        if msg_id == str(sub_id) and msg_type == "A" and len(parts) == 3:
                            return json.loads(parts[2])

                        if msg_id == str(sub_id) and msg_type == "E":
                            error_detail = parts[2] if len(parts) == 3 else "unknown"
                            raise TradeRepublicError(
                                f"Erreur Trade Republic: {error_detail[:200]}"
                            )

                raise TradeRepublicError("Timeout: pas de réponse de Trade Republic.")

        except websockets.exceptions.ConnectionClosed as e:
            raise TradeRepublicSessionExpiredError(
                f"Connexion WebSocket fermée par Trade Republic: {e}"
            )
        except asyncio.TimeoutError:
            raise TradeRepublicError(
                "Timeout de connexion WebSocket Trade Republic."
            )

    async def discover_subscriptions(self, session: TRSession) -> dict:
        """
        Probe multiple subscription types and log results.
        Used to discover the correct endpoints for this user's account.
        Returns a dict of {subscription_name: response_data_or_None}.
        """
        subs_to_test = [
            "compactPortfolio",
            "portfolioStatus",
            "portfolio",
            "positions",
            "securitiesPositions",
            "nontradablePositions",
            "cryptoBalance",
            "cryptoPortfolio",
            "bondsPortfolio",
            "peaCompactPortfolio",
            "peaStatus",
            "accountOverview",
            "accountSummary",
            "userAccounts",
            "investmentPortfolio",
            "portfolioPositions",
        ]
        results = {}
        for sub_type in subs_to_test:
            try:
                data = await self._ws_subscribe(
                    session, {"type": sub_type}, timeout=8,
                )
                s = json.dumps(data, ensure_ascii=False)
                if len(s) > 400:
                    s = s[:400] + "..."
                logger.info(f"[TR][discover] ✅ {sub_type}: {s}")
                results[sub_type] = data
            except TradeRepublicSessionExpiredError:
                logger.warning(f"[TR][discover] Session expired at {sub_type}")
                break
            except Exception as e:
                err = str(e)
                if "BAD_SUBSCRIPTION" in err:
                    logger.debug(f"[TR][discover] ❌ {sub_type}: BAD_SUBSCRIPTION_TYPE")
                else:
                    logger.debug(f"[TR][discover] ❌ {sub_type}: {err[:100]}")
                results[sub_type] = None
        return results

    def parse_account_structure(self, session: TRSession) -> TRAccountStructure:
        """
        Parse the account structure from the TR JWT claims cookie.
        Returns TRAccountStructure with sec/cash account numbers for default and PEA.
        """
        import base64
        claims_raw = session.cookies.get("tr_claims", "")
        if not claims_raw:
            # Try from session token JWT
            claims_raw = session.session_token

        default_sec, default_cash = [], []
        pea_sec, pea_cash = [], []

        if claims_raw:
            try:
                # JWT has 3 parts separated by '.', payload is the second
                parts = claims_raw.split(".")
                payload_b64 = parts[1] if len(parts) >= 2 else parts[0]
                # Fix base64 padding
                payload_b64 += "=" * (4 - len(payload_b64) % 4)
                payload = json.loads(base64.urlsafe_b64decode(payload_b64))

                act = payload.get("act", {})
                acc = act.get("acc", {})
                owner = acc.get("owner", {})

                default_info = owner.get("default", {})
                default_sec = default_info.get("sec", [])
                default_cash = default_info.get("cash", [])

                pea_info = owner.get("tax_wrapper_fr", {})
                pea_sec = pea_info.get("sec", [])
                pea_cash = pea_info.get("cash", [])

                logger.info(
                    f"[TR] Account structure: default_sec={default_sec}, "
                    f"default_cash={default_cash}, pea_sec={pea_sec}, pea_cash={pea_cash}"
                )
            except Exception as e:
                logger.warning(f"[TR] Failed to parse JWT claims: {e}")

        return TRAccountStructure(
            default_sec=default_sec,
            default_cash=default_cash,
            pea_sec=pea_sec,
            pea_cash=pea_cash,
        )

    async def fetch_portfolio(self, session: TRSession) -> list[TRPosition]:
        """Fetch all investment positions using portfolioPositions endpoint."""
        # Primary: portfolioPositions (returns positions per secAccNo)
        data = None
        for sub_type in ("portfolioPositions", "compactPortfolio"):
            try:
                data = await self._ws_subscribe(session, {"type": sub_type})
                logger.info(f"[TR] Portfolio fetched via '{sub_type}'")
                break
            except TradeRepublicSessionExpiredError:
                raise
            except TradeRepublicError as e:
                logger.warning(f"[TR] Portfolio fetch via '{sub_type}' failed: {e}")
                continue

        if data is None:
            logger.warning("[TR] All portfolio subscription types failed")
            return []

        logger.info(f"[TR] Portfolio raw response type={type(data).__name__}, preview={str(data)[:500]}")

        positions: list[TRPosition] = []

        if isinstance(data, dict) and "accountPositions" in data:
            # portfolioPositions format: {accountPositions: [{secAccNo, positions: [{isin, netSize, averageBuyIn: {value, currency}}]}]}
            for acc in data.get("accountPositions", []):
                sec_acc_no = acc.get("secAccNo", "")
                for pos in acc.get("positions", []):
                    try:
                        isin = pos.get("isin", "")
                        net_size = float(pos.get("netSize", 0))
                        if net_size <= 0:
                            continue

                        avg_buy_in = pos.get("averageBuyIn", {})
                        if isinstance(avg_buy_in, dict):
                            avg_price = float(avg_buy_in.get("value", 0))
                        else:
                            avg_price = float(avg_buy_in or 0)

                        # Name will be resolved later via fetch_instrument
                        name = isin

                        # Heuristic asset type
                        asset_type = "stock"
                        if isin.startswith("XF"):
                            asset_type = "crypto"

                        positions.append(TRPosition(
                            isin=isin,
                            name=name,
                            quantity=net_size,
                            buy_price_avg=avg_price,
                            current_price=avg_price,  # will be updated with real price
                            currency=avg_buy_in.get("currency", "EUR") if isinstance(avg_buy_in, dict) else "EUR",
                            asset_type=asset_type,
                            sec_acc_no=sec_acc_no,
                        ))
                    except (ValueError, TypeError) as e:
                        logger.warning(f"[TR] Skipping position: {e}")

        elif isinstance(data, dict) and "positions" in data:
            # compactPortfolio format (legacy fallback)
            for pos in data.get("positions", []):
                try:
                    net_size = float(pos.get("netSize", 0))
                    if net_size <= 0:
                        continue
                    avg_price = float(pos.get("averageBuyIn", 0))
                    current_price = float(pos.get("netValue", 0)) / net_size if net_size else 0
                    isin = pos.get("instrumentId", "")
                    name = pos.get("name", isin)
                    asset_type = "stock"
                    if isin.startswith("XF"):
                        asset_type = "crypto"
                    positions.append(TRPosition(
                        isin=isin, name=name, quantity=net_size,
                        buy_price_avg=avg_price, current_price=current_price,
                        currency=pos.get("currency", "EUR"), asset_type=asset_type,
                    ))
                except (ValueError, TypeError, ZeroDivisionError) as e:
                    logger.warning(f"[TR] Skipping position: {e}")

        logger.info(f"[TR] Fetched {len(positions)} positions")
        return positions

    async def fetch_current_price(self, session: TRSession, isin: str) -> float | None:
        """
        Fetch the current price for an instrument via the ticker subscription.
        Returns the price in EUR, or None if not available.
        """
        try:
            # Try homeInstrumentExchange first to get the default exchange
            exchange_data = await self._ws_subscribe(
                session, {"type": "homeInstrumentExchange", "id": isin}, timeout=8,
            )
            exchange_id = "LSX"  # default
            if isinstance(exchange_data, dict):
                exchange_id = exchange_data.get("exchangeId", "LSX")
        except Exception:
            exchange_id = "LSX"

        try:
            data = await self._ws_subscribe(
                session,
                {"type": "ticker", "id": f"{isin}.{exchange_id}"},
                timeout=8,
            )
            if isinstance(data, dict):
                # Ticker returns bid/ask/last
                price = data.get("last", data.get("bid", data.get("ask", {})))
                if isinstance(price, dict):
                    return float(price.get("price", 0))
                elif isinstance(price, (int, float)):
                    return float(price)
            logger.debug(f"[TR] Ticker {isin}: {str(data)[:200]}")
        except TradeRepublicSessionExpiredError:
            raise
        except Exception as e:
            logger.warning(f"[TR] Price fetch failed for {isin}: {e}")

        return None

    async def fetch_cash(self, session: TRSession) -> TRCash:
        """Fetch cash account balance."""
        try:
            data = await self._ws_subscribe(session, {"type": "cash"})
        except TradeRepublicSessionExpiredError:
            raise  # Always propagate session expiry
        except TradeRepublicError as e:
            logger.warning(f"[TR] Cash fetch failed: {e}")
            return TRCash(balance=0.0, currency="EUR")

        logger.debug(f"[TR] Cash raw response type={type(data).__name__}: {str(data)[:300]}")

        # TR may return a list (e.g. [{...}]) or a dict
        if isinstance(data, list):
            data = data[0] if data else {}
        if not isinstance(data, dict):
            logger.warning(f"[TR] Unexpected cash data type: {type(data).__name__}")
            return TRCash(balance=0.0, currency="EUR")

        balance = float(data.get("value", data.get("amount", data.get("balance", 0))))

        return TRCash(
            balance=balance,
            currency=data.get("currency", data.get("currencyId", "EUR")),
            iban=data.get("iban"),
        )

    async def fetch_timeline(
        self,
        session: TRSession,
        max_events: int = 100,
    ) -> list[TRTimelineEvent]:
        """
        Fetch recent timeline events (transactions).
        Paginates through timeline pages up to max_events.
        Tries timelineTransactions first (has amounts), then timelineActivityLog.
        """
        events: list[TRTimelineEvent] = []
        cursor: str | None = None

        for page in range(MAX_TIMELINE_PAGES):
            # timelineTransactions has real amounts; timelineActivityLog is fallback
            sub_types = ["timelineTransactions", "timelineActivityLog", "timeline", "timelineV2"]
            data = None
            for sub_type in sub_types:
                sub: dict = {"type": sub_type}
                if cursor:
                    sub["after"] = cursor
                try:
                    data = await self._ws_subscribe(session, sub)
                    if page == 0:
                        logger.info(f"[TR] Timeline fetched via '{sub_type}'")
                    break
                except TradeRepublicSessionExpiredError:
                    raise
                except TradeRepublicError as e:
                    logger.warning(f"[TR] Timeline via '{sub_type}' page {page} failed: {e}")
                    continue

            if data is None:
                logger.warning(f"[TR] All timeline subscription types failed on page {page}")
                break

            logger.info(f"[TR] Timeline page {page} raw type={type(data).__name__}, preview={str(data)[:500]}")

            # TR may return a list directly or a dict with data/entries/items key
            if isinstance(data, list):
                raw_events = data
            elif isinstance(data, dict):
                raw_events = data.get("data", data.get("entries", data.get("items", data.get("sections", []))))
                # If raw_events is still not a list, scan for any list key
                if not isinstance(raw_events, list):
                    for k, v in data.items():
                        if isinstance(v, list) and v:
                            logger.info(f"[TR] Found timeline entries in key '{k}'")
                            raw_events = v
                            break
                    else:
                        logger.warning(f"[TR] No list key in timeline dict, keys: {list(data.keys())}")
                        raw_events = []
            else:
                logger.warning(f"[TR] Unexpected timeline data type: {type(data).__name__}")
                break

            if not raw_events:
                break

            for ev in raw_events:
                try:
                    # Parse amount from data/body
                    amount_val = 0.0
                    amount_data = ev.get("amount", {})
                    if isinstance(amount_data, dict):
                        amount_val = float(amount_data.get("value", 0))
                    elif isinstance(amount_data, (int, float)):
                        amount_val = float(amount_data)

                    # Parse date
                    ts = ev.get("timestamp", ev.get("date", ""))
                    if isinstance(ts, str) and ts:
                        try:
                            event_date = datetime.fromisoformat(
                                ts.replace("Z", "+00:00").replace("+0000", "+00:00")
                            ).date()
                        except ValueError:
                            event_date = date.today()
                    else:
                        event_date = date.today()

                    event_type = ev.get("eventType") or ev.get("type") or "UNKNOWN"
                    title = ev.get("title", ev.get("body", "Transaction"))
                    subtitle = ev.get("subtitle", "")

                    # Determine sign based on event type or existing sign
                    if amount_val != 0:
                        # timelineTransactions already has signed amounts
                        pass
                    elif event_type and isinstance(event_type, str):
                        if "OUTBOUND" in event_type or "BUY" in event_type:
                            amount_val = -abs(amount_val)
                        elif "INBOUND" in event_type or "SELL" in event_type or "DIVIDEND" in event_type:
                            amount_val = abs(amount_val)

                    # Infer event_type from subtitle if missing
                    if event_type == "UNKNOWN" and subtitle:
                        sub_lower = subtitle.lower()
                        if any(k in sub_lower for k in ["retrait", "withdrawal"]):
                            event_type = "CARD_ATM"
                        elif any(k in sub_lower for k in ["carte", "card", "paiement"]):
                            event_type = "CARD_PAYMENT"
                        elif any(k in sub_lower for k in ["virement reçu", "received", "incoming", "dépôt", "depot"]):
                            event_type = "PAYMENT_INBOUND"
                        elif any(k in sub_lower for k in ["virement", "transfer", "sent"]):
                            event_type = "PAYMENT_OUTBOUND"
                        elif any(k in sub_lower for k in ["intérêt", "interest", "dividende"]):
                            event_type = "INTEREST_PAYOUT"
                        elif any(k in sub_lower for k in ["achat", "buy", "exécution", "actions reçues"]):
                            event_type = "SAVINGS_PLAN_INVOICE"
                        elif any(k in sub_lower for k in ["round up", "arrondi"]):
                            event_type = "ROUND_UP"
                        elif any(k in sub_lower for k in ["remboursement", "refund"]):
                            event_type = "CARD_REFUND"

                    events.append(TRTimelineEvent(
                        event_id=ev.get("id", uuid.uuid4().hex[:12]),
                        event_type=event_type,
                        title=title,
                        amount=amount_val,
                        date=event_date,
                        icon=ev.get("icon"),
                        subtitle=subtitle or "",
                    ))
                except Exception as e:
                    logger.warning(f"[TR] Skipping timeline event: {e}")
                    continue

            # Pagination
            cursors = data.get("cursors", {}) if isinstance(data, dict) else {}
            cursor = cursors.get("after") if isinstance(cursors, dict) else None
            if not cursor:
                break

            if len(events) >= max_events:
                break

        logger.info(f"[TR] Fetched {len(events)} timeline events")
        return events[:max_events]

    # ── Savings Plans ────────────────────────────────────────

    async def fetch_savings_plans(self, session: TRSession) -> list[TRSavingsPlan]:
        """Fetch active savings plans (plans d'investissement programmés)."""
        try:
            data = await self._ws_subscribe(session, {"type": "savingsPlans"})
        except TradeRepublicSessionExpiredError:
            raise
        except TradeRepublicError as e:
            logger.warning(f"[TR] Savings plans fetch failed: {e}")
            return []

        logger.info(f"[TR] SavingsPlans raw type={type(data).__name__}: {str(data)[:500]}")

        raw_plans: list = []
        if isinstance(data, list):
            raw_plans = data
        elif isinstance(data, dict):
            raw_plans = data.get("savingsPlans", data.get("items", []))

        plans: list[TRSavingsPlan] = []
        for sp in raw_plans:
            if not isinstance(sp, dict):
                continue
            try:
                plans.append(TRSavingsPlan(
                    savings_plan_id=sp.get("id", uuid.uuid4().hex[:12]),
                    isin=sp.get("instrumentId", sp.get("isin", "")),
                    name=sp.get("name", sp.get("instrumentId", "Plan d'épargne")),
                    amount=float(sp.get("amount", sp.get("value", 0))),
                    interval=sp.get("interval", sp.get("frequency", "monthly")),
                    is_active=sp.get("isActive", sp.get("active", True)),
                ))
            except Exception as e:
                logger.warning(f"[TR] Skipping savings plan: {e}")
        logger.info(f"[TR] Fetched {len(plans)} savings plans")
        return plans

    # ── Interest / Saveback ──────────────────────────────────

    async def fetch_interest(self, session: TRSession) -> TRInterestDetail | None:
        """
        Fetch interest details (rémunération espèces / Saveback).
        TR subscription types: 'interest', 'savingsInterest', 'interestDetails'.
        """
        # Try several subscription types — TR changed these over versions
        for sub_type in ("interestDetails", "interest", "savingsInterest"):
            try:
                data = await self._ws_subscribe(session, {"type": sub_type}, timeout=10)
                logger.info(f"[TR] Interest ({sub_type}) raw type={type(data).__name__}: {str(data)[:500]}")

                if isinstance(data, list):
                    data = data[0] if data else {}
                if not isinstance(data, dict):
                    continue

                accrued = float(
                    data.get("accruedInterest",
                    data.get("currentInterest",
                    data.get("value",
                    data.get("amount", 0))))
                )
                rate = float(
                    data.get("annualRate",
                    data.get("interestRate",
                    data.get("rate", 0)))
                )

                next_payout = None
                np_str = data.get("nextPayoutDate", data.get("nextPayout", ""))
                if isinstance(np_str, str) and np_str:
                    try:
                        next_payout = datetime.fromisoformat(
                            np_str.replace("Z", "+00:00")
                        ).date()
                    except ValueError:
                        pass

                logger.info(f"[TR] Interest: accrued={accrued}, rate={rate}")
                return TRInterestDetail(
                    accrued_interest=accrued,
                    annual_rate=rate,
                    currency=data.get("currency", data.get("currencyId", "EUR")),
                    next_payout_date=next_payout,
                )
            except TradeRepublicSessionExpiredError:
                raise
            except TradeRepublicError:
                continue
        return None

    # ── Instrument Details ────────────────────────────────────

    async def fetch_instrument(self, session: TRSession, isin: str) -> dict | None:
        """
        Fetch instrument details for a given ISIN.
        Returns dict with typeId (stock/fund/crypto/bond/warrant/derivative),
        shortName, homeSymbol, exchangeIds, etc.
        """
        try:
            data = await self._ws_subscribe(
                session,
                {"type": "instrument", "id": isin},
                timeout=10,
            )
            if isinstance(data, list):
                data = data[0] if data else {}
            logger.debug(f"[TR] Instrument {isin}: {str(data)[:300]}")
            return data if isinstance(data, dict) else None
        except TradeRepublicSessionExpiredError:
            raise
        except TradeRepublicError as e:
            logger.warning(f"[TR] Instrument fetch failed for {isin}: {e}")
            return None

    async def fetch_portfolio_classified(
        self, session: TRSession,
    ) -> list[TRPosition]:
        """
        Fetch portfolio positions, classify each as stock/etf/crypto/bond,
        resolve names, and fetch current prices.
        """
        positions = await self.fetch_portfolio(session)
        if not positions:
            return positions

        for pos in positions:
            # 1. Fast heuristic: crypto ISINs on TR start with "XF"
            if pos.isin.startswith("XF"):
                pos.asset_type = "crypto"
                continue

            # 2. Try to fetch instrument detail from TR API
            instrument = await self.fetch_instrument(session, pos.isin)
            if instrument:
                type_id = str(instrument.get("typeId", "")).lower()
                if type_id == "crypto":
                    pos.asset_type = "crypto"
                elif type_id in ("fund", "etf"):
                    pos.asset_type = "etf"
                elif type_id == "bond":
                    pos.asset_type = "bond"
                elif type_id in ("stock", "equity"):
                    pos.asset_type = "stock"
                else:
                    pos.asset_type = "stock"  # default

                # Resolve name from instrument shortName
                short_name = instrument.get("shortName", "")
                if short_name:
                    pos.name = short_name
                elif instrument.get("homeSymbol"):
                    pos.name = instrument["homeSymbol"]
                continue

            # 3. Fallback heuristic: name-based
            name_lower = pos.name.lower()
            if any(k in name_lower for k in ("etf", "ishares", "xtrackers", "lyxor", "amundi", "vanguard", "spdr")):
                pos.asset_type = "etf"
            elif any(k in name_lower for k in ("bitcoin", "ethereum", "solana", "cardano", "polkadot", "ripple", "dogecoin", "litecoin", "crypto")):
                pos.asset_type = "crypto"
            else:
                pos.asset_type = "stock"

        # Fetch current prices for all positions
        for pos in positions:
            try:
                price = await self.fetch_current_price(session, pos.isin)
                if price is not None and price > 0:
                    pos.current_price = price
                    logger.info(
                        f"[TR] {pos.isin} ({pos.name}): {pos.quantity:.4f} × {price:.2f}€ = "
                        f"{pos.quantity * price:.2f}€"
                    )
            except TradeRepublicSessionExpiredError:
                raise
            except Exception as e:
                logger.warning(f"[TR] Price fetch error for {pos.isin}: {e}")

        # Log classification summary
        types = {}
        for p in positions:
            types[p.asset_type] = types.get(p.asset_type, 0) + 1
        total_value = sum(p.current_price * p.quantity for p in positions)
        logger.info(f"[TR] Classified {len(positions)} positions: {types}, total={total_value:.2f}€")

        return positions

    # ── Experience / Account Info ─────────────────────────────

    async def fetch_experience(self, session: TRSession) -> dict | None:
        """Fetch user experience/profile info (account type, verified status, etc.)."""
        try:
            data = await self._ws_subscribe(session, {"type": "experience"}, timeout=10)
            if isinstance(data, list):
                data = data[0] if data else {}
            logger.debug(f"[TR] Experience: {str(data)[:300]}")
            return data if isinstance(data, dict) else None
        except TradeRepublicError:
            return None


# ── TR-specific Exceptions ───────────────────────────────────

class TradeRepublicError(Exception):
    """Base error for Trade Republic API calls."""
    pass


class TradeRepublicAuthError(TradeRepublicError):
    """Authentication failed (bad credentials or 2FA code)."""
    pass


class TradeRepublicRateLimitError(TradeRepublicError):
    """Rate limited by Trade Republic."""
    pass


class TradeRepublicSessionExpiredError(TradeRepublicError):
    """Session token expired — need to re-authenticate."""
    pass


# ── Helpers ──────────────────────────────────────────────────

def map_tr_event_to_transaction_type(event_type: str) -> str:
    """Map TR event types to OmniFlow transaction types."""
    if not event_type or event_type == "UNKNOWN":
        return "other"
    mapping = {
        "PAYMENT_INBOUND": "transfer",
        "PAYMENT_OUTBOUND": "transfer",
        "PAYMENT_INBOUND_SEPA": "transfer",
        "PAYMENT_OUTBOUND_SEPA": "transfer",
        "CARD_PAYMENT": "card",
        "CARD_ATM": "atm",
        "CARD_REFUND": "card",
        "TRADE_INVOICE": "transfer",      # buy/sell order
        "DIVIDEND": "interest",
        "INTEREST_PAYOUT": "interest",
        "INTEREST_PAYOUT_CREATED": "interest",
        "SAVINGS_PLAN_INVOICE": "transfer",
        "ROUND_UP": "transfer",
        "SSP_CORPORATE_ACTION_INVOICE_CASH": "transfer",
        "SSP_SECURITIES_TRANSFER_INCOMING": "transfer",
        "CREDIT": "transfer",
        "BENEFIT_CARD_CASHBACK": "card",
    }
    return mapping.get(event_type, "other")


def map_tr_event_to_category(event_type: str, title: str) -> tuple[str, str]:
    """Map TR event to category/subcategory based on type and title."""
    title_lower = (title or "").lower()
    event_type = event_type or "UNKNOWN"

    if event_type in ("DIVIDEND", "INTEREST_PAYOUT", "INTEREST_PAYOUT_CREATED"):
        return "Revenus", "Intérêts / Dividendes"

    if event_type == "CARD_ATM":
        return "Cash", "Retrait DAB"

    if event_type in ("CARD_PAYMENT", "CARD_REFUND", "BENEFIT_CARD_CASHBACK"):
        # Try to categorize by title
        if any(k in title_lower for k in ["carrefour", "leclerc", "aldi", "lidl", "monoprix"]):
            return "Alimentation", "Courses"
        if any(k in title_lower for k in ["sncf", "ratp", "uber", "bolt", "taxi"]):
            return "Transport", "Déplacement"
        if any(k in title_lower for k in ["amazon", "fnac", "zalando"]):
            return "Shopping", "E-commerce"
        if any(k in title_lower for k in ["restaurant", "mcdonald", "burger", "sushi"]):
            return "Alimentation", "Restaurant"
        return "Shopping", "Carte bancaire"

    if event_type in ("TRADE_INVOICE", "SAVINGS_PLAN_INVOICE", "SSP_SECURITIES_TRANSFER_INCOMING"):
        return "Épargne", "Investissement"

    if event_type in ("PAYMENT_INBOUND", "PAYMENT_INBOUND_SEPA"):
        if any(k in title_lower for k in ["salaire", "salary", "paie"]):
            return "Revenus", "Salaire"
        return "Revenus", "Virement reçu"

    if event_type in ("PAYMENT_OUTBOUND", "PAYMENT_OUTBOUND_SEPA"):
        return "Virements", "Virement émis"

    # Fallback: try to infer from title/subtitle for events with UNKNOWN type
    if "retrait" in title_lower:
        return "Cash", "Retrait DAB"
    if "virement" in title_lower:
        return "Virements", "Virement"
    if any(k in title_lower for k in ["carte", "card"]):
        return "Shopping", "Carte bancaire"

    return "Autres", "Non catégorisé"
