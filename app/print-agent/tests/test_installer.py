import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image

from fioreze_print_agent.installer import erp_url, install_suite


class InstallerTests(unittest.TestCase):
    def test_erp_url_uses_selected_unit_slug(self):
        self.assertEqual(
            erp_url("https://portal.example.invalid/", "hotel-ficticio"),
            "https://portal.example.invalid/hotel-ficticio/admin/erp/",
        )

    @patch("fioreze_print_agent.installer.load_unit_tray_icon", return_value=Image.new("RGBA", (128, 128), "white"))
    def test_creates_identified_shortcuts_without_credentials(self, _icon):
        with TemporaryDirectory() as directory:
            base = Path(directory)
            with patch("fioreze_print_agent.installer.SUITE_DIR", base / "suite"), \
                 patch("fioreze_print_agent.installer.UNIT_ICON", base / "suite" / "unidade.ico"), \
                 patch("fioreze_print_agent.installer.INSTALLED_EXE", base / "suite" / "Fioreze-Suite.exe"):
                result = install_suite(
                    origin="https://portal.example.invalid",
                    hotel_slug="hotel-ficticio",
                    hotel_name="Hotel Ficticio",
                    desktop_dir=base / "desktop",
                    start_menu_dir=base / "menu",
                    executable=base / "origem.exe",
                )
            self.assertEqual(len(result["shortcuts"]), 2)
            content = result["shortcuts"][0].read_text(encoding="utf-8")
            self.assertIn("/hotel-ficticio/admin/erp/", content)
            self.assertNotIn("password", content.lower())
            self.assertNotIn("token", content.lower())


if __name__ == "__main__":
    unittest.main()
