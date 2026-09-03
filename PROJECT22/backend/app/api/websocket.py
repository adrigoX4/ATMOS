import asyncio
import json
import logging
from typing import Dict, List, Set, Optional
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from collections import defaultdict

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time alert streaming."""

    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self.user_preferences: Dict[WebSocket, Dict] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        async with self._lock:
            self.active_connections[client_id].add(websocket)
            self.user_preferences[websocket] = {
                "client_id": client_id,
                "connected_at": datetime.utcnow().isoformat(),
                "subscriptions": [],
            }
        logger.info(f"Client {client_id} connected. Total: {self._total_connections()}")

    async def disconnect(self, websocket: WebSocket, client_id: str):
        async with self._lock:
            self.active_connections[client_id].discard(websocket)
            if websocket in self.user_preferences:
                del self.user_preferences[websocket]
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
        logger.info(f"Client {client_id} disconnected. Total: {self._total_connections()}")

    def _total_connections(self) -> int:
        return sum(len(conns) for conns in self.active_connections.values())

    async def subscribe(self, websocket: WebSocket, alert_types: List[str], severities: List[str]):
        async with self._lock:
            if websocket in self.user_preferences:
                self.user_preferences[websocket]["subscriptions"] = {
                    "alert_types": alert_types,
                    "severities": severities,
                }
        logger.info(f"Client subscribed to types={alert_types}, severities={severities}")

    async def broadcast_alert(self, alert: Dict, client_id: Optional[str] = None):
        message = json.dumps({
            "type": "alert",
            "data": alert,
            "timestamp": datetime.utcnow().isoformat(),
        })

        targets = self.active_connections.get(client_id, set()) if client_id else set()
        if not client_id:
            for conns in self.active_connections.values():
                targets.update(conns)

        disconnected = []
        for websocket in targets:
            try:
                prefs = self.user_preferences.get(websocket, {})
                subs = prefs.get("subscriptions", {})

                if subs:
                    alert_type = alert.get("type", "")
                    severity = alert.get("severity", "")
                    allowed_types = subs.get("alert_types", [])
                    allowed_severities = subs.get("severities", [])

                    if allowed_types and alert_type not in allowed_types:
                        continue
                    if allowed_severities and severity not in allowed_severities:
                        continue

                await websocket.send_text(message)
            except Exception:
                disconnected.append(websocket)

        for ws in disconnected:
            for cid, conns in self.active_connections.items():
                if ws in conns:
                    await self.disconnect(ws, cid)
                    break

    async def broadcast_metric_update(self, metrics: Dict):
        message = json.dumps({
            "type": "metrics_update",
            "data": metrics,
            "timestamp": datetime.utcnow().isoformat(),
        })

        for conns in self.active_connections.values():
            for websocket in conns:
                try:
                    await websocket.send_text(message)
                except Exception:
                    pass

    async def broadcast_weight_update(self, weights: Dict):
        message = json.dumps({
            "type": "weight_update",
            "data": weights,
            "timestamp": datetime.utcnow().isoformat(),
        })

        for conns in self.active_connections.values():
            for websocket in conns:
                try:
                    await websocket.send_text(message)
                except Exception:
                    pass

    async def send_personal_message(self, websocket: WebSocket, message: Dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            pass

    def get_connection_stats(self) -> Dict:
        return {
            "total_connections": self._total_connections(),
            "clients": {
                cid: len(conns)
                for cid, conns in self.active_connections.items()
            },
        }


manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)

                if message.get("action") == "subscribe":
                    await manager.subscribe(
                        websocket,
                        message.get("alert_types", []),
                        message.get("severities", []),
                    )
                    await manager.send_personal_message(websocket, {
                        "type": "subscription_confirmed",
                        "data": message,
                    })
                elif message.get("action") == "ping":
                    await manager.send_personal_message(websocket, {
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                elif message.get("action") == "stats":
                    await manager.send_personal_message(websocket, {
                        "type": "stats",
                        "data": manager.get_connection_stats(),
                    })
            except json.JSONDecodeError:
                await manager.send_personal_message(websocket, {
                    "type": "error",
                    "message": "Invalid JSON",
                })
    except WebSocketDisconnect:
        await manager.disconnect(websocket, client_id)
