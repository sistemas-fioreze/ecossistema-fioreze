import unittest
from io import BytesIO

from PIL import Image

from fioreze_print_agent.templates import format_money, render_print_job, render_test_page, wrap_text


class TemplateTests(unittest.TestCase):
    def test_renders_two_legacy_copies_without_real_printer(self):
        job = {
            "template": {"config": {"paper_columns": 42, "copies": [
                {"title": "VIA ESTABELECIMENTO", "signature": False},
                {"title": "VIA DO HOSPEDE", "signature": True},
            ]}},
            "order": {
                "hotel_name": "Hotel Exemplo",
                "public_id": "RS-TESTE",
                "room_code": "101",
                "guest_name": "Hospede Ficticio",
                "currency": "BRL",
                "total_cents": 3250,
                "created_at": "2026-08-02T12:00:00.000Z",
                "items": [{"name": "Prato demonstracao", "quantity": 1, "line_total_cents": 3250}],
            },
        }
        payload = render_print_job(job).decode("cp850", errors="ignore")
        self.assertIn("VIA ESTABELECIMENTO", payload)
        self.assertIn("VIA DO HOSPEDE", payload)
        self.assertIn("R$ 32,50", payload)
        self.assertIn("ASSINATURA", payload)

    def test_money_and_wrapping_are_deterministic(self):
        self.assertEqual(format_money(123456), "R$ 1.234,56")
        self.assertEqual(wrap_text("um texto de teste", 8), ["um texto", "de teste"])

    def test_item_observation_uses_note_from_snapshot(self):
        job = {
            "template": {"config": {"paper_columns": 42}},
            "order": {
                "hotel_name": "Hotel Exemplo",
                "public_id": "RS-TESTE",
                "currency": "BRL",
                "total_cents": 1000,
                "items": [{
                    "name": "Cafe demonstracao",
                    "quantity": 1,
                    "line_total_cents": 1000,
                    "selected_options_snapshot": '{"note":"Sem acucar"}',
                }],
            },
        }
        payload = render_print_job(job).decode("cp850", errors="ignore")
        self.assertIn("Obs.: Sem acucar", payload)
        self.assertNotIn("{\"note\"", payload)

    def test_renders_centro_elgin_template_with_structured_prices(self):
        job = {
            "template": {"key": "legacy-centro-elgin-48", "config": {
                "layout_key": "legacy-centro-elgin-48",
                "paper_columns": 48,
                "copies": [
                    {"title": "VIA COZINHA/RECEP", "signature": True},
                    {"title": "VIA DO HOSPEDE", "signature": False},
                ],
            }},
            "order": {
                "hotel_name": "Fioreze Centro",
                "public_id": "RS-FICTICIO",
                "room_code": "000",
                "guest_name": "Hospede Ficticio",
                "currency": "BRL",
                "total_cents": 4875,
                "created_at": "2026-08-04T12:00:00.000Z",
                "items": [{
                    "name": "Prato demonstracao",
                    "quantity": 2,
                    "unit_price_cents": 2000,
                    "line_total_cents": 4000,
                    "selected_options_snapshot": '{"selections":[{"group_name":"Sabor","option_name":"Demonstracao"}],"note":"Sem talheres"}',
                }],
            },
        }
        payload = render_print_job(job).decode("cp850", errors="ignore")
        self.assertIn("VIA COZINHA/RECEP", payload)
        self.assertIn("VIA DO HOSPEDE", payload)
        self.assertIn("V.UNIT", payload)
        self.assertIn("R$ 20,00", payload)
        self.assertIn("Sabor: Demonstracao; Sem talheres", payload)

    def test_logo_is_rendered_as_escpos_raster_without_printer(self):
        source = BytesIO()
        Image.new("RGB", (64, 24), "black").save(source, format="PNG")
        job = {
            "template": {"config": {"paper_columns": 42, "show_logo": True}},
            "order": {"hotel_name": "Hotel Exemplo", "public_id": "TESTE", "total_cents": 0, "items": []},
        }
        payload = render_print_job(job, source.getvalue())
        self.assertIn(b"\x1dv0\x00", payload)

    def test_test_page_is_memory_only_and_marked_as_test(self):
        payload = render_test_page(
            {"key": "legacy-thermal-42", "config": {"paper_columns": 42}},
            "Hotel Ficticio",
            "Impressora Ficticia",
        ).decode("cp850", errors="ignore")
        self.assertIn("TESTE-LOCAL", payload)
        self.assertIn("Nao preparar", payload)


if __name__ == "__main__":
    unittest.main()
