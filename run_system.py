#!/usr/bin/env python3
"""
TechHunters Smart Hospital Optimization & Emergency Response System
Main System Launcher
"""

import os
import sys
import webbrowser

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    print("==================================================================")
    print("  TechHunters · Smart Hospital Optimization & Emergency Response")
    print("  Innovative Conclave · Syam Sundar Reddy, Vishal, Nikhil")
    print("==================================================================")
    
    # 1. Check data files
    import app.database
    print(">>> Verifying database and tables...")
    app.database.init_db()

    # 2. Run Server
    import app.server
    port = int(os.environ.get("PORT", 3000))
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass

    host = os.environ.get("HOST", "0.0.0.0")

    display_host = "localhost" if host == "0.0.0.0" else host
    print(f"\n>>> Starting server for Smart Hospital System...")
    print(f">>> Primary Localhost: http://{display_host}:{port}")
    print(f">>> Localhost IP:      http://127.0.0.1:{port}")
    print(f">>> Press Ctrl+C to terminate the server.\n")

    # Only open browser automatically on local desktop, not in cloud containers
    if not os.environ.get("RENDER") and not os.environ.get("DYNO") and not os.environ.get("CI") and not os.environ.get("NO_BROWSER"):
        try:
            webbrowser.open(f"http://localhost:{port}")
        except Exception:
            pass

    app.server.run_server(host=host, port=port)

if __name__ == "__main__":
    main()
