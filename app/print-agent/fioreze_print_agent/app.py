import platform
import queue
import tkinter as tk
from tkinter import messagebox, ttk

from .api import ApiError, PrintAgentApi
from .branding import load_unit_tray_icon
from .config import load_config, save_config
from .printer import list_printers
from .tray import TrayController
from .worker import PrintWorker


DEFAULT_ORIGIN = "https://portal.hoteisfioreze.com.br"


class AgentApplication:
    def __init__(self, root):
        self.root = root
        self.root.title("Fioreze - Impressao de pedidos")
        self.root.geometry("560x430")
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

        def connect():
            if not all([hotel.get(), activation.get(), device.get(), printer.get()]):
                messagebox.showwarning("Campos obrigatorios", "Preencha unidade, codigo, computador e impressora.")
                return
            try:
                api = PrintAgentApi(origin.get())
                selected_hotel = hotels[hotel.get()]
                result = api.enroll(selected_hotel["hotel_id"], activation.get(), device.get(), printer.get())
                self.config = {
                    "origin": origin.get().rstrip("/"),
                    "hotel_id": result["hotel"]["hotel_id"],
                    "hotel_name": result["hotel"]["name"],
                    "device_id": result["device"]["id"],
                    "device_name": device.get(),
                    "printer_name": printer.get(),
                    "icon_url": result["hotel"].get("icon_url") or selected_hotel.get("icon_url"),
                    "token": result["access_token"],
                }
                save_config(self.config)
                self.show_status()
            except (ApiError, ValueError, OSError) as error:
                messagebox.showerror("Nao foi possivel conectar", str(error))

        actions = ttk.Frame(frame)
        actions.pack(fill="x", pady=(20, 0))
        ttk.Button(actions, text="Carregar unidades", command=load_hotels).pack(side="left")
        ttk.Button(actions, text="Conectar", command=connect).pack(side="right")
        load_hotels()

    def show_status(self):
        self.clear()
        frame = ttk.Frame(self.root, padding=32)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="Impressao de pedidos", font=("Segoe UI", 20, "bold")).pack(anchor="w")
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

        def save_printer():
            if not printer.get():
                messagebox.showwarning("Impressora", "Selecione uma impressora instalada.")
                return
            self.config["printer_name"] = printer.get()
            save_config(self.config)
            messagebox.showinfo("Impressora", "Impressora atualizada.")

        actions = ttk.Frame(frame)
        actions.pack(fill="x", pady=(10, 0))
        ttk.Button(actions, text="Atualizar lista", command=lambda: printer_widget.configure(values=list_printers())).pack(side="left")
        ttk.Button(actions, text="Salvar impressora", command=save_printer).pack(side="right")
        ttk.Label(frame, text="A ativacao e o modelo de comprovante sao controlados pelo ERP.").pack(anchor="w", pady=(22, 0))
        ttk.Button(frame, text="Minimizar para a bandeja", command=self.hide_to_tray).pack(anchor="e", pady=(18, 0))
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
    AgentApplication(root)
    root.mainloop()
