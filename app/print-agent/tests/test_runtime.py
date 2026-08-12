import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fioreze_print_agent.runtime import consume_restart_request, consume_show_request, write_runtime_status


class RuntimeStatusTests(unittest.TestCase):
    def test_runtime_status_contains_only_sanitized_operational_fields(self):
        with TemporaryDirectory() as directory:
            target = Path(directory) / "runtime-status.json"
            payload = write_runtime_status(
                "running",
                "Aguardando novos pedidos",
                {
                    "hotel_id": "hotel-ficticio",
                    "device_id": "device-fixture",
                    "printer_name": "Impressora de teste",
                    "token": "segredo-que-nao-pode-ser-gravado",
                },
                path=target,
            )
            content = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(content, payload)
            self.assertNotIn("token", content)
            self.assertNotIn("password", content)
            self.assertEqual(content["status"], "running")

    def test_restart_request_is_consumed_once(self):
        with TemporaryDirectory() as directory:
            target = Path(directory) / "restart.request"
            target.write_text("{}", encoding="utf-8")
            self.assertTrue(consume_restart_request(target))
            self.assertFalse(consume_restart_request(target))

    def test_show_request_is_consumed_once(self):
        with TemporaryDirectory() as directory:
            target = Path(directory) / "show.request"
            target.write_text("{}", encoding="utf-8")
            self.assertTrue(consume_show_request(target))
            self.assertFalse(consume_show_request(target))


if __name__ == "__main__":
    unittest.main()
