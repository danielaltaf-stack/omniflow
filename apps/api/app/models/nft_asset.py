"""
OmniFlow — NFT Asset model.
Digital collectibles with floor price tracking across blockchains.
"""

import enum

from sqlalchemy import BigInteger, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class Blockchain(str, enum.Enum):
    ETHEREUM = "ethereum"
    POLYGON = "polygon"
    SOLANA = "solana"
    OTHER = "other"


class NFTAsset(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "nft_assets"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Identification
    collection_name = Column(String(255), nullable=False)
    token_id = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    blockchain = Column(String(20), nullable=False, default=Blockchain.ETHEREUM.value)
    contract_address = Column(String(255), nullable=True)

    # Values
    purchase_price_eth = Column(Float, nullable=True)
    purchase_price_eur = Column(BigInteger, nullable=True)  # centimes
    current_floor_eur = Column(BigInteger, nullable=True)    # centimes

    # Marketplace
    marketplace = Column(String(100), nullable=True)
    marketplace_url = Column(String(500), nullable=True)

    # Media
    image_url = Column(Text, nullable=True)
    animation_url = Column(Text, nullable=True)

    # Tracking
    last_price_update = Column(DateTime(timezone=True), nullable=True)
    rarity_rank = Column(Integer, nullable=True)
    traits = Column(JSONB, nullable=False, default=dict)
    extra_data = Column(JSONB, nullable=False, default=dict)
