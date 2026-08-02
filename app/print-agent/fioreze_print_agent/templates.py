from datetime import datetime
import json


ESC = b"\x1b"
GS = b"\x1d"


def render_print_job(job):
    config = job.get("template", {}).get("config", {})
    columns = int(config.get("paper_columns", 42))
    order = job["order"]
    copies = config.get("copies") or [{"title": "VIA ESTABELECIMENTO", "signature": False}]
    chunks = [ESC + b"@", ESC + b"t\x02"]
    for copy in copies:
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


def render_item(item, columns, currency):
    quantity = int(item.get("quantity", 0))
    name = str(item.get("name") or "Item")
    total = format_money(item.get("line_total_cents", 0), currency)
    prefix = f"{quantity}x "
    lines = wrap_text(prefix + name, max(10, columns - len(total) - 1))
    output = [fit_columns(lines[0], total, columns)]
    output.extend(lines[1:])
    options = item.get("selected_options_snapshot")
    if options:
        output.extend(wrap_text(f"Obs.: {format_item_options(options)}", columns))
    return output


def format_item_options(value):
    if not isinstance(value, str):
        return str(value)
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return value
    if isinstance(parsed, dict):
        return str(parsed.get("note") or parsed.get("notes") or value)
    return value


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
