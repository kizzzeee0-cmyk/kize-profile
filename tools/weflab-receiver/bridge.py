#!/usr/bin/env python3
"""
NAMRA Weflab bridge.

This program DOES NOT reverse-engineer or directly connect to Weflab.
It receives already-normalized roulette events from an authorized local source adapter,
persists them with stable bridge_event_id values, and forwards them to the site API.

Local endpoints (127.0.0.1 only):
  GET  /health
  GET  /config
  POST /event
  POST /preset
  POST /source-status
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib import request, error


@dataclass
class State:
    desired_enabled: bool = False
    alert_url: str = ""
    auto_register: bool = False
    connection_test_challenge: str | None = None
    preset_refresh_request_id: str | None = None
    preset_refresh_requested_at: str | None = None
    monitoring: bool = False
    websocket_connected: bool = False
    source_verified: bool = False
    source_state: str = "waiting_for_source"
    source_error: str = ""
    bridge_version: str = "1.0.0"


class Bridge:
    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.config = json.loads(config_path.read_text(encoding="utf-8"))
        self.site = self.config["site_base_url"].rstrip("/")
        self.token = self.config["receiver_token"].strip()
        self.host = self.config.get("listen_host", "127.0.0.1")
        self.port = int(self.config.get("listen_port", 18088))
        self.queue_path = config_path.with_name(self.config.get("queue_file", "receiver-queue.jsonl"))
        self.state = State()
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.outbox: queue.Queue[dict[str, Any]] = queue.Queue()
        self._load_queue()

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": "Bearer " + self.token,
            "Content-Type": "application/json",
            "User-Agent": "namra-weflab-bridge/1.0",
        }

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None, timeout: int = 10) -> dict[str, Any]:
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = request.Request(self.site + path, data=body, method=method, headers=self._headers())
        try:
            with request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8") or "{}")
        except error.HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError("HTTP %s: %s" % (exc.code, text)) from exc

    def _load_queue(self) -> None:
        if not self.queue_path.exists():
            return
        for line in self.queue_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                self.outbox.put(json.loads(line))
            except Exception:
                pass

    def _rewrite_queue(self, items: list[dict[str, Any]]) -> None:
        tmp = self.queue_path.with_suffix(".tmp")
        tmp.write_text("".join(json.dumps(item, ensure_ascii=False) + "\n" for item in items), encoding="utf-8")
        tmp.replace(self.queue_path)

    def enqueue_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        event = dict(payload)
        event.setdefault("bridge_event_id", str(uuid.uuid4()))
        event.setdefault("occurred_at", time.strftime("%Y-%m-%dT%H:%M:%S%z"))

        required = ("roulette_name", "item_name")
        missing = [name for name in required if not str(event.get(name, "")).strip()]
        if missing:
            raise ValueError("missing fields: " + ", ".join(missing))

        with self.lock:
            existing = list(self._snapshot_queue())
            existing.append(event)
            self._rewrite_queue(existing)
            self.outbox.put(event)
        return event

    def _snapshot_queue(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        temp: list[dict[str, Any]] = []
        while True:
            try:
                value = self.outbox.get_nowait()
            except queue.Empty:
                break
            temp.append(value)
        for value in temp:
            self.outbox.put(value)
            items.append(value)
        return items

    def poll_config(self) -> None:
        while not self.stop_event.is_set():
            try:
                payload = self._request("GET", "/api/roulette/config")
                with self.lock:
                    self.state.desired_enabled = bool(payload.get("desired_enabled"))
                    self.state.alert_url = str(payload.get("alert_url") or "")
                    self.state.auto_register = bool(payload.get("auto_register"))
                    self.state.connection_test_challenge = payload.get("connection_test_challenge")
                    self.state.preset_refresh_request_id = payload.get("preset_refresh_request_id")
                    self.state.preset_refresh_requested_at = payload.get("preset_refresh_requested_at")
            except Exception as exc:
                with self.lock:
                    self.state.source_error = "config: " + str(exc)
            self.stop_event.wait(5)

    def heartbeat_loop(self) -> None:
        while not self.stop_event.is_set():
            try:
                with self.lock:
                    state = asdict(self.state)
                    challenge = self.state.connection_test_challenge
                self._request("POST", "/api/roulette/heartbeat", {
                    "monitoring": state["monitoring"],
                    "websocket_connected": state["websocket_connected"],
                    "source_verified": state["source_verified"],
                    "state": state["source_state"],
                    "error": state["source_error"],
                    "bridge_version": state["bridge_version"],
                    "challenge": challenge,
                })
            except Exception:
                pass
            self.stop_event.wait(30)

    def sender_loop(self) -> None:
        while not self.stop_event.is_set():
            batch: list[dict[str, Any]] = []
            try:
                first = self.outbox.get(timeout=1)
                batch.append(first)
            except queue.Empty:
                continue

            deadline = time.time() + 0.5
            while len(batch) < 50 and time.time() < deadline:
                try:
                    batch.append(self.outbox.get_nowait())
                except queue.Empty:
                    time.sleep(0.02)

            try:
                with self.lock:
                    enabled = self.state.desired_enabled
                    websocket_connected = self.state.websocket_connected
                    source_verified = self.state.source_verified
                if not enabled:
                    raise RuntimeError("integration is stopped by admin")

                self._request("POST", "/api/roulette/ingest", {
                    "events": batch,
                    "websocket_connected": websocket_connected,
                    "source_verified": source_verified,
                }, timeout=20)

                remaining = self._snapshot_queue()
                sent_ids = {str(item.get("bridge_event_id")) for item in batch}
                remaining = [item for item in remaining if str(item.get("bridge_event_id")) not in sent_ids]
                with self.lock:
                    self._rewrite_queue(remaining)
            except Exception:
                for item in batch:
                    self.outbox.put(item)
                time.sleep(2)

    def submit_preset(self, payload: dict[str, Any]) -> dict[str, Any]:
        body = {
            "roulette_name": str(payload.get("roulette_name") or "").strip(),
            "items": payload.get("items") if isinstance(payload.get("items"), list) else [],
            "observed_at": payload.get("observed_at"),
            "request_id": payload.get("request_id") or self.state.preset_refresh_request_id,
        }
        if not body["roulette_name"]:
            raise ValueError("roulette_name is required")
        return self._request("POST", "/api/roulette/presets", body)

    def set_source_status(self, payload: dict[str, Any]) -> None:
        with self.lock:
            self.state.monitoring = bool(payload.get("monitoring"))
            self.state.websocket_connected = bool(payload.get("websocket_connected"))
            self.state.source_verified = bool(payload.get("source_verified"))
            self.state.source_state = str(payload.get("state") or ("receiving" if self.state.websocket_connected else "waiting"))
            self.state.source_error = str(payload.get("error") or "")

    def local_config(self) -> dict[str, Any]:
        with self.lock:
            return asdict(self.state)


def handler_factory(bridge: Bridge):
    class Handler(BaseHTTPRequestHandler):
        def _json(self, status: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _body(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            return json.loads(raw.decode("utf-8") or "{}")

        def do_GET(self):
            if self.path == "/health":
                self._json(200, {"ok": True, "queued": bridge.outbox.qsize(), "state": bridge.local_config()})
                return
            if self.path == "/config":
                self._json(200, bridge.local_config())
                return
            self._json(404, {"error": "not found"})

        def do_POST(self):
            try:
                body = self._body()
                if self.path == "/event":
                    event = bridge.enqueue_event(body)
                    self._json(202, {"ok": True, "bridge_event_id": event["bridge_event_id"]})
                    return
                if self.path == "/preset":
                    result = bridge.submit_preset(body)
                    self._json(200, result)
                    return
                if self.path == "/source-status":
                    bridge.set_source_status(body)
                    self._json(200, {"ok": True})
                    return
                self._json(404, {"error": "not found"})
            except Exception as exc:
                self._json(400, {"error": str(exc)})

        def log_message(self, fmt, *args):
            return

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="receiver-config.json")
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    if not config_path.exists():
        raise SystemExit("Missing config file: %s" % config_path)

    bridge = Bridge(config_path)
    threads = [
        threading.Thread(target=bridge.poll_config, daemon=True),
        threading.Thread(target=bridge.heartbeat_loop, daemon=True),
        threading.Thread(target=bridge.sender_loop, daemon=True),
    ]
    for thread in threads:
        thread.start()

    server = ThreadingHTTPServer((bridge.host, bridge.port), handler_factory(bridge))
    print("NAMRA Weflab bridge listening on http://%s:%s" % (bridge.host, bridge.port))
    print("This bridge does not connect to Weflab by itself. Connect an authorized source adapter to /event, /preset, /source-status.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        bridge.stop_event.set()
        server.shutdown()


if __name__ == "__main__":
    main()
