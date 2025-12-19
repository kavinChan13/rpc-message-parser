#!/usr/bin/env python3
"""
Run the FastAPI application
"""

import uvicorn
import logging

if __name__ == "__main__":
    # Configure log level
    # INFO: Show important info and errors
    # WARNING: Show only warnings and errors
    # ERROR: Show only errors
    log_level = "info"  # Can be changed to "warning" or "error"

    # Disable uvicorn access log to reduce log noise
    # Set to True if you need to see access logs
    access_log = False

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level=log_level,
        access_log=access_log
    )
