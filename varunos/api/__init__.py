"""
VarunOS API Server (FastAPI).

Exposes the deterministic core to all surfaces:
  /v1/state/snapshot   : morning briefing composite
  /v1/state/weekly     : weekly report composite
  /v1/workouts/program : today's session (after auto-regulation)
  /v1/workouts/log     : log a set, detect PR
  /v1/diet/calc        : compute macros for user
  /v1/diet/log         : log a meal
  /v1/diet/plan        : generate meal plan
  /v1/surveillance/idrs : Indian Diabetes Risk Score
  /v1/surveillance/ascvd : ASCVD risk
  /v1/surveillance/bp  : BP stage
  /v1/surveillance/cgm : CGM metrics
  /v1/surveillance/escalate : emergency escalation
  /v1/readiness        : full readiness composite
  /v1/doctor/share     : generate doctor-share payload
  /healthz             : liveness

All endpoints are PURE: given same input, same output. No state stored on server.
Persistence is the encrypted local vault (client side) + the orchestration layer.
"""
from .server import app

__all__ = ["app"]
