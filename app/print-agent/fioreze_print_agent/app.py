import platform
import queue
import sys
import tkinter as tk
from tkinter import messagebox, ttk

from .api import ApiError, PrintAgentApi
from .branding import load_unit_tray_icon
from .config import load_config, save_config
from .installer import install_suite
from .printer import list_printers, print_raw
from .templates import render_test_page
from .tray import TrayController
from .worker import PrintWorker


DEFAULT_ORIGIN = "https://portal.hoteisfioreze.com.br"


class AgentApplication:
    def __init__(self, root):
        self.root = root
        self.root.title("Fioreze - Instalacao e impressao")
        self.root.geometry("620x610")
        self.events = queue.Queue()
        self.worker = None
        self.tray = None
        self.config = load_config()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        if self.config.get("token"):
            self.show_status()
        else:
            self.show_setup()
        self.root.after(250, self.process_events)

    def clear(self):
        for child in self.root.winfo_children():
            child.destroy()

    def show_setup(self):
        self.clear()
        frame = ttk.Frame(self.root, padding=28)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="Conectar computador", font=("Segoe UI", 20, "bold")).pack(anchor="w")
        ttk.Label(frame, text="Escolha a unidade e informe o codigo criado no ERP.").pack(anchor="w", pady=(4, 22))
        origin = tk.StringVar(value=self.config.get("origin", DEFAULT_ORIGIN))
        hotel = tk.StringVar()
        activation = tk.StringVar()
        device = tk.StringVar(value=platform.node() or "Computador da recepcao")
        printer = tk.StringVar()
        install_erp = tk.BooleanVar(value=True)
        install_print = tk.BooleanVar(value=True)
        hotels = {}

        def field(label, variable, values=None, secret=False):
            ttk.Label(frame, text=label).pack(anchor="w", pady=(8, 4))
            widget = ttk.Combobox(frame, textvariable=variable, values=values, state="readonly") if values is not None else ttk.Entry(frame, textvariable=variable, show="*" if secret else "")
            widget.pack(fill="x")
            return widget

        field("Endereco da plataforma", origin)
        hotel_widget = field("Unidade", hotel, [])
        field("Codigo de conexao", activation)
        field("Nome deste computador", device)
        printer_widget = field("Impressora", printer, list_printers())
        if printer_widget["values"]:
            printer.set(printer_widget["values"][0])

        def load_hotels():
            try:
                rows = PrintAgentApi(origin.get()).enrollment_hotels()
                hotels.clear()
                for row in rows:
                    hotels[row["name"]] = row
                hotel_widget["values"] = list(hotels)
                if hotels:
                    hotel.set(next(iter(hotels)))
            except (ApiError, ValueError) as error:
                messagebox.showerror("Conexao", str(error))

        ttk.Checkbutton(frame, text="Criar atalhos do ERP desta unidade", variable=install_erp).pack(anchor="w", pady=(14, 2))
        ttk.Checkbutton(frame, text="Instalar agente de impressao automatica", variable=install_print).pack(anchor="w")

        def connect():
            if not hotel.get():
                messagebox.showwarning("Unidade", "Selecione a unidade.")
                return
            try:
                selected_hotel = hotels[hotel.get()]
                if not all([activation.get(), device.get(), printer.get()]):
                    if install_print.get():
                        messagebox.showwarning("Campos obrigatorios", "Para instalar a impressao, informe codigo, computador e impressora.")
                        return
                if not install_print.get():
                    installation = install_suite(
                        origin=origin.get(),
                        hotel_slug=selected_hotel["slug"],
                        hotel_name=selected_hotel["name"],
                        icon_url=selected_hotel.get("icon_url"),
                        create_erp_shortcuts=install_erp.get(),
                        enable_print_agent=False,
                    )
                    messagebox.showinfo("Instalacao concluida", f"O atalho do ERP foi criado.\n\n{installation['erp_url'] if install_erp.get() else ''}")
                    return
                api = PrintAgentApi(origin.get())
                result = api.enroll(selected_hotel["hotel_id"], activation.get(), device.get(), printer.get())
                self.config = {
                    "origin": origin.get().rstrip("/"),
                    "hotel_id": result["hotel"]["hotel_id"],
                    "hotel_name": result["hotel"]["name"],
                    "device_id": result["device"]["id"],
                    "device_name": device.get(),
                    "printer_name": printer.get(),
                    "hotel_slug": result["hotel"]["slug"],
                    "icon_url": result["hotel"].get("icon_url") or selected_hotel.get("icon_url"),
                    "token": result["access_token"],
                }
                save_config(self.config)
                install_suite(
                    origin=origin.get(),
                    hotel_slug=selected_hotel["slug"],
                    hotel_name=selected_hotel["name"],
                    icon_url=self.config.get("icon_url"),
                    create_erp_shortcuts=install_erp.get(),
                    enable_print_agent=True,
                )
                self.show_status()
            except (ApiError, ValueError, OSError) as error:
                messagebox.showerror("Nao foi possivel conectar", str(error))

        actions = ttk.Frame(frame)
        actions.pack(fill="x", pady=(20, 0))
        ttk.Button(actions, text="Carregar unidades", command=load_hotels).pack(side="left")
        ttk.Button(actions, text="Instalar e conectar", command=connect).pack(side="right")
        load_hotels()

    def show_status(self):
        self.clear()
        frame = ttk.Frame(self.root, padding=32)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="Fioreze Suite", font=("Segoe UI", 20, "bold")).pack(anchor="w")
        ttk.Label(frame, text=self.config.get("hotel_name", "Unidade vinculada"), font=("Segoe UI", 12)).pack(anchor="w", pady=(4, 24))
        self.status = tk.StringVar(value="Iniciando conexao segura...")
        ttk.Label(frame, textvariable=self.status, wraplength=480).pack(anchor="w")
        ttk.Separator(frame).pack(fill="x", pady=22)
        ttk.Label(frame, text=f"Computador: {self.config.get('device_name', '-')}").pack(anchor="w")
        ttk.Label(frame, text="Impressora", font=("Segoe UI", 9, "bold")).pack(anchor="w", pady=(16, 4))
        available_printers = list_printers()
        current_printer = self.config.get("printer_name", "")
        if current_printer and current_printer not in available_printers:
            available_printers.insert(0, current_printer)
        printer = tk.StringVar(value=current_printer or (available_printers[0] if available_printers else ""))
        printer_widget = ttk.Combobox(frame, textvariable=printer, values=available_printers, state="readonly")
        printer_widget.pack(fill="x")

        api = PrintAgentApi(self.config["origin"], self.config["token"])
        settings = {"templates": [], "device": {}}
        try:
            settings = api.settings()
        except ApiError as error:
            self.status.set(str(error))
        templates = {entry["name"]: entry for entry in settings.get("templates", [])}
        selected_template = next((entry["name"] for entry in templates.values() if entry["id"] == settings.get("device", {}).get("template_id")), "")
        template_name = tk.StringVar(value=selected_template or (next(iter(templates), "")))
        ttk.Label(frame, text="Modelo do comprovante", font=("Segoe UI", 9, "bold")).pack(anchor="w", pady=(14, 4))
        template_widget = ttk.Combobox(frame, textvariable=template_name, values=list(templates), state="readonly")
        template_widget.pack(fill="x")

        def save_device_settings():
            if not printer.get() or not template_name.get():
                messagebox.showwarning("Configuracao", "Selecione a impressora e o modelo do comprovante.")
                return
            try:
                api.update_settings(printer.get(), templates[template_name.get()]["id"])
                self.config["printer_name"] = printer.get()
                self.config["template_id"] = templates[template_name.get()]["id"]
                save_config(self.config)
                messagebox.showinfo("Configuracao", "Impressora e modelo atualizados.")
            except (ApiError, OSError) as error:
                messagebox.showerror("Configuracao", str(error))

        actions = ttk.Frame(frame)
        actions.pack(fill="x", pady=(10, 0))
        ttk.Button(actions, text="Atualizar lista", command=lambda: printer_widget.configure(values=list_printers())).pack(side="left")
        ttk.Button(actions, text="Salvar configuracao", command=save_device_settings).pack(side="right")
        tests = ttk.Frame(frame)
        tests.pack(fill="x", pady=(18, 0))
        ttk.Button(tests, text="Testar conexao", command=self.test_connection).pack(side="left")
        ttk.Button(tests, text="Imprimir pagina de teste", command=lambda: self.test_print(printer.get(), templates.get(template_name.get()))).pack(side="left", padx=8)
        ttk.Button(frame, text="Abrir ERP", command=self.open_erp).pack(anchor="w", pady=(18, 0))
        ttk.Button(frame, text="Minimizar para a bandeja", command=self.hide_to_tray).pack(anchor="e", pady=(10, 0))
        self.ensure_tray()
        self.worker = PrintWorker(self.config, on_status=lambda message: self.events.put(message))
        self.worker.start()

    def ensure_tray(self):
        if self.tray:
            return
        try:
            hotels = PrintAgentApi(self.config.get("origin", DEFAULT_ORIGIN)).enrollment_hotels()
            current = next((row for row in hotels if row.get("hotel_id") == self.config.get("hotel_id")), None)
            if current and current.get("icon_url") != self.config.get("icon_url"):
                self.config["icon_url"] = current.get("icon_url")
                save_config(self.config)
        except (ApiError, ValueError, OSError):
            pass
        image = load_unit_tray_icon(self.config.get("origin", DEFAULT_ORIGIN), self.config.get("icon_url"))
        self.tray = TrayController(
            self.root,
            image,
            self.config.get("hotel_name", "Unidade Fioreze"),
            self.exit_application,
            self.test_connection,
            self.test_print,
        )
        self.tray.start()

    def hide_to_tray(self):
        if self.tray:
            self.root.withdraw()

    def process_events(self):
        try:
            while True:
                self.status.set(self.events.get_nowait())
        except queue.Empty:
            pass
        self.root.after(250, self.process_events)

    def test_connection(self):
        try:
            result = PrintAgentApi(self.config["origin"], self.config["token"]).heartbeat(self.config.get("printer_name", ""))
            state = "habilitada" if result.get("printing_enabled") else "desabilitada"
            messagebox.showinfo("Conexao", f"Conexao com a plataforma confirmada.\nImpressao da unidade: {state}.")
        except (ApiError, KeyError) as error:
            messagebox.showerror("Conexao", str(error))

    def test_print(self, printer_name=None, template=None):
        if not self.config.get("token"):
            return
        try:
            api = PrintAgentApi(self.config["origin"], self.config["token"])
            settings = api.settings()
            selected = template or next((entry for entry in settings.get("templates", []) if entry["id"] == settings.get("device", {}).get("template_id")), None)
            printer = printer_name or self.config.get("printer_name")
            if not selected or not printer:
                raise ApiError("Selecione a impressora e o modelo do comprovante.")
            if not messagebox.askyesno("Pagina de teste", f"Enviar uma pagina de teste para:\n{printer}?"):
                return
            logo = None
            if self.config.get("icon_url"):
                try:
                    logo = api.download_public_image(self.config["icon_url"])
                except ApiError:
                    logo = None
            payload = render_test_page(selected, self.config.get("hotel_name", "Fioreze"), printer, logo)
            print_raw(printer, payload, "Fioreze - Teste de impressao")
            messagebox.showinfo("Pagina de teste", "Pagina enviada para a impressora.")
        except (ApiError, OSError, RuntimeError) as error:
            messagebox.showerror("Pagina de teste", str(error))

    def open_erp(self):
        import webbrowser

        slug = self.config.get("hotel_slug")
        if slug:
            webbrowser.open(f"{self.config.get('origin', DEFAULT_ORIGIN).rstrip('/')}/{slug}/admin/erp/")

    def close(self):
        if self.tray:
            self.hide_to_tray()
            return
        self.exit_application()

    def exit_application(self):
        if self.worker:
            self.worker.stop()
        if self.tray:
            tray, self.tray = self.tray, None
            tray.stop()
        self.root.destroy()


def main():
    root = tk.Tk()
    application = AgentApplication(root)
    if "--tray" in sys.argv and application.config.get("token"):
        root.withdraw()
    root.mainloop()
