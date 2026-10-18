import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.future import select
from sqlalchemy import func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.models import SecurityAuditLog

logger = logging.getLogger("security.audit")

async def log_security_event(
    db: AsyncSession,
    event_type: str,
    severity: str = "INFO",
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    email: Optional[str] = None,
    user_id: Optional[int] = None,
    details: Optional[str] = None
) -> SecurityAuditLog:
    """
    Records an enterprise security audit event.
    Automatically logs to standard security logger and commits to database.
    """
    clean_details = (details or "")[:1000]
    
    event = SecurityAuditLog(
        timestamp=datetime.utcnow(),
        event_type=event_type,
        severity=severity.upper(),
        ip_address=ip_address,
        user_agent=(user_agent or "")[:500] if user_agent else None,
        email=email.lower().strip() if email else None,
        user_id=user_id,
        details=clean_details,
        acknowledged=False
    )
    db.add(event)
    await db.flush()
    
    log_msg = f"[SECURITY AUDIT] [{severity}] {event_type} | Account: {email or 'Anonymous'} | IP: {ip_address or 'Unknown'} | {clean_details}"
    if severity in ["CRITICAL", "HIGH"]:
        logger.warning(log_msg)
    else:
        logger.info(log_msg)
        
    return event


async def get_security_events(
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    severity: Optional[str] = None,
    event_type: Optional[str] = None
) -> List[SecurityAuditLog]:
    query = select(SecurityAuditLog)
    if severity:
        query = query.where(SecurityAuditLog.severity == severity.upper())
    if event_type:
        query = query.where(SecurityAuditLog.event_type == event_type)
    
    query = query.order_by(desc(SecurityAuditLog.timestamp)).offset(offset).limit(limit)
    res = await db.execute(query)
    return res.scalars().all()


async def get_security_summary(db: AsyncSession) -> Dict[str, Any]:
    total_res = await db.execute(select(func.count(SecurityAuditLog.id)))
    total_count = total_res.scalar() or 0

    crit_res = await db.execute(select(func.count(SecurityAuditLog.id)).where(SecurityAuditLog.severity == "CRITICAL"))
    crit_count = crit_res.scalar() or 0

    warn_res = await db.execute(select(func.count(SecurityAuditLog.id)).where(SecurityAuditLog.severity == "WARNING"))
    warn_count = warn_res.scalar() or 0

    info_res = await db.execute(select(func.count(SecurityAuditLog.id)).where(SecurityAuditLog.severity == "INFO"))
    info_count = info_res.scalar() or 0

    recent_events = await get_security_events(db, limit=10)
    
    return {
        "total_events": total_count,
        "critical_count": crit_count,
        "warning_count": warn_count,
        "info_count": info_count,
        "recent_events": recent_events
    }


async def acknowledge_event(db: AsyncSession, event_id: int) -> Optional[SecurityAuditLog]:
    res = await db.execute(select(SecurityAuditLog).where(SecurityAuditLog.id == event_id))
    event = res.scalar_one_or_none()
    if event:
        event.acknowledged = True
        await db.commit()
        await db.refresh(event)
    return event
