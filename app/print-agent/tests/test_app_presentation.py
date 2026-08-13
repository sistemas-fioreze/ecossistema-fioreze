import os
import unittest
from pathlib import Path

from fioreze_print_agent.app import (
    apply_rounded_window,
    draw_rounded_rectangle,
    lower_widget,
    runtime_tone,
    should_hide_status_window,
    status_window_geometry,
)


class FakeTk:
    def __init__(self):
        self.calls = []

    def call(self, *arguments):
        self.calls.append(arguments)


class FakeCanvas:
    def __init__(self):
        self.tk = FakeTk()
        self._w = ".rounded.background"


class ShapeCanvas:
    def __init__(self):
        self.shapes = []

    def create_rectangle(self, *coordinates, **options):
        self.shapes.append(("rectangle", coordinates, options))

    def create_oval(self, *coordinates, **options):
        self.shapes.append(("oval", coordinates, options))


class AppPresentationTests(unittest.TestCase):
    def test_runtime_messages_use_clear_operational_tones(self):
        self.assertEqual(runtime_tone("Aguardando novos pedidos"), "success")
        self.assertEqual(runtime_tone("Impressao desativada na plataforma"), "warning")
        self.assertEqual(runtime_tone("Falha local no agente de impressao"), "danger")

    def test_status_window_is_vertical_and_anchored_to_the_tray_corner(self):
        self.assertEqual(
            status_window_geometry((0, 0, 1920, 1040)),
            "410x708+1504+326",
        )

    def test_status_window_respects_small_work_areas(self):
        self.assertEqual(
            status_window_geometry((0, 0, 360, 600)),
            "348x588+6+6",
        )

    def test_native_rounding_is_optional_outside_windows(self):
        if os.name != "nt":
            self.assertFalse(apply_rounded_window(object()))

    def test_status_popup_hides_only_after_losing_application_focus(self):
        self.assertTrue(should_hide_status_window("status", True, False))
        self.assertFalse(should_hide_status_window("status", True, True))
        self.assertFalse(should_hide_status_window("setup", True, False))

    def test_status_popup_has_no_transparent_key_or_close_button(self):
        source = (Path(__file__).parents[1] / "fioreze_print_agent" / "app.py").read_text(encoding="utf-8")
        status_shell = source[source.index("    def _status_shell"):source.index("    def _shell", source.index("    def _status_shell"))]
        self.assertNotIn("WINDOW_TRANSPARENT_KEY", source)
        self.assertNotIn('text="\\u00d7"', status_shell)
        self.assertIn('fill=COLORS["surface"]', status_shell)

    def test_rounded_background_uses_widget_stacking_instead_of_canvas_item_lowering(self):
        canvas = FakeCanvas()

        lower_widget(canvas)

        self.assertEqual(canvas.tk.calls, [("lower", ".rounded.background")])

    def test_rounded_surface_uses_real_circular_corners(self):
        canvas = ShapeCanvas()

        draw_rounded_rectangle(canvas, 120, 40, 12, "white", "gray")

        self.assertEqual(sum(shape[0] == "oval" for shape in canvas.shapes), 8)
        self.assertEqual(sum(shape[0] == "rectangle" for shape in canvas.shapes), 4)


if __name__ == "__main__":
    unittest.main()
