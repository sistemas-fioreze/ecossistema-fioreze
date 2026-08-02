import json
import urllib.error
import urllib.request


class ApiError(RuntimeError):
    pass


class PrintAgentApi:
    def __init__(self, origin, token=None, timeout=15):
        self.origin = origin.rstrip("/")
        self.token = token
        self.timeout = timeout
        if not self.origin.startswith("https://") and not self.origin.startswith("http://127.0.0.1"):
            raise ValueError("O servidor deve usar HTTPS.")

    def enrollment_hotels(self):
        return self._request("GET", "/api/v1/print-agent/enrollment/hotels")["data"]["hotels"]

    def enroll(self, hotel_id, activation_code, device_name, printer_name):
        return self._request(
            "POST",
            "/api/v1/print-agent/enroll",
            {
                "hotel_id": hotel_id,
                "activation_code": activation_code,
                "device_name": device_name,
                "platform": "windows",
                "app_version": "1.0.0",
                "printer_name": printer_name,
            },
        )["data"]

    def heartbeat(self, printer_name):
        return self._request("POST", "/api/v1/print-agent/heartbeat", {"app_version": "1.0.0", "printer_name": printer_name})["data"]

    def claim(self):
        return self._request("POST", "/api/v1/print-agent/jobs/claim", {})["data"]

    def complete(self, job_id, claim_token):
        return self._request("POST", f"/api/v1/print-agent/jobs/{job_id}/complete", {"claim_token": claim_token})["data"]

    def fail(self, job_id, claim_token, message):
        return self._request("POST", f"/api/v1/print-agent/jobs/{job_id}/fail", {"claim_token": claim_token, "message": str(message)[:300]})["data"]

    def _request(self, method, path, payload=None):
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers = {"Accept": "application/json", "User-Agent": "FiorezePrintAgent/1.0"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = urllib.request.Request(self.origin + path, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            try:
                result = json.loads(error.read().decode("utf-8"))
                message = result.get("error", {}).get("message") or "Falha ao comunicar com a plataforma."
            except (ValueError, UnicodeDecodeError):
                message = "Falha ao comunicar com a plataforma."
            raise ApiError(message) from None
        except (urllib.error.URLError, TimeoutError) as error:
            raise ApiError("Nao foi possivel conectar a plataforma.") from error
        if not result.get("ok"):
            raise ApiError(result.get("error", {}).get("message") or "Resposta invalida da plataforma.")
        return result
