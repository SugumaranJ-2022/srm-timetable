import logging
import smtplib
from abc import ABC, abstractmethod
from email.message import EmailMessage
from typing import Dict, List, Optional
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class EmailAdapter(ABC):
    @abstractmethod
    def send_email(self, to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
        pass


class MockEmailAdapter(EmailAdapter):
    """
    Development and testing email adapter.
    Captures sent messages in memory for test verification without needing a real SMTP server.
    """
    def __init__(self):
        self._sent_messages: List[Dict[str, str]] = []

    def send_email(self, to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
        record = {
            "to": to_email,
            "subject": subject,
            "html": html_content,
            "text": text_content or html_content
        }
        self._sent_messages.append(record)
        logger.info(f"[MOCK EMAIL] Sent to: {to_email} | Subject: '{subject}'")
        return True

    def get_last_email(self, to_email: Optional[str] = None) -> Optional[Dict[str, str]]:
        if not self._sent_messages:
            return None
        if to_email:
            for m in reversed(self._sent_messages):
                if m["to"].lower() == to_email.lower():
                    return m
            return None
        return self._sent_messages[-1]

    def get_all_emails(self) -> List[Dict[str, str]]:
        return list(self._sent_messages)

    def clear(self):
        self._sent_messages.clear()


class SMTPEmailAdapter(EmailAdapter):
    """
    Production SMTP email adapter.
    Uses configured server credentials to dispatch real emails via TLS/SSL.
    """
    def send_email(self, to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
        if not settings.SMTP_HOST:
            logger.error("SMTP_HOST not configured. Email cannot be delivered.")
            return False

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email
        msg.set_content(text_content or html_content)
        if html_content:
            msg.add_alternative(html_content, subtype="html")

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"Email successfully delivered to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to dispatch email to {to_email}: {e}")
            return False


def get_email_service() -> EmailAdapter:
    if settings.is_production:
        return SMTPEmailAdapter()
    return mock_email_adapter

# Shared mock adapter instance for development inspectability
mock_email_adapter = MockEmailAdapter()
