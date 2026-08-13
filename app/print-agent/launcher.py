import ctypes

from fioreze_print_agent.app import main
from fioreze_print_agent.updater import UpdateError, bootstrap_installed_suite


if __name__ == "__main__":
    try:
        if bootstrap_installed_suite():
            raise SystemExit(0)
    except UpdateError as error:
        try:
            ctypes.windll.user32.MessageBoxW(0, str(error), "Fioreze Suite", 0x10)
        except (AttributeError, OSError):
            pass
        raise SystemExit(1) from error
    main()
