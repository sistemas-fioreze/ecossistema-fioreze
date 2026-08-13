import os
import unittest

from fioreze_print_agent.app import apply_rounded_window, runtime_tone, status_window_geometry


class AppPresentationTests(unittest.TestCase):
    def test_runtime_messages_use_clear_operational_tones(self):
        self.assertEqual(runtime_tone("Aguardando novos pedidos"), "success")
        self.assertEqual(runtime_tone("Impressao desativada na plataforma"), "warning")
        self.assertEqual(runtime_tone("Falha local no agente de impressao"), "danger")

    def test_status_window_is_vertical_and_anchored_to_the_tray_corner(self):
        self.assertEqual(
            status_window_geometry((0, 0, 1920, 1040)),
            "390x700+1518+328",
        )

    def test_status_window_respects_small_work_areas(self):
        self.assertEqual(
            status_window_geometry((0, 0, 360, 600)),
            "336x576+12+12",
        )

    def test_native_rounding_is_optional_outside_windows(self):
        if os.name != "nt":
            self.assertFalse(apply_rounded_window(object()))


if __name__ == "__main__":
    unittest.main()
