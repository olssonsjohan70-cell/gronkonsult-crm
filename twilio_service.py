import os
from typing import Optional


class TwilioService:
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.from_number = os.getenv("TWILIO_FROM_NUMBER", "")
        self.your_number = os.getenv("YOUR_PHONE_NUMBER", "")
        self.base_url = os.getenv("BASE_URL", "http://localhost:8000")
        self.enabled = bool(self.account_sid and self.auth_token and self.from_number)

    def initiate_call(self, to_number: str, lead_id: int) -> dict:
        """
        Initiates an outbound call via Twilio.
        Flow: Twilio calls YOUR phone → you answer → Twilio connects to lead.
        """
        if not self.enabled:
            return {
                "success": False,
                "error": "Twilio inte konfigurerat. Lägg till TWILIO_* i .env filen."
            }
        
        try:
            from twilio.rest import Client
            client = Client(self.account_sid, self.auth_token)
            
            # TwiML that connects you to the lead when you answer
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="sv-SE">Kopplar upp samtal...</Say>
    <Dial record="record-from-ringing" 
          recordingStatusCallback="{self.base_url}/api/calls/recording-callback"
          action="{self.base_url}/api/calls/dial-complete/{lead_id}">
        <Number>{to_number}</Number>
    </Dial>
</Response>"""
            
            call = client.calls.create(
                to=self.your_number,  # First calls YOU
                from_=self.from_number,
                twiml=twiml,
                status_callback=f"{self.base_url}/api/calls/status-callback",
                status_callback_method="POST",
                record=True
            )
            
            return {"success": True, "call_sid": call.sid}
            
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_recording_url(self, recording_sid: str) -> Optional[str]:
        if not self.enabled:
            return None
        try:
            from twilio.rest import Client
            client = Client(self.account_sid, self.auth_token)
            recording = client.recordings(recording_sid).fetch()
            return f"https://api.twilio.com{recording.uri.replace('.json', '.mp3')}"
        except Exception:
            return None

    def get_call_details(self, call_sid: str) -> Optional[dict]:
        if not self.enabled:
            return None
        try:
            from twilio.rest import Client
            client = Client(self.account_sid, self.auth_token)
            call = client.calls(call_sid).fetch()
            return {
                "status": call.status,
                "duration": call.duration,
                "direction": call.direction,
            }
        except Exception:
            return None
