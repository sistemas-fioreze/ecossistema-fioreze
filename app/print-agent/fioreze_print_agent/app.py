import os
import platform
import queue
import subprocess
import sys
import time
import tkinter as tk
from datetime import datetime
from tkinter import messagebox, ttk

from .api import ApiError, PrintAgentApi
from .branding import load_unit_tray_icon
from .config import load_config, save_config
from .installer import INSTALLED_ERP_EXE, UNIT_ICON, install_suite
from .printer import list_printers, print_raw
from .runtime import consume_restart_request, consume_show_request, write_runtime_status
from .templates import render_test_page
from .tray import TrayController
from .version import APP_VERSION
from .worker import PrintWorker


DEFAULT_ORIGIN = "https://portal.hoteisfioreze.com.br"
COLORS = {
    "canvas": "#f4f6f8",
    "surface": "#ffffff",
    "surface_soft": "#f8f9fa",
    "ink": "#202124",
    "muted": "#69717c",
    "subtle": "#9299a3",
    "line": "#e2e6ea",
    "accent": "#41464d",
    "accent_hover": "#2f3338",
    "success": "#198754",
    "success_soft": "#eaf7f0",
    "warning": "#b7791f",
    "warning_soft": "#fff7e6",
    "danger": "#c43d4b",
    "danger_soft": "#fff0f1",
}


def runtime_tone(message):
    normalized = str(message or "").lower()
    if any(term in normalized for term in ("falha", "erro", "sem resposta", "nao foi possivel")):
        return "danger"
    if any(term in normalized for term in ("desativada", "paus", "aguardando configuracao")):
        return "warning"
    return "success"


