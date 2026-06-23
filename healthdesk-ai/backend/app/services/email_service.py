from __future__ import annotations

import asyncio

import resend

from app.core.config import settings


def _frontend_origin() -> str:
    return settings.FRONTEND_URL.split(",")[0].strip().rstrip("/") or "http://localhost:3000"


async def _send_email(payload: dict) -> bool:
    if not settings.RESEND_API_KEY:
        print("[EMAIL] RESEND_API_KEY is not configured; skipping email send")
        return False

    try:
        resend.api_key = settings.RESEND_API_KEY
        result = await asyncio.to_thread(resend.Emails.send, payload)
        print(
            "[EMAIL] Sent "
            f"subject='{payload.get('subject', '')}' "
            f"to={payload.get('to', [])} "
            f"id={getattr(result, 'id', None) or (result.get('id') if isinstance(result, dict) else 'unknown')}"
        )
        return True
    except Exception as exc:
        print(f"[EMAIL] Email send failed: {exc}")
        return False


async def send_escalation_alert(
    clinic_name: str,
    admin_email: str,
    patient_message: str,
    conversation_id: str,
    urgency: str,
    triggered_at: str,
) -> bool:
    subject = f"[URGENT] Emergency Escalation - {clinic_name}"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #EF4444; border-radius: 8px; padding: 16px 24px; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Emergency Escalation Alert</h1>
      </div>
      <div style="background: #FEE2E2; border-left: 4px solid #EF4444; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #991B1B; font-weight: bold;">
          A patient message triggered an emergency escalation and requires immediate staff attention.
        </p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr style="background: #F8FAFC;">
          <td style="padding: 10px 16px; font-weight: bold; color: #64748B; width: 160px;">Clinic</td>
          <td style="padding: 10px 16px; color: #0F172A;">{clinic_name}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; font-weight: bold; color: #64748B;">Urgency Level</td>
          <td style="padding: 10px 16px; color: #EF4444; font-weight: bold; text-transform: uppercase;">{urgency}</td>
        </tr>
        <tr style="background: #F8FAFC;">
          <td style="padding: 10px 16px; font-weight: bold; color: #64748B;">Time</td>
          <td style="padding: 10px 16px; color: #0F172A;">{triggered_at}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; font-weight: bold; color: #64748B;">Conversation ID</td>
          <td style="padding: 10px 16px; font-family: monospace; color: #0F172A;">{conversation_id}</td>
        </tr>
      </table>
      <div style="background: #F8FAFC; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-weight: bold; color: #64748B;">Patient Message:</p>
        <p style="margin: 0; color: #0F172A; font-style: italic;">"{patient_message}"</p>
      </div>
      <div style="background: #0F766E; border-radius: 8px; padding: 16px 24px; text-align: center;">
        <p style="color: white; margin: 0 0 12px; font-weight: bold;">Please review this conversation immediately.</p>
        <a href="{_frontend_origin()}/conversations/{conversation_id}"
           style="background: white; color: #0F766E; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
          View Conversation
        </a>
      </div>
      <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; text-align: center;">
        This is an automated alert from HealthDesk AI. HealthDesk AI does not provide medical advice.
      </p>
    </div>
    """
    return await _send_email(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [admin_email],
            "subject": subject,
            "html": html_body,
        }
    )


async def send_appointment_confirmation(
    patient_email: str,
    patient_name: str,
    clinic_name: str,
    clinic_phone: str,
    provider_name: str,
    service_name: str,
    appointment_date: str,
    appointment_time: str,
    clinic_address: str,
) -> bool:
    subject = f"Appointment Confirmed - {clinic_name}"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #0F766E; border-radius: 8px; padding: 16px 24px; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Your Appointment is Confirmed</h1>
      </div>
      <p style="color: #1E293B; font-size: 16px;">Hi {patient_name}, your appointment has been booked successfully.</p>
      <div style="background: #F0FDFA; border: 1px solid #0F766E; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #0F766E; margin: 0 0 16px; font-size: 18px;">Appointment Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B; width: 140px;">Clinic</td><td style="padding: 8px 0; color: #0F172A;">{clinic_name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Provider</td><td style="padding: 8px 0; color: #0F172A;">{provider_name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Service</td><td style="padding: 8px 0; color: #0F172A;">{service_name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Date</td><td style="padding: 8px 0; color: #0F172A; font-weight: bold;">{appointment_date}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Time</td><td style="padding: 8px 0; color: #0F172A; font-weight: bold;">{appointment_time}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Address</td><td style="padding: 8px 0; color: #0F172A;">{clinic_address}</td></tr>
        </table>
      </div>
      <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #92400E;">
          <strong>What to bring:</strong> A valid photo ID, your insurance card, and any relevant medical records or referral letters if applicable.
        </p>
      </div>
      <p style="color: #64748B; font-size: 14px;">
        Need to reschedule or cancel? Contact us at
        <a href="tel:{clinic_phone}" style="color: #0F766E;">{clinic_phone}</a>.
      </p>
      <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; text-align: center;">
        Sent by HealthDesk AI on behalf of {clinic_name}. HealthDesk AI does not provide medical advice.
      </p>
    </div>
    """
    return await _send_email(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [patient_email],
            "subject": subject,
            "html": html_body,
        }
    )


