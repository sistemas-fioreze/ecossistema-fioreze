import json
import unittest
from unittest.mock import patch

from fioreze_print_agent.api import PrintAgentApi


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps({"ok": True, "data": {"hotels": []}}).encode()


class ApiTests(unittest.TestCase):
    def test_requires_https_outside_localhost(self):
        with self.assertRaises(ValueError):
            PrintAgentApi("http://example.invalid")

    @patch("urllib.request.urlopen", return_value=FakeResponse())
    def test_enrollment_listing_has_no_credentials(self, urlopen):
        result = PrintAgentApi("https://portal.example.invalid").enrollment_hotels()
        self.assertEqual(result, [])
        request = urlopen.call_args.args[0]
        self.assertIsNone(request.headers.get("Authorization"))

    @patch("urllib.request.urlopen", return_value=FakeResponse())
    def test_authenticated_settings_uses_bearer_without_exposing_it_in_url(self, urlopen):
        PrintAgentApi("https://portal.example.invalid", "token-ficticio").settings()
        request = urlopen.call_args.args[0]
        self.assertEqual(request.headers.get("Authorization"), "Bearer token-ficticio")
        self.assertNotIn("token-ficticio", request.full_url)


if __name__ == "__main__":
    unittest.main()