class AgentApplication:
    def __init__(self, root):
        self.root = root
        self.root.title("Fioreze Suite | Impressao")
        self.root.geometry("920x690")
        self.root.minsize(780, 620)
        self.root.configure(bg=COLORS["canvas"])
        self.events = queue.Queue()
        self.worker = None
        self.tray = None
        self.config = load_config()
        self.runtime_message = "Fioreze Suite aguardando configuracao"
        self.last_runtime_write = 0
        self.restarting = False
        self.status = None
        self.status_dot = None
        self.status_chip = None
        self.activity_time = None
        self.notice = None
        self._configure_styles()
        self._set_window_icon()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        if self.config.get("token"):
            self.show_status()
        else:
            write_runtime_status("not_configured", self.runtime_message, self.config)
            self.show_setup()
        self.root.after(250, self.process_events)

    def _configure_styles(self):
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure(
            "Fioreze.TCombobox",
            fieldbackground=COLORS["surface"],
            background=COLORS["surface"],
            foreground=COLORS["ink"],
            bordercolor=COLORS["line"],
            lightcolor=COLORS["line"],
            darkcolor=COLORS["line"],
            arrowcolor=COLORS["muted"],
            padding=9,
            font=("Segoe UI", 10),
        )
        style.map(
            "Fioreze.TCombobox",
            bordercolor=[("focus", COLORS["accent"])],
            lightcolor=[("focus", COLORS["accent"])],
            darkcolor=[("focus", COLORS["accent"])],
        )
        style.configure(
            "Fioreze.TCheckbutton",
            background=COLORS["surface"],
            foreground=COLORS["ink"],
            font=("Segoe UI", 10, "bold"),
            padding=(0, 5),
        )
        style.map("Fioreze.TCheckbutton", background=[("active", COLORS["surface"])])

    def _set_window_icon(self):
        try:
            if os.name == "nt" and UNIT_ICON.exists():
                self.root.iconbitmap(default=str(UNIT_ICON))
        except (OSError, tk.TclError):
            pass

    def clear(self):
        for child in self.root.winfo_children():
            child.destroy()
        self.status = None
        self.status_dot = None
        self.status_chip = None
        self.activity_time = None
        self.notice = None

    def _shell(self, section, description):
        shell = tk.Frame(self.root, bg=COLORS["canvas"])
        shell.pack(fill="both", expand=True)
        topbar = tk.Frame(shell, bg=COLORS["surface"], height=64, highlightthickness=1, highlightbackground=COLORS["line"])
        topbar.pack(fill="x")
        topbar.pack_propagate(False)
        mark = tk.Label(topbar, text="F", width=3, bg=COLORS["accent"], fg="white", font=("Segoe UI", 12, "bold"))
        mark.pack(side="left", padx=(22, 12), pady=16)
        title = tk.Frame(topbar, bg=COLORS["surface"])
        title.pack(side="left", pady=10)
        tk.Label(title, text="Fioreze Suite", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 11, "bold")).pack(anchor="w")
        tk.Label(title, text=section, bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 9)).pack(anchor="w")
        tk.Label(
            topbar,
            text=f"VERSAO {APP_VERSION}",
            bg=COLORS["surface_soft"],
            fg=COLORS["muted"],
            font=("Segoe UI", 8, "bold"),
            padx=10,
            pady=6,
        ).pack(side="right", padx=22)
        content = tk.Frame(shell, bg=COLORS["canvas"])
        content.pack(fill="both", expand=True, padx=24, pady=22)
        heading = tk.Frame(content, bg=COLORS["canvas"])
        heading.pack(fill="x", pady=(0, 16))
        tk.Label(heading, text=section, bg=COLORS["canvas"], fg=COLORS["ink"], font=("Segoe UI", 20, "bold")).pack(anchor="w")
        tk.Label(heading, text=description, bg=COLORS["canvas"], fg=COLORS["muted"], font=("Segoe UI", 10)).pack(anchor="w", pady=(4, 0))
        return content

    def _card(self, parent, padding=18):
        return tk.Frame(
            parent,
            bg=COLORS["surface"],
            padx=padding,
            pady=padding,
            highlightthickness=1,
            highlightbackground=COLORS["line"],
        )

    def _field(self, parent, label, variable, values=None, secret=False):
        wrapper = tk.Frame(parent, bg=COLORS["surface"])
        tk.Label(wrapper, text=label.upper(), bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 8, "bold")).pack(anchor="w", pady=(0, 6))
        if values is not None:
            widget = ttk.Combobox(wrapper, textvariable=variable, values=values, state="readonly", style="Fioreze.TCombobox")
        else:
            widget = tk.Entry(
                wrapper,
                textvariable=variable,
                show="*" if secret else "",
                bg=COLORS["surface"],
                fg=COLORS["ink"],
                insertbackground=COLORS["ink"],
                relief="flat",
                highlightthickness=1,
                highlightbackground=COLORS["line"],
                highlightcolor=COLORS["accent"],
                font=("Segoe UI", 10),
            )
            widget.configure(width=30)
        widget.pack(fill="x", ipady=5 if values is None else 0)
        return wrapper, widget

    def _button(self, parent, text, command, primary=False, danger=False, width=None):
        if primary:
            background, foreground, active = COLORS["accent"], "#ffffff", COLORS["accent_hover"]
        elif danger:
            background, foreground, active = COLORS["danger_soft"], COLORS["danger"], "#ffe3e5"
        else:
            background, foreground, active = COLORS["surface_soft"], COLORS["ink"], "#edf0f2"
        return tk.Button(
            parent,
            text=text,
            command=command,
            width=width,
            bg=background,
            fg=foreground,
            activebackground=active,
            activeforeground=foreground,
            relief="flat",
            bd=0,
            padx=14,
            pady=9,
            cursor="hand2",
            font=("Segoe UI", 9, "bold"),
        )

    def _set_notice(self, text, tone="neutral"):
        if not self.notice:
            return
        tones = {
            "neutral": (COLORS["surface_soft"], COLORS["muted"]),
            "success": (COLORS["success_soft"], COLORS["success"]),
            "warning": (COLORS["warning_soft"], COLORS["warning"]),
            "danger": (COLORS["danger_soft"], COLORS["danger"]),
        }
        background, foreground = tones.get(tone, tones["neutral"])
        self.notice.configure(text=text, bg=background, fg=foreground)

    def show_setup(self):
        self.clear()
        content = self._shell("Configurar este computador", "Conecte o ERP e a impressao da unidade em uma unica instalacao.")
        body = tk.Frame(content, bg=COLORS["canvas"])
        body.pack(fill="both", expand=True)
        body.grid_columnconfigure(0, weight=4, uniform="setup")
        body.grid_columnconfigure(1, weight=7, uniform="setup")
        body.grid_rowconfigure(0, weight=1)

        guide = self._card(body, 22)
        guide.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        tk.Label(guide, text="INSTALACAO GUIADA", bg=COLORS["surface"], fg=COLORS["subtle"], font=("Segoe UI", 8, "bold")).pack(anchor="w")
        tk.Label(guide, text="Um computador,\numa unidade.", justify="left", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 22, "bold")).pack(anchor="w", pady=(12, 8))
        tk.Label(
            guide,
            text="O ERP permanece atualizado pela plataforma. O agente local cuida somente da impressora vinculada.",
            justify="left",
            wraplength=260,
            bg=COLORS["surface"],
            fg=COLORS["muted"],
            font=("Segoe UI", 10),
        ).pack(anchor="w")
        for number, title, detail in (
            ("1", "Escolha a unidade", "A identidade e a rota do ERP sao configuradas automaticamente."),
            ("2", "Conecte a impressao", "Use o codigo temporario gerado no ERP da unidade."),
            ("3", "Conclua", "Atalhos, bandeja e inicializacao ficam prontos no Windows."),
        ):
            row = tk.Frame(guide, bg=COLORS["surface"])
            row.pack(fill="x", pady=(20 if number == "1" else 13, 0))
            tk.Label(row, text=number, width=3, bg=COLORS["surface_soft"], fg=COLORS["accent"], font=("Segoe UI", 9, "bold"), pady=6).pack(side="left", anchor="n")
            copy = tk.Frame(row, bg=COLORS["surface"])
            copy.pack(side="left", fill="x", expand=True, padx=(10, 0))
            tk.Label(copy, text=title, bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 10, "bold")).pack(anchor="w")
            tk.Label(copy, text=detail, justify="left", wraplength=220, bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 8)).pack(anchor="w", pady=(3, 0))

        form = self._card(body, 22)
        form.grid(row=0, column=1, sticky="nsew", padx=(12, 0))
        form.grid_columnconfigure(0, weight=1)
        form.grid_columnconfigure(1, weight=1)
        origin = tk.StringVar(value=self.config.get("origin", DEFAULT_ORIGIN))
        hotel = tk.StringVar()
        activation = tk.StringVar()
        device = tk.StringVar(value=platform.node() or "Computador da recepcao")
        printer = tk.StringVar()
        install_erp = tk.BooleanVar(value=True)
        install_print = tk.BooleanVar(value=True)
        hotels = {}

        origin_field, _ = self._field(form, "Endereco da plataforma", origin)
        origin_field.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 12))
        hotel_field, hotel_widget = self._field(form, "Unidade", hotel, [])
        hotel_field.grid(row=1, column=0, sticky="ew", padx=(0, 6), pady=(0, 12))
        device_field, _ = self._field(form, "Nome deste computador", device)
        device_field.grid(row=1, column=1, sticky="ew", padx=(6, 0), pady=(0, 12))
        activation_field, _ = self._field(form, "Codigo de conexao", activation)
        activation_field.grid(row=2, column=0, sticky="ew", padx=(0, 6), pady=(0, 12))
        printer_field, printer_widget = self._field(form, "Impressora", printer, list_printers())
        printer_field.grid(row=2, column=1, sticky="ew", padx=(6, 0), pady=(0, 12))
        if printer_widget["values"]:
            printer.set(printer_widget["values"][0])

        options = tk.Frame(form, bg=COLORS["surface_soft"], padx=14, pady=10)
        options.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(2, 12))
        ttk.Checkbutton(options, text="Instalar o ERP desta unidade", variable=install_erp, style="Fioreze.TCheckbutton").pack(anchor="w")
        ttk.Checkbutton(options, text="Ativar impressao automatica neste computador", variable=install_print, style="Fioreze.TCheckbutton").pack(anchor="w")
        self.notice = tk.Label(form, text="Carregando unidades autorizadas...", anchor="w", justify="left", bg=COLORS["surface_soft"], fg=COLORS["muted"], padx=12, pady=9, font=("Segoe UI", 9))
        self.notice.grid(row=4, column=0, columnspan=2, sticky="ew", pady=(0, 14))

        def load_hotels():
            self._set_notice("Consultando unidades autorizadas...", "neutral")
            try:
                rows = PrintAgentApi(origin.get()).enrollment_hotels()
                hotels.clear()
                for row in rows:
                    hotels[row["name"]] = row
                hotel_widget["values"] = list(hotels)
                if hotels:
                    hotel.set(next(iter(hotels)))
                    self._set_notice(f"{len(hotels)} unidade(s) disponivel(is).", "success")
                else:
                    self._set_notice("Nenhuma unidade disponivel para instalacao.", "warning")
            except (ApiError, ValueError) as error:
                self._set_notice(str(error), "danger")

        def connect():
            if not hotel.get():
                self._set_notice("Selecione uma unidade para continuar.", "warning")
                return
            try:
                selected_hotel = hotels[hotel.get()]
                if install_print.get() and not all([activation.get(), device.get(), printer.get()]):
                    self._set_notice("Informe codigo, computador e impressora para ativar a impressao.", "warning")
                    return
                self._set_notice("Preparando o Fioreze Suite...", "neutral")
                if not install_print.get():
                    installation = install_suite(
                        origin=origin.get(),
                        hotel_slug=selected_hotel["slug"],
                        hotel_name=selected_hotel["name"],
                        icon_url=selected_hotel.get("icon_url"),
                        create_erp_shortcuts=install_erp.get(),
                        enable_print_agent=False,
                    )
                    self._set_notice("ERP instalado. A impressao permaneceu desativada neste computador.", "success")
                    if install_erp.get() and installation.get("installed_erp"):
                        self.root.after(350, self.open_erp)
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
            except (ApiError, KeyError, ValueError, OSError) as error:
                self._set_notice(str(error), "danger")

        actions = tk.Frame(form, bg=COLORS["surface"])
        actions.grid(row=5, column=0, columnspan=2, sticky="ew")
        self._button(actions, "Atualizar unidades", load_hotels).pack(side="left")
        self._button(actions, "Instalar Fioreze Suite", connect, primary=True).pack(side="right")
        load_hotels()

    def show_status(self):
        self.clear()
        content = self._shell("Gerenciador de impressao", "Acompanhe a conexao, o computador e o modelo usado pela unidade.")
        status_card = self._card(content, 20)
        status_card.pack(fill="x")
        status_left = tk.Frame(status_card, bg=COLORS["surface"])
        status_left.pack(side="left", fill="x", expand=True)
        status_line = tk.Frame(status_left, bg=COLORS["surface"])
        status_line.pack(anchor="w")
        self.status_dot = tk.Label(status_line, text="●", bg=COLORS["surface"], fg=COLORS["warning"], font=("Segoe UI", 13, "bold"))
        self.status_dot.pack(side="left", padx=(0, 8))
        tk.Label(status_line, text="Agente de impressao", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 13, "bold")).pack(side="left")
        self.status_chip = tk.Label(status_line, text="INICIANDO", bg=COLORS["warning_soft"], fg=COLORS["warning"], padx=9, pady=4, font=("Segoe UI", 8, "bold"))
        self.status_chip.pack(side="left", padx=(10, 0))
        self.status = tk.StringVar(value="Iniciando conexao segura...")
        self.runtime_message = self.status.get()
        write_runtime_status("starting", self.runtime_message, self.config)
        tk.Label(status_left, textvariable=self.status, bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 10)).pack(anchor="w", pady=(7, 0))
        self._button(status_card, "Abrir ERP", self.open_erp, primary=True).pack(side="right", padx=(12, 0))

        facts = tk.Frame(content, bg=COLORS["canvas"])
        facts.pack(fill="x", pady=12)
        facts.grid_columnconfigure((0, 1, 2, 3), weight=1, uniform="facts")
        for column, (label, value) in enumerate((
            ("Unidade", self.config.get("hotel_name", "Unidade vinculada")),
            ("Computador", self.config.get("device_name", "-")),
            ("Impressora", self.config.get("printer_name", "Nao selecionada")),
            ("Versao", APP_VERSION),
        )):
            fact = self._card(facts, 14)
            fact.grid(row=0, column=column, sticky="nsew", padx=(0 if column == 0 else 5, 0 if column == 3 else 5))
            tk.Label(fact, text=label.upper(), bg=COLORS["surface"], fg=COLORS["subtle"], font=("Segoe UI", 8, "bold")).pack(anchor="w")
            tk.Label(fact, text=value, bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 10, "bold"), wraplength=170, justify="left").pack(anchor="w", pady=(5, 0))

        columns = tk.Frame(content, bg=COLORS["canvas"])
        columns.pack(fill="both", expand=True)
        columns.grid_columnconfigure(0, weight=3, uniform="status")
        columns.grid_columnconfigure(1, weight=2, uniform="status")
        columns.grid_rowconfigure(0, weight=1)
        settings_card = self._card(columns, 18)
        settings_card.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        activity_card = self._card(columns, 18)
        activity_card.grid(row=0, column=1, sticky="nsew", padx=(6, 0))

        tk.Label(settings_card, text="Configuracao deste computador", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 12, "bold")).pack(anchor="w")
        tk.Label(settings_card, text="Escolha onde e como as comandas serao impressas.", bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 9)).pack(anchor="w", pady=(3, 14))
        available_printers = list_printers()
        current_printer = self.config.get("printer_name", "")
        if current_printer and current_printer not in available_printers:
            available_printers.insert(0, current_printer)
        printer = tk.StringVar(value=current_printer or (available_printers[0] if available_printers else ""))
        printer_field, printer_widget = self._field(settings_card, "Impressora", printer, available_printers)
        printer_field.pack(fill="x", pady=(0, 12))

        api = PrintAgentApi(self.config["origin"], self.config["token"])
        settings = {"templates": [], "device": {}}
        try:
            settings = api.settings()
        except ApiError as error:
            self._update_runtime_message(str(error))
        templates = {entry["name"]: entry for entry in settings.get("templates", [])}
        selected_template = next((entry["name"] for entry in templates.values() if entry["id"] == settings.get("device", {}).get("template_id")), "")
        template_name = tk.StringVar(value=selected_template or (next(iter(templates), "")))
        template_field, template_widget = self._field(settings_card, "Modelo do comprovante", template_name, list(templates))
        template_field.pack(fill="x", pady=(0, 12))

        def refresh_printers():
            values = list_printers()
            printer_widget.configure(values=values)
            if values and printer.get() not in values:
                printer.set(values[0])
            self._set_activity("Lista de impressoras atualizada.", "success")

        def save_device_settings():
            if not printer.get() or not template_name.get():
                self._set_activity("Selecione a impressora e o modelo do comprovante.", "warning")
                return
            try:
                api.update_settings(printer.get(), templates[template_name.get()]["id"])
                self.config["printer_name"] = printer.get()
                self.config["template_id"] = templates[template_name.get()]["id"]
                save_config(self.config)
                self._set_activity("Configuracao salva e sincronizada.", "success")
            except (ApiError, KeyError, OSError) as error:
                self._set_activity(str(error), "danger")

        settings_actions = tk.Frame(settings_card, bg=COLORS["surface"])
        settings_actions.pack(fill="x", pady=(4, 0))
        self._button(settings_actions, "Atualizar impressoras", refresh_printers).pack(side="left")
        self._button(settings_actions, "Salvar configuracao", save_device_settings, primary=True).pack(side="right")

        tk.Label(activity_card, text="Diagnostico e atividade", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 12, "bold")).pack(anchor="w")
        tk.Label(activity_card, text="Operacao local protegida, sem porta HTTP aberta.", bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 9)).pack(anchor="w", pady=(3, 12))
        self.notice = tk.Label(activity_card, text="Aguardando o primeiro contato...", justify="left", anchor="nw", wraplength=280, bg=COLORS["surface_soft"], fg=COLORS["muted"], padx=13, pady=12, font=("Segoe UI", 9))
        self.notice.pack(fill="x")
        self.activity_time = tk.Label(activity_card, text="", bg=COLORS["surface"], fg=COLORS["subtle"], font=("Segoe UI", 8))
        self.activity_time.pack(anchor="w", pady=(6, 14))
        activity_actions = tk.Frame(activity_card, bg=COLORS["surface"])
        activity_actions.pack(fill="x")
        self._button(activity_actions, "Testar conexao", self.test_connection).pack(fill="x", pady=(0, 8))
        self._button(activity_actions, "Imprimir pagina de teste", lambda: self.test_print(printer.get(), templates.get(template_name.get()))).pack(fill="x", pady=(0, 8))
        self._button(activity_actions, "Minimizar para a bandeja", self.hide_to_tray).pack(fill="x")
        self.ensure_tray()
        if not self.worker or not self.worker.is_alive():
            self.worker = PrintWorker(self.config, on_status=lambda message: self.events.put(message))
            self.worker.start()

    def _set_activity(self, message, tone="neutral"):
        self._set_notice(message, tone)
        if self.activity_time:
            self.activity_time.configure(text=f"Atualizado as {datetime.now().strftime('%H:%M:%S')}")

    def _update_runtime_message(self, message):
        self.runtime_message = message
        if self.status:
            self.status.set(message)
        tone = runtime_tone(message)
        if self.status_dot:
            self.status_dot.configure(fg=COLORS[tone])
        if self.status_chip:
            labels = {"success": "ONLINE", "warning": "ATENCAO", "danger": "OFFLINE"}
            self.status_chip.configure(text=labels[tone], bg=COLORS[f"{tone}_soft"], fg=COLORS[tone])
        self._set_activity(message, tone)

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

    def show_window(self):
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()

    def hide_to_tray(self):
        if self.tray:
            self.root.withdraw()

    def process_events(self):
        if consume_restart_request():
            self.restart_application()
            return
        if consume_show_request():
            self.show_window()
        try:
            while True:
                self._update_runtime_message(self.events.get_nowait())
        except queue.Empty:
            pass
        now = time.monotonic()
        if self.config.get("token") and now - self.last_runtime_write >= 2:
            write_runtime_status("running", self.runtime_message, self.config)
            self.last_runtime_write = now
        self.root.after(250, self.process_events)

    def restart_application(self):
        self.restarting = True
        write_runtime_status("restarting", "Reiniciando agente de impressao", self.config)
        if getattr(sys, "frozen", False):
            command = [sys.executable, "--tray"]
        else:
            command = [sys.executable, "-m", "fioreze_print_agent", "--tray"]
        kwargs = {"close_fds": True, "shell": False}
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
        subprocess.Popen(command, **kwargs)
        self.exit_application()

    def test_connection(self):
        try:
            result = PrintAgentApi(self.config["origin"], self.config["token"]).heartbeat(self.config.get("printer_name", ""))
            state = "habilitada" if result.get("printing_enabled") else "desabilitada"
            self._set_activity(f"Conexao confirmada. Impressao da unidade: {state}.", "success" if result.get("printing_enabled") else "warning")
        except (ApiError, KeyError) as error:
            self._set_activity(str(error), "danger")

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
            self._set_activity("Pagina de teste enviada para a impressora.", "success")
        except (ApiError, OSError, RuntimeError) as error:
            self._set_activity(str(error), "danger")

    def open_erp(self):
        if os.name == "nt" and INSTALLED_ERP_EXE.exists():
            os.startfile(INSTALLED_ERP_EXE)
            return
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
        if not self.restarting:
            write_runtime_status("stopped", "Agente de impressao encerrado", self.config)
        self.root.destroy()


def main():
    root = tk.Tk()
    application = AgentApplication(root)
    if "--tray" in sys.argv and application.config.get("token"):
        root.withdraw()
    root.mainloop()
