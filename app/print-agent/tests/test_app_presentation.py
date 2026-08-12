import unittest

from fioreze_print_agent.app import runtime_tone


class AppPresentationTests(unittest.TestCase):
    def test_runtime_messages_use_clear_operational_tones(self):
        self.assertEqual(runtime_tone("Aguardando novos pedidos"), "success")
        self.assertEqual(runtime_tone("Impressao desativada na plataforma"), "warning")
        self.assertEqual(runtime_tone("Falha local no agente de impressao"), "danger")


if __name__ == "__main__":
    unittest.main()
