import unittest
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image

from fioreze_print_agent.branding import TRAY_ICON_SIZE, load_unit_tray_icon, prepare_tray_image


def sample_png(size=(240, 80), color=(35, 91, 76, 255)):
    output = BytesIO()
    Image.new("RGBA", size, color).save(output, format="PNG")
    return output.getvalue()


class BrandingTests(unittest.TestCase):
    def test_normalizes_unit_logo_for_windows_tray(self):
        image = prepare_tray_image(sample_png())
        self.assertEqual(image.size, (TRAY_ICON_SIZE, TRAY_ICON_SIZE))
        self.assertEqual(image.mode, "RGBA")

    @patch("fioreze_print_agent.branding.PrintAgentApi.download_public_image", return_value=sample_png())
    def test_downloads_and_caches_selected_unit_logo(self, download):
        with TemporaryDirectory() as directory:
            target = Path(directory) / "unit-tray-icon.png"
            image = load_unit_tray_icon("https://portal.example.invalid", "/media/logo-unidade", target)
            self.assertEqual(image.size, (TRAY_ICON_SIZE, TRAY_ICON_SIZE))
            self.assertTrue(target.exists())
            download.assert_called_once_with("/media/logo-unidade")

    def test_uses_generic_icon_when_unit_has_no_reduced_logo(self):
        with TemporaryDirectory() as directory:
            image = load_unit_tray_icon("https://portal.example.invalid", None, Path(directory) / "missing.png")
            self.assertEqual(image.size, (TRAY_ICON_SIZE, TRAY_ICON_SIZE))


if __name__ == "__main__":
    unittest.main()
