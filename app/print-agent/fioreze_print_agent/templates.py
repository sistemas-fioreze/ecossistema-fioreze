from datetime import datetime
from io import BytesIO
import json

from PIL import Image, ImageOps


ESC = b"\x1b"
GS = b"\x1d"


def render_print_job(job, logo_bytes=None):
    template = job.get("template", {})
    config = template.get("config", {})
    layout_key = config.get("layout_key") or template.get("key") or "legacy-thermal-42"
    if layout_key == "legacy-centro-elgin-48":
        return render_centro_job(job, logo_bytes)
    return render_classic_job(job, logo_bytes)


def render_classic_job(job, logo_bytes=None):
    config = job.get("template", {}).get("config", {})
    columns = int(config.get("paper_columns", 42))
    order = job["order"]
    copies = config.get("copies") or [{"title": "VIA ESTABELECIMENTO", "signature": False}]
    chunks = [ESC + b"@", ESC + b"t\x02"]
    logo = render_logo(logo_bytes, int(config.get("paper_width_pixels", 384))) if config.get("show_logo", True) else b""
    for copy in copies:
        if logo:
            chunks.append(logo)
        lines = [
            center(order.get("hotel_short_name") or order.get("hotel_name") or "FIOREZE", columns),
            center(copy.get("title", "COMPROVANTE"), columns),
            "=" * columns,
            row("PEDIDO", order.get("public_id", ""), columns),
            row("ACOMODACAO", order.get("room_code", ""), columns),
            row("HOSPEDE", order.get("guest_name", ""), columns),
            row("RECEBIDO", format_timestamp(order.get("created_at")), columns),
        ]
        if order.get("scheduled_for"):
            lines.append(row("AGENDADO", format_timestamp(order["scheduled_for"]), columns))
        lines.extend(["-" * columns, fit_columns("QTD ITEM", "VALOR", columns), "-" * columns])
        for item in order.get("items", []):
            lines.extend(render_item(item, columns, order.get("currency", "BRL")))
        lines.extend(["-" * columns, fit_columns("TOTAL", format_money(order.get("total_cents", 0)), columns)])
        if order.get("notes"):
            lines.extend(["-" * columns, "OBSERVACOES", *wrap_text(order["notes"], columns)])
        if copy.get("signature"):
            lines.extend(["", "", "_" * min(columns, 32), center("ASSINATURA", columns)])
        lines.extend(["", "", ""])
        chunks.append(("\n".join(lines) + "\n").encode("cp850", errors="replace"))
        chunks.append(GS + b"V\x00")
    return b"".join(chunks)


def render_centro_job(job, logo_bytes=None):
    config = job.get("template", {}).get("config", {})
    order = job["order"]
    columns = int(config.get("paper_columns", 48))
    copies = config.get("copies") or [
        {"title": "VIA COZINHA/RECEP", "signature": True},
        {"title": "VIA DO HOSPEDE", "signature": False},
    ]
    chunks = [ESC + b"@", ESC + b"t\x02"]
    logo = render_logo(logo_bytes, int(config.get("paper_width_pixels", 384))) if config.get("show_logo", True) else b""
    for copy in copies:
        if logo:
            chunks.append(logo)
        lines = [
            center(order.get("hotel_short_name") or order.get("hotel_name") or "FIOREZE CENTRO", columns),
            *[center(line, columns) for line in config.get("header_lines", [])],
            center(copy.get("title", "COMPROVANTE"), columns),
            "=" * columns,
            row("COMANDA", order.get("public_id", ""), columns),
            emphasized_value("APARTAMENTO", order.get("room_code", ""), columns),
            row("HOSPEDE", order.get("guest_name", ""), columns),
            row("LOCAL", order.get("delivery_location", "ACOMODACAO"), columns),
            row("SOLICITADO", format_timestamp(order.get("created_at")), columns),
            row("IMPRESSO", datetime.now().strftime("%d/%m/%Y %H:%M"), columns),
        ]
        if order.get("scheduled_for"):
            lines.append(row("AGENDADO", format_timestamp(order["scheduled_for"]), columns))
        lines.extend(["-" * columns, item_table_header(columns), "-" * columns])
        for item in order.get("items", []):
            lines.extend(render_centro_item(item, columns, order.get("currency", "BRL")))
        lines.extend(["-" * columns, fit_columns("TOTAL DO PEDIDO", format_money(order.get("total_cents", 0)), columns)])
        if order.get("notes"):
            lines.extend(["-" * columns, "OBSERVACOES", *wrap_text(order["notes"], columns)])
        if copy.get("signature"):
            lines.extend(["", "", "_" * min(columns, 36), center("RESPONSAVEL PELO PREPARO", columns)])
        for line in copy.get("footer_lines", config.get("guest_footer", []) if copy.get("title") == "VIA DO HOSPEDE" else []):
            lines.append(center(line, columns))
        lines.extend(["", "", ""])
        chunks.append(("\n".join(lines) + "\n").encode("cp850", errors="replace"))
        chunks.append(GS + b"V\x00")
    return b"".join(chunks)


