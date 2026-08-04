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
                 patch("fioreze_print_agent.installer.INSTALLED_EXE", base / "suite" / "Fioreze-Suite.exe"), \
                 patch("fioreze_print_agent.installer.INSTALLED_ERP_EXE", base / "suite" / "Fioreze-ERP.exe"):
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

    @patch("fioreze_print_agent.installer.load_unit_tray_icon", return_value=Image.new("RGBA", (128, 128), "white"))
    @patch("fioreze_print_agent.installer.write_windows_shortcut")
    def test_installs_desktop_erp_and_writes_only_public_unit_configuration(self, shortcut, _icon):
        with TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "package" / "Fioreze-Suite.exe"
            erp_source = base / "package" / "Fioreze-ERP.exe"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"suite")
            erp_source.write_bytes(b"erp")
            with patch("fioreze_print_agent.installer.SUITE_DIR", base / "suite"), \
                 patch("fioreze_print_agent.installer.INSTALLED_EXE", base / "suite" / "Fioreze-Suite.exe"), \
                 patch("fioreze_print_agent.installer.INSTALLED_ERP_EXE", base / "suite" / "Fioreze-ERP.exe"), \
                 patch("fioreze_print_agent.installer.UNIT_ICON", base / "suite" / "unidade.ico"), \
                 patch("fioreze_print_agent.installer.os.name", "nt"):
                result = install_suite(
                    origin="https://portal.example.invalid",
                    hotel_slug="hotel-ficticio",
                    hotel_name="Hotel Ficticio",
                    executable=source,
                    erp_executable=erp_source,
                    desktop_dir=base / "desktop",
                    start_menu_dir=base / "menu",
                )
            self.assertEqual(result["installed_erp"].read_bytes(), b"erp")
            configuration = (base / "suite" / "erp-config.json").read_text(encoding="utf-8")
            self.assertIn("hotel-ficticio", configuration)
            self.assertNotIn("token", configuration.lower())
            self.assertNotIn("password", configuration.lower())
            self.assertEqual(shortcut.call_count, 2)


if __name__ == "__main__":
    unittest.main()
