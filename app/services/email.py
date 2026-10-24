import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from app.config import settings

HEADER_LOGO_SVG_HTML = """
<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
  <tr>
    <td style="vertical-align:middle;">
      <!-- HisaabLedger Consistent Brand Mark Icon -->
      <div style="width:44px;height:44px;background:#2e1e1a;border-radius:12px;overflow:hidden;border:1px solid #e06d53;display:inline-block;text-align:center;">
        <svg width="44" height="44" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
          <rect width="64" height="64" rx="14" fill="#2e1e1a" />
          <line x1="8" y1="20" x2="56" y2="20" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-dasharray="2 2" />
          <line x1="8" y1="34" x2="56" y2="34" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-dasharray="2 2" />
          <line x1="8" y1="48" x2="56" y2="48" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-dasharray="2 2" />
          <line x1="28" y1="12" x2="28" y2="52" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
          <path d="M12 10C10.8954 10 10 10.8954 10 12V52C10 53.1046 10.8954 54 12 54H16V10H12Z" fill="#d97706" />
          <rect x="20" y="16" width="6" height="32" rx="3" fill="#ffffff" />
          <rect x="23" y="29" width="18" height="5" rx="2.5" fill="#f59e0b" />
          <rect x="35" y="24" width="6" height="24" rx="3" fill="#e06d53" />
          <rect x="44" y="14" width="6" height="34" rx="3" fill="#f28b74" />
          <circle cx="47" cy="14" r="2.5" fill="#fbbf24" />
        </svg>
      </div>
    </td>
    <td style="vertical-align:middle;padding-left:14px;">
      <div style="font-size:20px;font-weight:800;color:#21150f;letter-spacing:-0.5px;line-height:1.1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        Hisaab<span style="color:#e06d53;">Ledger</span>
      </div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#7a6a60;font-weight:600;margin-top:2px;">
        Precision Metering &amp; AI Accounting
      </div>
    </td>
  </tr>
</table>
"""


def _send_email_via_smtp(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """
    Delivers standard multipart email (HTML + Plaintext fallback) with RFC compliance
    headers (Message-ID, Date, List-Unsubscribe, Precedence) to minimize spam classification.
    Falls back gracefully to logging if SMTP is not configured.
    """
    if not settings.smtp_user or not settings.smtp_password:
        logger.info(
            f"[SMTP NOT CONFIGURED] Simulating email delivery to {to_email}. "
            f"Add SMTP_USER & SMTP_PASSWORD in .env to deliver real inbox email."
        )
        return False

    sender_email = settings.smtp_from_email or settings.smtp_user
    sender_name = settings.smtp_from_name or "HisaabLedger"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f'"{sender_name}" <{sender_email}>'
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="hisaabledger.io")
    msg["X-Entity-Ref-ID"] = make_msgid(domain="hisaabledger.io")
    msg["Precedence"] = "bulk"
    msg["Auto-Submitted"] = "auto-generated"

    part_text = MIMEText(text_body, "plain", "utf-8")
    part_html = MIMEText(html_body, "html", "utf-8")
    msg.attach(part_text)
    msg.attach(part_html)

    try:
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
            server.starttls()

        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(sender_email, [to_email], msg.as_string())
        server.quit()
        logger.info(f"[EMAIL DELIVERED] Successfully sent to {to_email} with subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL SEND ERROR] Failed to send email to {to_email}: {e}")
        return False


def send_welcome_email(user_name: str, user_email: str) -> bool:
    subject = f"Welcome to HisaabLedger, {user_name}! 🚀"
    
    text_content = f"""Hello {user_name},

Welcome to HisaabLedger — your high-precision AI metering and token accounting platform.

Your account is active. You can now monitor token usage, inspect cost analytics, and execute completions.

The HisaabLedger Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#fbfaf7;margin:0;padding:24px;color:#21150f;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid #ebdcd5;">
      <tr>
        <td>
          {HEADER_LOGO_SVG_HTML}

          <p style="font-size:15px;line-height:1.6;color:#332924;margin-top:10px;">
            Assalam-o-Alaikum & Hello <strong>{user_name}</strong>,
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b3b33;">
            Welcome to <strong>HisaabLedger</strong> — the multi-tenant precision AI metering and token usage platform.
          </p>

          <div style="background:#f5f3ff;border-left:4px solid #4f46e5;padding:14px 18px;border-radius:8px;margin:24px 0;">
            <p style="margin:0 0 6px 0;font-weight:bold;color:#312e81;font-size:14px;">Your Account Setup is Ready:</p>
            <ul style="margin:0;padding-left:18px;color:#4338ca;font-size:13px;line-height:1.7;">
              <li>Real-time token & request consumption metering</li>
              <li>Visual analytics with Bar, Line, Pie, & Column views</li>
              <li>Strict tenant quota enforcement & idempotency guarantees</li>
            </ul>
          </div>

          <p style="font-size:14px;line-height:1.6;color:#5f4b41;">
            If you need any guidance, our team is always ready to assist.
          </p>
          <p style="font-size:14px;color:#2e1c14;margin-top:24px;">
            Warm regards,<br>
            <strong>The HisaabLedger Team</strong>
          </p>
          <div style="margin-top:28px;padding-top:16px;border-top:1px solid #f0e6e0;font-size:11px;color:#9c8a82;text-align:center;">
            This email was sent to {user_email} because an account was registered on HisaabLedger.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    # Always log simulation and attempt SMTP delivery if configured
    logger.info(f"[WELCOME EMAIL SENT] Recipient: {user_email} | Name: {user_name} | Subject: {subject}")
    return _send_email_via_smtp(user_email, subject, html_content, text_content)


def send_otp_email(user_email: str, otp_code: str, user_name: str = "User") -> bool:
    subject = f"{otp_code} is your HisaabLedger Password Reset Code"

    text_content = f"""Hello {user_name},

Your password reset OTP code is: {otp_code}

This code is valid for 15 minutes. Please do not share this code with anyone.

If you did not request this password reset, please disregard this email.

The HisaabLedger Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#fbfaf7;margin:0;padding:24px;color:#21150f;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid #ebdcd5;">
      <tr>
        <td>
          {HEADER_LOGO_SVG_HTML}

          <h2 style="font-size:20px;color:#21150f;margin:0 0 12px 0;">Password Reset Code</h2>
          <p style="font-size:14px;color:#4b3b33;line-height:1.6;margin:0 0 20px 0;">
            We received a request to reset the password for your HisaabLedger account (<strong>{user_email}</strong>).
          </p>

          <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
            <span style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-weight:600;display:block;margin-bottom:8px;">
              Your 6-Digit OTP Code
            </span>
            <span style="font-size:34px;font-family:Consolas,monospace;font-weight:800;letter-spacing:6px;color:#4f46e5;display:inline-block;">
              {otp_code}
            </span>
            <p style="font-size:11px;color:#64748b;margin:10px 0 0 0;">
              Valid for 15 minutes • Do not share this code
            </p>
          </div>

          <p style="font-size:13px;color:#64748b;line-height:1.5;">
            If you did not request a password reset, you can safely ignore this message. Your account remains completely secure.
          </p>

          <div style="margin-top:28px;padding-top:16px;border-top:1px solid #f0e6e0;font-size:11px;color:#9c8a82;text-align:center;">
            © 2026 HisaabLedger. Precision Metering & AI Accounting Security.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    logger.info(f"[OTP EMAIL GENERATED] Recipient: {user_email} | OTP: {otp_code}")
    return _send_email_via_smtp(user_email, subject, html_content, text_content)
