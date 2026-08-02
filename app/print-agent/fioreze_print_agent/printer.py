import os


def list_printers():
    if os.name != "nt":
        return []
    import win32print

    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    return sorted({entry[2] for entry in win32print.EnumPrinters(flags)})


def print_raw(printer_name, payload, document_name):
    if os.name != "nt":
        raise RuntimeError("Impressao disponivel apenas no Windows.")
    import win32print

    handle = win32print.OpenPrinter(printer_name)
    try:
        job = win32print.StartDocPrinter(handle, 1, (document_name, None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)
            win32print.WritePrinter(handle, payload)
            win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
        return job
    finally:
        win32print.ClosePrinter(handle)
