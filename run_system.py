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
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass

    print(f"\n>>> Launching application server on http://127.0.0.1:{port}")
    print(f">>> Press Ctrl+C to terminate the server.\n")

    try:
        webbrowser.open(f"http://127.0.0.1:{port}")
    except Exception:
        pass

    app.server.run_server(port=port)

if __name__ == "__main__":
    main()