def render_test_page(template, hotel_name, printer_name, logo_bytes=None):
    now = datetime.now().astimezone().isoformat()
    job = {
        "template": template,
        "order": {
            "hotel_name": hotel_name,
            "hotel_short_name": hotel_name,
            "public_id": "TESTE-LOCAL",
            "room_code": "000",
            "guest_name": "TESTE DE IMPRESSAO",
            "delivery_location": "RECEPCAO",
            "currency": "BRL",
            "total_cents": 100,
            "created_at": now,
            "notes": f"Teste local na impressora {printer_name}. Nao preparar.",
            "items": [{"name": "Item de demonstracao", "quantity": 1, "unit_price_cents": 100, "line_total_cents": 100}],
        },
    }
    return render_print_job(job, logo_bytes)


def render_logo(payload, max_width=384):
    if not payload:
        return b""
    try:
        with Image.open(BytesIO(payload)) as source:
            source.load()
            image = ImageOps.contain(source.convert("L"), (max_width, max_width), Image.Resampling.LANCZOS)
    except (OSError, ValueError):
        return b""
    image = image.point(lambda value: 255 if value > 180 else 0, mode="1")
    width_bytes = (image.width + 7) // 8
    raster = bytearray()
    pixels = image.load()
    for y in range(image.height):
        for byte_x in range(width_bytes):
            value = 0
            for bit in range(8):
                x = byte_x * 8 + bit
                if x < image.width and pixels[x, y] == 0:
                    value |= 1 << (7 - bit)
            raster.append(value)
    header = GS + b"v0\x00" + bytes((width_bytes & 0xFF, width_bytes >> 8, image.height & 0xFF, image.height >> 8))
    return ESC + b"a\x01" + header + bytes(raster) + b"\n" + ESC + b"a\x00"


def render_item(item, columns, currency):
    quantity = int(item.get("quantity", 0))
    name = str(item.get("name") or "Item")
    total = format_money(item.get("line_total_cents", 0), currency)
    prefix = f"{quantity}x "
    lines = wrap_text(prefix + name, max(10, columns - len(total) - 1))
    output = [fit_columns(lines[0], total, columns)]
    output.extend(lines[1:])
    options = format_item_options(item.get("selected_options_snapshot"))
    if options:
        output.extend(wrap_text(f"Obs.: {options}", columns))
    return output


def render_centro_item(item, columns, currency):
    quantity = int(item.get("quantity", 0))
    name = str(item.get("name") or "Item")
    unit = format_money(item.get("unit_price_cents", 0), currency)
    total = format_money(item.get("line_total_cents", 0), currency)
    left_width = max(16, columns - len(unit) - len(total) - 4)
    lines = wrap_text(f"{quantity}x {name}", left_width)
    output = [f"{lines[0]:<{left_width}} {unit:>10} {total:>10}"[:columns]]
    output.extend(lines[1:])
    options = format_item_options(item.get("selected_options_snapshot"))
    if options:
        output.extend(wrap_text(f"OPCOES: {options}", columns))
    return output


def format_item_options(value):
    if not value:
        return ""
    if not isinstance(value, str):
        parsed = value
    else:
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError):
            return value
    if not isinstance(parsed, dict):
        return str(parsed)
    parts = []
    selections = parsed.get("selections")
    if isinstance(selections, list):
        for selection in selections:
            if isinstance(selection, dict):
                label = selection.get("group_name") or selection.get("group") or selection.get("name")
                choice = selection.get("option_name") or selection.get("option") or selection.get("value")
                if choice:
                    parts.append(f"{label}: {choice}" if label else str(choice))
    note = parsed.get("note") or parsed.get("notes")
    if note:
        parts.append(str(note))
    return "; ".join(parts)


def item_table_header(columns):
    return f"{'QTD. DESCRICAO':<{columns - 22}} {'V.UNIT':>10} {'V.TOTAL':>10}"[:columns]


def emphasized_value(label, value, columns):
    return center(f"{label}: {value or '-'}", columns)


def format_money(cents, currency="BRL"):
    value = int(cents or 0) / 100
    if currency == "BRL":
        return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{currency} {value:.2f}"


def format_timestamp(value):
    if not value:
        return "-"
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return str(value)


def center(value, columns):
    return str(value)[:columns].center(columns)


def row(label, value, columns):
    return fit_columns(str(label), str(value), columns)


def fit_columns(left, right, columns):
    left = str(left)
    right = str(right)
    available = max(1, columns - len(right) - 1)
    return left[:available].ljust(available) + " " + right[: columns - available - 1]


def wrap_text(value, columns):
    words = str(value).split()
    lines = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= columns:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word[:columns]
    if current:
        lines.append(current)
    return lines or [""]
