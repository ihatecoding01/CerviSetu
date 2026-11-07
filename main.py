"""Main entry point for CerviSetu Clinical AI and Dashboard Server."""
import argparse
import os
import sys
import uvicorn

# Ensure UTF-8 stdout encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def get_default_host() -> str:
    # On Render, Railway, Cloud Run or when PORT is provided, bind to 0.0.0.0
    return os.getenv("HOST", "0.0.0.0" if (os.getenv("PORT") or os.getenv("RENDER")) else "127.0.0.1")


def get_default_port() -> int:
    return int(os.getenv("PORT", 8000))


def start_server(host: str = None, port: int = None):
    """Start the FastAPI application with Uvicorn."""
    host = host or get_default_host()
    port = port or get_default_port()
    print(f"Starting CerviSetu Dashboard on http://{host}:{port}...")
    uvicorn.run("backend.dashboard.app:app", host=host, port=port, reload=False)


def main():
    parser = argparse.ArgumentParser(description="CerviSetu Clinical Diagnostic AI & Tracker")
    parser.add_argument("--serve", action="store_true", help="Launch the FastAPI Web Dashboard")
    parser.add_argument("--host", type=str, default=get_default_host(), help="Server host (default: 0.0.0.0 on Render / 127.0.0.1 locally)")
    parser.add_argument("--port", type=int, default=get_default_port(), help="Server port (default: $PORT or 8000)")

    args = parser.parse_args()

    if args.serve or len(sys.argv) == 1:
        # Default action
        start_server(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
