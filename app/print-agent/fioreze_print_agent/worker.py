import threading
import time

from .api import ApiError, PrintAgentApi
from .journal import PrintJournal
from .printer import print_raw
from .templates import format_order_number, render_print_job


class PrintWorker(threading.Thread):
    def __init__(self, config, on_status=None, interval=5):
        super().__init__(daemon=True)
        self.config = config
        self.on_status = on_status or (lambda _message: None)
        self.interval = interval
        self.stop_event = threading.Event()
        self.journal = PrintJournal()

    def stop(self):
        self.stop_event.set()

    def run(self):
        api = PrintAgentApi(self.config["origin"], self.config["token"])
        while not self.stop_event.is_set():
            try:
                api.heartbeat(self.config["printer_name"])
                result = api.claim()
                job = result.get("job")
                if not result.get("printing_enabled"):
                    self.on_status("Impressao desativada na plataforma")
                elif job:
                    self._print(api, job)
                else:
                    self.on_status("Aguardando novos pedidos")
            except ApiError as error:
                self.on_status(str(error))
            except Exception:
                self.on_status("Falha local no agente de impressao")
            self.stop_event.wait(self.interval)

    def _print(self, api, job):
        if self.journal.contains(job["id"]):
            api.complete(job["id"], job["claim_token"])
            self.on_status("Confirmacao de impressao sincronizada")
            return
        try:
            logo = None
            logo_url = job.get("order", {}).get("logo_url")
            if logo_url:
                try:
                    logo = api.download_public_image(logo_url)
                except ApiError:
                    logo = None
            payload = render_print_job(job, logo)
            print_raw(self.config["printer_name"], payload, f"Fioreze Pedido {format_order_number(job['order'])}")
            self.journal.record(job["id"])
        except Exception as error:
            api.fail(job["id"], job["claim_token"], type(error).__name__)
            self.on_status("Falha ao imprimir pedido")
            return
        try:
            api.complete(job["id"], job["claim_token"])
            self.on_status("Pedido impresso com sucesso")
        except ApiError:
            self.on_status("Comanda impressa; aguardando sincronizacao")
