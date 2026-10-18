import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class SMSAdapter(ABC):
    @abstractmethod
    def send_sms(self, to_phone: str, message: str) -> bool:
        pass


class MockSMSAdapter(SMSAdapter):
    """
    Development and testing SMS adapter.
    Captures OTPs in memory for test verification without requiring paid Twilio/carrier services.
    """
    def __init__(self):
        self._sent_messages: List[Dict[str, str]] = []

    def send_sms(self, to_phone: str, message: str) -> bool:
        record = {
            "to": to_phone,
            "message": message
        }
        self._sent_messages.append(record)
        logger.info(f"[MOCK SMS] Sent to: {to_phone} | Message: '{message}'")
        return True

    def get_last_sms(self, to_phone: Optional[str] = None) -> Optional[Dict[str, str]]:
        if not self._sent_messages:
            return None
        if to_phone:
            for m in reversed(self._sent_messages):
                if m["to"] == to_phone:
                    return m
            return None
        return self._sent_messages[-1]

    def get_all_sms(self) -> List[Dict[str, str]]:
        return list(self._sent_messages)

    def clear(self):
        self._sent_messages.clear()


class TwilioSMSAdapter(SMSAdapter):
    """
    Production SMS adapter using Twilio REST API.
    """
    def send_sms(self, to_phone: str, message: str) -> bool:
        if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER):
            logger.error("Twilio credentials not configured. SMS cannot be sent.")
            return False

        try:
            import httpx
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
            data = {
                "To": to_phone,
                "From": settings.TWILIO_FROM_NUMBER,
                "Body": message
            }
            with httpx.Client() as client:
                resp = client.post(
                    url,
                    data=data,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    timeout=10.0
                )
                if resp.status_code in [200, 201]:
                    logger.info(f"SMS successfully sent to {to_phone}")
                    return True
                else:
                    logger.error(f"Twilio API error {resp.status_code}: {resp.text}")
                    return False
        except Exception as e:
            logger.error(f"Failed to dispatch SMS to {to_phone}: {e}")
            return False


def get_sms_service() -> SMSAdapter:
    if settings.is_production:
        return TwilioSMSAdapter()
    return mock_sms_adapter

mock_sms_adapter = MockSMSAdapter()
