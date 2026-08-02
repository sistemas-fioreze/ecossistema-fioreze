import pystray


class TrayController:
    def __init__(self, root, image, hotel_name, on_exit):
        self.root = root
        self.on_exit = on_exit
        self.icon = pystray.Icon(
            "fioreze-print-agent",
            image,
            f"Fioreze - Impressao - {hotel_name}",
            menu=pystray.Menu(
                pystray.MenuItem("Abrir", self.show_window, default=True),
                pystray.MenuItem("Sair", self.exit_application),
            ),
        )

    def start(self):
        self.icon.run_detached()

    def stop(self):
        self.icon.stop()

    def show_window(self, _icon=None, _item=None):
        self.root.after(0, self._show_window)

    def exit_application(self, _icon=None, _item=None):
        self.root.after(0, self.on_exit)

    def _show_window(self):
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
