import pystray


class TrayController:
    def __init__(
        self,
        root,
        image,
        hotel_name,
        on_exit,
        on_test_connection=None,
        on_test_print=None,
        on_show=None,
        on_open_erp=None,
        on_check_update=None,
        on_update_now=None,
        on_restart=None,
    ):
        self.root = root
        self.on_exit = on_exit
        self.on_show = on_show
        menu_items = [pystray.MenuItem("Abrir painel", self.show_window, default=True)]
        if on_open_erp:
            menu_items.append(pystray.MenuItem("Abrir ERP", lambda *_args: root.after(0, on_open_erp)))
        menu_items.append(pystray.Menu.SEPARATOR)
        if on_check_update:
            menu_items.append(pystray.MenuItem("Verificar atualizacoes", lambda *_args: root.after(0, on_check_update)))
        if on_update_now:
            menu_items.append(pystray.MenuItem("Atualizar agora", lambda *_args: root.after(0, on_update_now)))
        if on_test_connection:
            menu_items.append(pystray.MenuItem("Testar conexao", lambda *_args: root.after(0, on_test_connection)))
        if on_test_print:
            menu_items.append(pystray.MenuItem("Imprimir pagina de teste", lambda *_args: root.after(0, on_test_print)))
        if on_restart:
            menu_items.append(pystray.MenuItem("Reiniciar agente", lambda *_args: root.after(0, on_restart)))
        menu_items.append(pystray.Menu.SEPARATOR)
        menu_items.append(pystray.MenuItem("Sair", self.exit_application))
        self.icon = pystray.Icon(
            "fioreze-print-agent",
            image,
            f"Fioreze - Impressao - {hotel_name}",
            menu=pystray.Menu(*menu_items),
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
        if self.on_show:
            self.on_show()
            return
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
