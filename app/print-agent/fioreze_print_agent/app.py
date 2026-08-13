import ctypes
import os
import platform
import queue
import subprocess
import sys
import threading
import time
import tkinter as tk
from ctypes.wintypes import RECT
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
from .updater import (
    UpdateError,
    can_self_update,
    check_for_update,
    defer_update,
    download_update,
    is_update_deferred,
    schedule_update_install,
)
from .version import APP_VERSION
from .worker import PrintWorker


DEFAULT_ORIGIN = "https://portal.hoteisfioreze.com.br"
STATUS_WINDOW_WIDTH = 390
STATUS_WINDOW_HEIGHT = 700
STATUS_WINDOW_MARGIN = 12
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


class RoundedFrame(tk.Frame):
    def __init__(self, parent, *, fill, border, radius=14, padding=18):
        parent_background = parent.cget("bg")
        super().__init__(parent, bg=parent_background, padx=padding, pady=padding, bd=0, highlightthickness=0)
        self._fill = fill
        self._border = border
        self._radius = radius
        self._background = tk.Canvas(self, bg=parent_background, bd=0, highlightthickness=0)
        self._background.place(x=0, y=0, relwidth=1, relheight=1)
        self._background.lower()
        self.bind("<Configure>", self._redraw_background)

    def _redraw_background(self, _event=None):
        width = max(1, self.winfo_width())
        height = max(1, self.winfo_height())
        radius = min(self._radius, width // 2, height // 2)
        self._background.delete("all")
        points = [
            radius, 1, width - radius, 1, width - 1, 1, width - 1, radius,
            width - 1, height - radius, width - 1, height - 1, width - radius, height - 1,
            radius, height - 1, 1, height - 1, 1, height - radius, 1, radius, 1, 1,
        ]
        self._background.create_polygon(
            points,
            smooth=True,
            splinesteps=24,
            fill=self._fill,
            outline=self._border,
            width=1,
        )


def apply_rounded_window(root):
    if os.name != "nt":
        return False
    try:
        root.update_idletasks()
        preference = ctypes.c_int(2)
        result = ctypes.windll.dwmapi.DwmSetWindowAttribute(
            root.winfo_id(),
            33,
            ctypes.byref(preference),
            ctypes.sizeof(preference),
        )
        return result == 0
    except (AttributeError, OSError, tk.TclError):
        return False


def status_window_geometry(work_area, width=STATUS_WINDOW_WIDTH, height=STATUS_WINDOW_HEIGHT, margin=STATUS_WINDOW_MARGIN):
    left, top, right, bottom = work_area
    available_width = max(320, right - left - (margin * 2))
    available_height = max(560, bottom - top - (margin * 2))
    final_width = min(width, available_width)
    final_height = min(height, available_height)
    x = max(left + margin, right - final_width - margin)
    y = max(top + margin, bottom - final_height - margin)
    return f"{final_width}x{final_height}+{x}+{y}"


def work_area_bounds(root):
    if os.name == "nt":
        try:
            bounds = RECT()
            if ctypes.windll.user32.SystemParametersInfoW(48, 0, ctypes.byref(bounds), 0):
                return bounds.left, bounds.top, bounds.right, bounds.bottom
        except (AttributeError, OSError):
            pass
    return 0, 0, root.winfo_screenwidth(), root.winfo_screenheight()


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
        self.window_mode = None
        self.drag_origin = None
        self.update_check_running = False
        self.update_dialog = None
        self.update_progress = None
        self.update_progress_label = None
        self._configure_styles()
        self._set_window_icon()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        if self.config.get("token"):
            self.show_status()
        else:
            write_runtime_status("not_configured", self.runtime_message, self.config)
            self.show_setup()
        self.root.after(250, self.process_events)
        if can_self_update():
            self.root.after(4000, self.check_for_agent_update)

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

    def _set_setup_window(self):
        if self.window_mode == "setup":
            return
        self.root.overrideredirect(False)
        self.root.resizable(True, True)
        self.root.minsize(780, 620)
        self.root.maxsize(self.root.winfo_screenwidth(), self.root.winfo_screenheight())
        self.root.geometry("920x690")
        self.root.configure(bg=COLORS["canvas"])
        self.root.after_idle(lambda: apply_rounded_window(self.root))
        self.window_mode = "setup"

    def _set_status_window(self):
        self.root.overrideredirect(True)
        self.root.resizable(False, False)
        self.root.minsize(STATUS_WINDOW_WIDTH, 560)
        self.root.maxsize(STATUS_WINDOW_WIDTH, STATUS_WINDOW_HEIGHT)
        self.root.geometry(status_window_geometry(work_area_bounds(self.root)))
        self.root.configure(bg=COLORS["line"])
        self.root.after_idle(lambda: apply_rounded_window(self.root))
        self.window_mode = "status"

    def _start_window_drag(self, event):
        self.drag_origin = (event.x_root - self.root.winfo_x(), event.y_root - self.root.winfo_y())

    def _move_window(self, event):
        if not self.drag_origin:
            return
        offset_x, offset_y = self.drag_origin
        self.root.geometry(f"+{event.x_root - offset_x}+{event.y_root - offset_y}")

    def _stop_window_drag(self, _event=None):
        self.drag_origin = None

    def _status_shell(self):
        shell = tk.Frame(
            self.root,
            bg=COLORS["canvas"],
            highlightthickness=1,
            highlightbackground=COLORS["line"],
        )
        shell.pack(fill="both", expand=True)
        titlebar = tk.Frame(shell, bg=COLORS["surface"], height=48)
        titlebar.pack(fill="x")
        titlebar.pack_propagate(False)
        identity = tk.Frame(titlebar, bg=COLORS["surface"])
        identity.pack(side="left", fill="both", expand=True, padx=(16, 0))
        title = tk.Label(identity, text="Fioreze Impressao", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 10, "bold"))
        title.pack(anchor="w", pady=(7, 0))
        subtitle = tk.Label(identity, text=self.config.get("hotel_name", "Unidade Fioreze"), bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 8))
        subtitle.pack(anchor="w", pady=(1, 0))
        close_button = tk.Button(
            titlebar,
            text="\u00d7",
            command=self.hide_to_tray,
            bg=COLORS["surface"],
            fg=COLORS["muted"],
            activebackground=COLORS["danger_soft"],
            activeforeground=COLORS["danger"],
            relief="flat",
            bd=0,
            width=5,
            cursor="hand2",
            font=("Segoe UI", 13),
        )
        close_button.pack(side="right", fill="y")
        for draggable in (titlebar, identity, title, subtitle):
            draggable.bind("<ButtonPress-1>", self._start_window_drag)
            draggable.bind("<B1-Motion>", self._move_window)
            draggable.bind("<ButtonRelease-1>", self._stop_window_drag)
        body = tk.Frame(shell, bg=COLORS["canvas"], padx=14, pady=10)
        body.pack(fill="both", expand=True)
        return body

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
        return RoundedFrame(
            parent,
            fill=COLORS["surface"],
            border=COLORS["line"],
            radius=14,
            padding=padding,
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
        self._set_setup_window()
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
        self._set_status_window()
        self.clear()
        content = self._status_shell()
        status_card = self._card(content, 12)
        status_card.pack(fill="x")
        status_line = tk.Frame(status_card, bg=COLORS["surface"])
        status_line.pack(fill="x")
        self.status_dot = tk.Label(status_line, text="\u25cf", bg=COLORS["surface"], fg=COLORS["warning"], font=("Segoe UI", 11, "bold"))
        self.status_dot.pack(side="left", padx=(0, 7))
        tk.Label(status_line, text="Impressao automatica", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 11, "bold")).pack(side="left")
        self.status_chip = tk.Label(status_line, text="INICIANDO", bg=COLORS["warning_soft"], fg=COLORS["warning"], padx=8, pady=3, font=("Segoe UI", 7, "bold"))
        self.status_chip.pack(side="right")
        self.status = tk.StringVar(value="Iniciando conexao segura...")
        self.runtime_message = self.status.get()
        write_runtime_status("starting", self.runtime_message, self.config)
        tk.Label(status_card, textvariable=self.status, bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 9), wraplength=320, justify="left").pack(anchor="w", pady=(5, 7))
        status_actions = tk.Frame(status_card, bg=COLORS["surface"])
        status_actions.pack(fill="x")
        tk.Label(status_actions, text=f"Versao {APP_VERSION}", bg=COLORS["surface"], fg=COLORS["subtle"], font=("Segoe UI", 8)).pack(side="left")
        self._button(status_actions, "Abrir ERP", self.open_erp, primary=True).pack(side="right")

        facts = tk.Frame(content, bg=COLORS["canvas"])
        facts.pack(fill="x", pady=8)
        facts.grid_columnconfigure((0, 1), weight=1, uniform="facts")
        for column, (label, value) in enumerate((
            ("Unidade", self.config.get("hotel_name", "Unidade vinculada")),
            ("Computador", self.config.get("device_name", "-")),
        )):
            fact = self._card(facts, 9)
            fact.grid(row=0, column=column, sticky="nsew", padx=(0 if column == 0 else 5, 5 if column == 0 else 0))
            tk.Label(fact, text=label.upper(), bg=COLORS["surface"], fg=COLORS["subtle"], font=("Segoe UI", 7, "bold")).pack(anchor="w")
            tk.Label(fact, text=value, bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 9, "bold"), wraplength=145, justify="left").pack(anchor="w", pady=(4, 0))

        settings_card = self._card(content, 12)
        settings_card.pack(fill="x")
        tk.Label(settings_card, text="Este computador", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 11, "bold")).pack(anchor="w")
        tk.Label(settings_card, text="Escolha a impressora e o modelo da comanda.", bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 8)).pack(anchor="w", pady=(2, 7))
        available_printers = list_printers()
        current_printer = self.config.get("printer_name", "")
        if current_printer and current_printer not in available_printers:
            available_printers.insert(0, current_printer)
        printer = tk.StringVar(value=current_printer or (available_printers[0] if available_printers else ""))
        printer_field, printer_widget = self._field(settings_card, "Impressora", printer, available_printers)
        printer_field.pack(fill="x", pady=(0, 6))

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
        template_field.pack(fill="x", pady=(0, 6))

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
        settings_actions.pack(fill="x", pady=(2, 0))
        refresh_button = self._button(settings_actions, "Atualizar", refresh_printers)
        refresh_button.configure(pady=7)
        refresh_button.pack(side="left")
        save_button = self._button(settings_actions, "Salvar", save_device_settings, primary=True)
        save_button.configure(pady=7)
        save_button.pack(side="right")

        activity_card = self._card(content, 12)
        activity_card.pack(fill="x", pady=(8, 0))
        tk.Label(activity_card, text="Atividade", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 11, "bold")).pack(anchor="w")
        self.notice = tk.Label(activity_card, text="Aguardando o primeiro contato...", justify="left", anchor="w", wraplength=320, bg=COLORS["surface_soft"], fg=COLORS["muted"], padx=11, pady=9, font=("Segoe UI", 8))
        self.notice.pack(fill="x")
        self.activity_time = tk.Label(activity_card, text="", bg=COLORS["surface"], fg=COLORS["subtle"], font=("Segoe UI", 8))
        self.activity_time.pack(anchor="w", pady=(4, 6))
        activity_actions = tk.Frame(activity_card, bg=COLORS["surface"])
        activity_actions.pack(fill="x")
        connection_button = self._button(activity_actions, "Testar conexao", self.test_connection)
        connection_button.configure(pady=7)
        connection_button.pack(side="left", fill="x", expand=True, padx=(0, 4))
        print_button = self._button(activity_actions, "Imprimir teste", lambda: self.test_print(printer.get(), templates.get(template_name.get())))
        print_button.configure(pady=7)
        print_button.pack(side="left", fill="x", expand=True, padx=(4, 0))
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
            self.show_window,
        )
        self.tray.start()

    def show_window(self):
        if self.config.get("token"):
            self.root.geometry(status_window_geometry(work_area_bounds(self.root)))
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
        self.root.attributes("-topmost", True)
        self.root.after(180, lambda: self.root.attributes("-topmost", False))

    def hide_to_tray(self):
        if self.tray:
            self.root.withdraw()

    def check_for_agent_update(self):
        if self.update_check_running or not can_self_update():
            return
        self.update_check_running = True

        def run_check():
            try:
                manifest = check_for_update()
            except UpdateError:
                manifest = None
            self.events.put(lambda: self._complete_agent_update_check(manifest))

        threading.Thread(target=run_check, name="fioreze-update-check", daemon=True).start()

    def _complete_agent_update_check(self, manifest):
        self.update_check_running = False
        if manifest and not is_update_deferred(manifest["version"]):
            self._show_agent_update(manifest)
        self.root.after(6 * 60 * 60 * 1000, self.check_for_agent_update)

    def _show_agent_update(self, manifest):
        if self.update_dialog and self.update_dialog.winfo_exists():
            self.update_dialog.lift()
            return
        if self.config.get("token"):
            self.show_window()
        dialog = tk.Toplevel(self.root)
        self.update_dialog = dialog
        dialog.overrideredirect(True)
        dialog.resizable(False, False)
        dialog.configure(bg=COLORS["line"])
        width, height = 430, 310
        screen_width = dialog.winfo_screenwidth()
        screen_height = dialog.winfo_screenheight()
        dialog.geometry(f"{width}x{height}+{(screen_width - width) // 2}+{(screen_height - height) // 2}")
        dialog.transient(self.root)
        dialog.grab_set()
        dialog.attributes("-topmost", True)
        dialog.after(180, lambda: dialog.attributes("-topmost", False))
        dialog.after_idle(lambda: apply_rounded_window(dialog))

        shell = tk.Frame(dialog, bg=COLORS["surface"], highlightthickness=1, highlightbackground=COLORS["line"])
        shell.pack(fill="both", expand=True)
        titlebar = tk.Frame(shell, bg=COLORS["surface"], height=46)
        titlebar.pack(fill="x")
        titlebar.pack_propagate(False)
        tk.Label(titlebar, text="Atualizacao do Fioreze Suite", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 10, "bold")).pack(side="left", padx=18)

        def remind_later():
            defer_update(manifest["version"])
            if dialog.winfo_exists():
                dialog.grab_release()
                dialog.destroy()
            self.update_dialog = None

        close_button = tk.Button(
            titlebar,
            text="\u00d7",
            command=remind_later,
            bg=COLORS["surface"],
            fg=COLORS["muted"],
            activebackground=COLORS["danger_soft"],
            activeforeground=COLORS["danger"],
            relief="flat",
            bd=0,
            width=5,
            cursor="hand2",
            font=("Segoe UI", 13),
        )
        close_button.pack(side="right", fill="y")

        body = tk.Frame(shell, bg=COLORS["surface"], padx=24, pady=16)
        body.pack(fill="both", expand=True)
        tk.Label(body, text=f"Versao {manifest['version']} disponivel", bg=COLORS["surface"], fg=COLORS["ink"], font=("Segoe UI", 17, "bold")).pack(anchor="w")
        tk.Label(
            body,
            text=manifest.get("release_notes") or "Melhorias de estabilidade e seguranca para o ERP e a impressao.",
            bg=COLORS["surface"],
            fg=COLORS["muted"],
            justify="left",
            wraplength=370,
            font=("Segoe UI", 9),
        ).pack(anchor="w", pady=(7, 16))
        self.update_progress_label = tk.Label(body, text="Pronta para baixar.", bg=COLORS["surface"], fg=COLORS["muted"], font=("Segoe UI", 8))
        self.update_progress_label.pack(anchor="w", pady=(0, 7))
        self.update_progress = tk.Canvas(body, height=7, bg=COLORS["surface_soft"], bd=0, highlightthickness=0)
        self.update_progress.pack(fill="x")

        actions = tk.Frame(body, bg=COLORS["surface"])
        actions.pack(fill="x", side="bottom", pady=(18, 0))
        later_button = self._button(actions, "Lembrar mais tarde", remind_later)
        later_button.pack(side="left")

        def download_and_install():
            install_button.configure(state="disabled", cursor="arrow")
            later_button.configure(state="disabled", cursor="arrow")
            close_button.configure(state="disabled", cursor="arrow")
            self._set_agent_update_progress(1, "Preparando download seguro...")

            def run_download():
                try:
                    path = download_update(
                        manifest,
                        on_progress=lambda value: self.events.put(
                            lambda progress=value: self._set_agent_update_progress(progress, f"Baixando atualizacao... {progress}%")
                        ),
                    )
                    self.events.put(lambda: self._install_agent_update(path))
                except UpdateError as error:
                    self.events.put(lambda message=str(error): self._fail_agent_update(message, install_button, later_button, close_button))

            threading.Thread(target=run_download, name="fioreze-update-download", daemon=True).start()

        install_button = self._button(actions, "Baixar e instalar", download_and_install, primary=True)
        install_button.pack(side="right")

    def _set_agent_update_progress(self, value, label):
        if not self.update_dialog or not self.update_dialog.winfo_exists() or not self.update_progress:
            return
        self.update_progress_label.configure(text=label)
        self.update_progress.update_idletasks()
        width = max(1, self.update_progress.winfo_width())
        self.update_progress.delete("all")
        self.update_progress.create_rectangle(0, 0, width * max(0, min(100, value)) / 100, 7, fill=COLORS["success"], outline="")

    def _fail_agent_update(self, message, install_button, later_button, close_button):
        self._set_agent_update_progress(0, message)
        for button in (install_button, later_button, close_button):
            button.configure(state="normal", cursor="hand2")

    def _install_agent_update(self, path):
        try:
            self._set_agent_update_progress(100, "Instalando e reiniciando...")
            schedule_update_install(path)
            self.restarting = True
            write_runtime_status("updating", "Instalando atualizacao do Fioreze Suite", self.config)
            self.root.after(350, self.exit_application)
        except UpdateError as error:
            if self.update_progress_label:
                self.update_progress_label.configure(text=str(error), fg=COLORS["danger"])

    def process_events(self):
        if consume_restart_request():
            self.restart_application()
            return
        if consume_show_request():
            self.show_window()
        try:
            while True:
                event = self.events.get_nowait()
                if callable(event):
                    event()
                else:
                    self._update_runtime_message(event)
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
