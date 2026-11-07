"""Main entry point for CerviSetu Clinical AI and Dashboard Server."""
import argparse
import sys
import uvicorn

# Ensure UTF-8 stdout encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass



def start_server(host: str = "127.0.0.1", port: int = 8000):
    """Start the FastAPI application with Uvicorn."""
    print(f"Starting CerviSetu Dashboard on http://{host}:{port}...")
    uvicorn.run("backend.dashboard.app:app", host=host, port=port, reload=False)


def main():
    parser = argparse.ArgumentParser(description="CerviSetu Clinical Diagnostic AI & Tracker")
    parser.add_argument("--serve", action="store_true", help="Launch the FastAPI Web Dashboard")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Server host")
    parser.add_argument("--port", type=int, default=8000, help="Server port")

    args = parser.parse_args()

    if args.serve or len(sys.argv) == 1:
        # Default action
        start_server(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
