import smtplib
import asyncio
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings

logger = logging.getLogger("retailpulse")


class EmailService:
    def _is_configured(self) -> bool:
        return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_FROM_EMAIL)

    async def send_scheduled_report(
        self,
        db: AsyncSession,
        company_id: str,
        recipients: List[str],
        subject: str,
        body: str,
        attachment: Optional[Dict[str, Any]] = None,
    ) -> bool:
        if not self._is_configured():
            logger.warning("SMTP not configured; skipping email delivery")
            return False

        valid_recipients = [r for r in recipients if r and "@" in r]
        if not valid_recipients:
            logger.warning("No valid recipients; skipping email delivery")
            return False

        def _send():
            msg = MIMEMultipart()
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = ", ".join(valid_recipients)
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            if attachment:
                content = attachment.get("content", "")
                filename = attachment.get("filename", "report")

                if isinstance(content, str):
                    raw = content.encode("utf-8")
                else:
                    raw = bytes.fromhex(content)

                part = MIMEBase("application", "octet-stream")
                part.set_payload(raw)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
                msg.attach(part)

            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
            try:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, valid_recipients, msg.as_string())
            finally:
                server.quit()

        try:
            await asyncio.to_thread(_send)
            logger.info("Scheduled report email sent to %d recipients: %s", len(valid_recipients), subject)
            return True
        except Exception as e:
            logger.error("Failed to send scheduled report email: %s", e)
            return False


email_service = EmailService()
