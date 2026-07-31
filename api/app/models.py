"""SQLAlchemy models — column-for-column match of the existing SQLite file
created by server.js's initDb() (including everything ensureColumn() bolted
on over time), so Alembic's initial migration is a no-op against real data
and the file can be pointed at directly with zero data migration.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Meta(Base):
    __tablename__ = "meta"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    login_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    favicon_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    color: Mapped[str] = mapped_column(Text, nullable=False, default="")
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    provider_id: Mapped[str] = mapped_column(Text, nullable=False, default="")
    expires_at: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ip: Mapped[str] = mapped_column(Text, nullable=False, default="")
    domain: Mapped[str] = mapped_column(Text, nullable=False, default="")
    country_code: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    inactive: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    category: Mapped[str] = mapped_column(Text, nullable=False, default="")
    price: Mapped[float] = mapped_column(nullable=False, default=0)
    price_currency: Mapped[str] = mapped_column(Text, nullable=False, default="USDT")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    payments: Mapped[list["Payment"]] = relationship(
        back_populates="asset", cascade="all, delete-orphan", passive_deletes=True
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_id: Mapped[str] = mapped_column(Text, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0)
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="USDT")
    paid_at: Mapped[str] = mapped_column(Text, nullable=False, default="")
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    asset: Mapped[Asset] = relationship(back_populates="payments")


class TelegramSent(Base):
    __tablename__ = "telegram_sent"

    event_id: Mapped[str] = mapped_column(Text, primary_key=True)
    sent_at: Mapped[str] = mapped_column(Text, nullable=False)


class BotRevenueMonthly(Base):
    __tablename__ = "bot_revenue_monthly"

    month: Mapped[str] = mapped_column(Text, primary_key=True)
    total_kopeks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    login: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    password_salt: Mapped[str] = mapped_column(Text, nullable=False)
    totp_secret: Mapped[str] = mapped_column(Text, nullable=False, default="")
    totp_pending_secret: Mapped[str] = mapped_column(Text, nullable=False, default="")
    totp_enabled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)


# ─── Bedolaga sync (Phase 2) ────────────────────────────────────────────
# Primary keys here reuse Bedolaga's own integer ids directly (unlike the
# UUID-string ids everywhere else in this file, which server.js generates
# itself) — these rows mirror records that already have a stable identity
# in an external system, so inventing our own id would just add an
# unnecessary join key.


class BedolagaTransaction(Base):
    __tablename__ = "bedolaga_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    amount_kopeks: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    completed_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    synced_at: Mapped[str] = mapped_column(Text, nullable=False)


class BedolagaSubscription(Base):
    __tablename__ = "bedolaga_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    actual_status: Mapped[str] = mapped_column(Text, nullable=False)
    is_trial: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    start_date: Mapped[str] = mapped_column(Text, nullable=False)
    end_date: Mapped[str] = mapped_column(Text, nullable=False)
    traffic_limit_gb: Mapped[float] = mapped_column(nullable=False, default=0)
    traffic_used_gb: Mapped[float] = mapped_column(nullable=False, default=0)
    device_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    autopay_enabled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    synced_at: Mapped[str] = mapped_column(Text, nullable=False)


class BedolagaSubscriptionDaily(Base):
    """Daily rollup of bedolaga_subscriptions, since that table is upserted
    to current-state on every sync and doesn't retain history on its own —
    this is the only place subscriber-count-over-time is preserved."""

    __tablename__ = "bedolaga_subscription_daily"

    date: Mapped[str] = mapped_column(Text, primary_key=True)
    status: Mapped[str] = mapped_column(Text, primary_key=True)
    is_trial: Mapped[int] = mapped_column(Integer, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class BedolagaUser(Base):
    __tablename__ = "bedolaga_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    # Nullable: confirmed against real data that website-only signups (no
    # Telegram account linked) have telegram_id=None — the dual bot+website
    # sales model this whole project is built around.
    telegram_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    referred_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    has_had_paid_subscription: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    synced_at: Mapped[str] = mapped_column(Text, nullable=False)
