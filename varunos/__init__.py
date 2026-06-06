"""
VarunOS — Personal AI Coach Operating System.

A surface-agnostic, n8n-automated, deterministic-core personal coach.
Built for one person. Designed to scale to family.

Architecture:
  - varunos.core        : deterministic numeric spine (pure functions, tested)
  - varunos.data        : JSON content (programs, exercises, foods, templates)
  - varunos.vault       : encrypted medical vault (SQLCipher-bound)
  - varunos.api         : FastAPI server
"""

__version__ = "2.1.1"
__author__ = "VarunOS"
