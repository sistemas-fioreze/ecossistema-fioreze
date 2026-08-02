import unittest

from fioreze_print_agent.templates import format_money, render_print_job, wrap_text


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


if __name__ == "__main__":
    unittest.main()
