"""
OmniFlow — Fiscal Profile model.
Per-user fiscal configuration: tax household, TMI, envelopes (PEA, PER, AV),
aggregated incomes, and engine results (score, alerts, export).
All monetary values in **centimes** (BigInteger).
"""

import enum

from sqlalchemy import BigInteger, Column, Date, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class TaxHousehold(str, enum.Enum):
    SINGLE = "single"
    COUPLE = "couple"
    FAMILY = "family"


# French income-tax brackets 2026 (per part fiscale, in centimes)
IR_BRACKETS_2026 = [
    (1_149_700, 0.00),    # 0% up to 11 497€
    (2_931_500, 0.11),    # 11% from 11 497€ to 29 315€
    (8_382_300, 0.30),    # 30% from 29 315€ to 83 823€
    (18_029_400, 0.41),   # 41% from 83 823€ to 180 294€
    (None, 0.45),         # 45% above 180 294€
]

# CSG-CRDS rate applied on top of IR
CSG_CRDS_RATE = 0.172

# PFU (flat tax)
PFU_RATE = 0.30
PFU_IR_PART = 0.128
PFU_PS_PART = 0.172

# PER deduction limits 2026 (centimes)
PER_PLAFOND_MIN_CENTIMES = 439_900       # 4 399€
PER_PLAFOND_MAX_CENTIMES = 3_519_400     # 35 194€
PER_PLAFOND_PCT = 0.10                   # 10% of revenu N-1

# PEA ceiling (centimes)
PEA_CEILING_CENTIMES = 15_000_000        # 150 000€

# Crypto abatement (centimes)
CRYPTO_ABATTEMENT_CENTIMES = 30_500      # 305€

# Micro-foncier
MICRO_FONCIER_CEILING_CENTIMES = 1_500_000   # 15 000€
MICRO_FONCIER_ABATEMENT_PCT = 0.30

# Déficit foncier
DEFICIT_FONCIER_CAP_CENTIMES = 1_070_000     # 10 700€/an

# Assurance-Vie abattements after 8 years (centimes)
AV_ABATTEMENT_SINGLE_CENTIMES = 460_000     # 4 600€
AV_ABATTEMENT_COUPLE_CENTIMES = 920_000     # 9 200€

# Dividend abatement on barème option
DIVIDEND_ABATEMENT_PCT = 0.40


class FiscalProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "fiscal_profiles"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ── Situation fiscale ──────────────────────────────────
    tax_household = Column(
        String(16),
        default=TaxHousehold.SINGLE.value,
        nullable=False,
    )
    parts_fiscales = Column(Float, default=1.0, nullable=False)
    tmi_rate = Column(Float, default=30.0, nullable=False)
    revenu_fiscal_ref = Column(BigInteger, default=0, nullable=False)

    # ── PEA ────────────────────────────────────────────────
    pea_open_date = Column(Date, nullable=True)
    pea_total_deposits = Column(BigInteger, default=0, nullable=False)

    # ── PER ────────────────────────────────────────────────
    per_annual_deposits = Column(BigInteger, default=0, nullable=False)
    per_plafond = Column(BigInteger, default=0, nullable=False)

    # ── Assurance-Vie ──────────────────────────────────────
    av_open_date = Column(Date, nullable=True)
    av_total_deposits = Column(BigInteger, default=0, nullable=False)

    # ── Immobilier agrégé ──────────────────────────────────
    total_revenus_fonciers = Column(BigInteger, default=0, nullable=False)
    total_charges_deductibles = Column(BigInteger, default=0, nullable=False)
    deficit_foncier_reportable = Column(BigInteger, default=0, nullable=False)

    # ── Crypto agrégé ──────────────────────────────────────
    crypto_pv_annuelle = Column(BigInteger, default=0, nullable=False)
    crypto_mv_annuelle = Column(BigInteger, default=0, nullable=False)

    # ── Dividendes / PV CTO ────────────────────────────────
    dividendes_bruts_annuels = Column(BigInteger, default=0, nullable=False)
    pv_cto_annuelle = Column(BigInteger, default=0, nullable=False)

    # ── Résultats moteur ───────────────────────────────────
    fiscal_score = Column(Integer, default=0, nullable=False)
    total_economy_estimate = Column(BigInteger, default=0, nullable=False)
    analysis_data = Column(JSONB, default=dict, nullable=False)
    alerts_data = Column(JSONB, default=list, nullable=False)
    export_data = Column(JSONB, default=dict, nullable=False)