async def send_appointment_reminder(
    patient_email: str,
    patient_name: str,
    clinic_name: str,
    clinic_phone: str,
    provider_name: str,
    service_name: str,
    appointment_date: str,
    appointment_time: str,
    clinic_address: str,
) -> bool:
    subject = f"Appointment Reminder - {clinic_name}"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #2563EB; border-radius: 8px; padding: 16px 24px; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Appointment Reminder</h1>
      </div>
      <p style="color: #1E293B; font-size: 16px;">Hi {patient_name}, this is a reminder for your upcoming appointment.</p>
      <div style="background: #DBEAFE; border: 1px solid #2563EB; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1E40AF; margin: 0 0 16px; font-size: 18px;">Visit Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B; width: 140px;">Clinic</td><td style="padding: 8px 0; color: #0F172A;">{clinic_name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Provider</td><td style="padding: 8px 0; color: #0F172A;">{provider_name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Service</td><td style="padding: 8px 0; color: #0F172A;">{service_name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Date</td><td style="padding: 8px 0; color: #0F172A; font-weight: bold;">{appointment_date}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Time</td><td style="padding: 8px 0; color: #0F172A; font-weight: bold;">{appointment_time}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #64748B;">Address</td><td style="padding: 8px 0; color: #0F172A;">{clinic_address}</td></tr>
        </table>
      </div>
      <p style="color: #64748B; font-size: 14px;">
        Please arrive 10 minutes early. Need to reschedule or cancel? Contact us at
        <a href="tel:{clinic_phone}" style="color: #0F766E;">{clinic_phone}</a>.
      </p>
      <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; text-align: center;">
        Sent by HealthDesk AI on behalf of {clinic_name}. HealthDesk AI does not provide medical advice.
      </p>
    </div>
    """
    return await _send_email(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [patient_email],
            "subject": subject,
            "html": html_body,
        }
    )


async def send_appointment_email_bundle(
    patient_email: str,
    patient_name: str,
    clinic_name: str,
    clinic_phone: str,
    provider_name: str,
    service_name: str,
    appointment_date: str,
    appointment_time: str,
    clinic_address: str,
) -> dict[str, bool]:
    """Send the immediate booking email.

    Appointment reminders are intentionally not sent here. They are handled by
    the reminder scheduler when an appointment is within the next hour.
    """
    confirmation_sent = await send_appointment_confirmation(
        patient_email=patient_email,
        patient_name=patient_name,
        clinic_name=clinic_name,
        clinic_phone=clinic_phone,
        provider_name=provider_name,
        service_name=service_name,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
        clinic_address=clinic_address,
    )
    return {"confirmation": confirmation_sent, "reminder": False}
