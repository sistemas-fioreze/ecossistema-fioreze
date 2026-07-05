import os
import json
import time
import threading
import traceback
import webbrowser
import sys
import subprocess
import importlib
from datetime import datetime
import re
import ctypes
import platform

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)


def show_error(title, msg):
    try:
        ctypes.windll.user32.MessageBoxW(0, msg, title, 0x10)
    except Exception:
        pass


def bootstrap_log(msg):
    try:
        with open(os.path.join(BASE_DIR, "logs_impressao.txt"), "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] bootstrap | {msg}\n")
    except Exception:
        pass


def python_for_pip():
    exe = sys.executable
    try:
        folder = os.path.dirname(exe)
        name = os.path.basename(exe).lower()
        if name == "pythonw.exe":
            candidate = os.path.join(folder, "python.exe")
            if os.path.exists(candidate):
                return candidate
    except Exception:
        pass
    return exe


def subprocess_kwargs():
    kwargs = {"cwd": BASE_DIR, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if os.name == "nt" and hasattr(subprocess, "CREATE_NO_WINDOW"):
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    return kwargs


def install_packages(packages, label):
    bootstrap_log(f"instalando dependencias: {', '.join(packages)}")
    python_exe = python_for_pip()
    try:
        subprocess.run([python_exe, "-m", "ensurepip", "--upgrade"], timeout=120, **subprocess_kwargs())
    except Exception:
        pass
    try:
        subprocess.check_call([python_exe, "-m", "pip", "install", "--upgrade"] + list(packages), **subprocess_kwargs())
        bootstrap_log(f"dependencias instaladas: {label}")
        return True
    except Exception as exc:
        bootstrap_log(f"erro ao instalar {label}: {exc}")
        show_error("Erro", f"Nao consegui instalar automaticamente: {label}\n\nTente executar:\n{python_exe} -m pip install {' '.join(packages)}")
        return False


def ensure_modules(modules, packages, label, required=True):
    missing = []
    for module in modules:
        try:
            importlib.import_module(module)
        except Exception:
            missing.append(module)
    if missing:
        if not install_packages(packages, label):
            if required:
                os._exit(1)
            return False
    for module in modules:
        try:
            importlib.import_module(module)
        except Exception as exc:
            bootstrap_log(f"modulo ainda indisponivel {module}: {exc}")
            if required:
                show_error("Erro", f"Dependência não carregou: {label}\nReinicie o servidor ou instale manualmente.")
                os._exit(1)
            return False
    return True


ensure_modules(["gspread", "oauth2client"], ["gspread", "oauth2client"], "Google Sheets")
ensure_modules(["win32print"], ["pywin32"], "impressão Windows")
ensure_modules(["PIL", "pystray"], ["Pillow", "pystray"], "ícone da bandeja")
HAS_FLASK = ensure_modules(["flask", "flask_cors"], ["Flask", "flask-cors"], "API local Flask", required=False)
ensure_modules(["winotify"], ["winotify"], "notificações do Windows", required=False)

import gspread
from oauth2client.service_account import ServiceAccountCredentials
import win32print
from PIL import Image
import pystray
from pystray import MenuItem, Menu, Icon

if HAS_FLASK:
    from flask import Flask, jsonify, request
    from flask_cors import CORS
else:
    Flask = None
    CORS = None

try:
    import winsound
except ImportError:
    winsound = None

try:
    from winotify import Notification
except Exception:
    Notification = None


CONFIG_FILE = "config.json"
STATUS_FILE = "status.json"
LOG_FILE = "logs_impressao.txt"
COUNTER_FILE = "contador.txt"

DEFAULT_CONFIG = {
    "nome_hotel": "Hotel Fioreze",
    "spreadsheet_id": "GOOGLE_SHEET_ID_REMOVIDO",
    "worksheet_name": "Pedidos",
    "printer_name": "CAMINHO_IMPRESSORA_EXEMPLO",
    "creds_file": "CREDENCIAL_NAO_VERSIONADA",
    "logo_file": "logo.png",
    "vias": 2,
    "modo_vias": "hotel_cliente",
    "notificacao_windows": True,
    "impressao_automatica": True,
    "intervalo_busca_segundos": 5,
    "api_host": "127.0.0.1",
    "api_port": 5050
}

DEFAULT_STATUS = {
    "servidor": "offline",
    "impressora_configurada": DEFAULT_CONFIG["printer_name"],
    "impressao_automatica": DEFAULT_CONFIG["impressao_automatica"],
    "ultimo_pedido_impresso": None,
    "ultima_data_hora_impressao": None,
    "ultimo_erro": None,
    "total_impressoes_sessao": 0,
    "conexao_planilha": "desconectado",
    "status_geral": "offline",
    "api": "aguardando inicio",
    "iniciado_em": None,
    "atualizado_em": None
}

PRINT_QUEUE_STATUSES = {"novo", "reimprimir", "recebido", "entregue", "pendente"}
PRINT_DONE_STATUSES = {"", "impresso", "erro_impressao", "erro impressão", "erro impressao"}

CONFIG_LOCK = threading.RLock()
STATUS_LOCK = threading.RLock()

CONFIG = {}
STATUS = {}
rodando = True
ultimo_pedido = None
contador = 1
tray_icon = None
LAST_SHEET_ERROR = ""
LAST_SHEET_ERROR_TS = 0


def now_str():
    return datetime.now().strftime("%d/%m/%Y %H:%M:%S")


def today_date_str():
    return datetime.now().strftime("%d/%m/%Y")


def iso_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def erro_texto(exc):
    try:
        texto = str(exc)
    except Exception:
        texto = ""
    if texto:
        return texto
    try:
        cause = getattr(exc, "__cause__", None) or getattr(exc, "__context__", None)
        if cause:
            cause_text = erro_texto(cause)
            if cause_text:
                return cause_text
    except Exception:
        pass
    try:
        if getattr(exc, "args", None):
            return repr(exc.args)
    except Exception:
        pass
    try:
        texto = repr(exc)
        if texto and texto != "()":
            return texto
    except Exception:
        pass
    try:
        return exc.__class__.__name__
    except Exception:
        return "Erro sem detalhe informado."


def safe_path(file_name):
    return os.path.join(BASE_DIR, str(file_name or ""))


def read_json_file(path, fallback):
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return dict(fallback)


def write_json_file(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def log_event(evento, detalhe=""):
    linha = f"[{iso_str()}] {evento}"
    if detalhe:
        linha += f" | {detalhe}"
    try:
        with open(safe_path(LOG_FILE), "a", encoding="utf-8") as f:
            f.write(linha + "\n")
    except Exception:
        pass


def log_sheet_error(msg):
    global LAST_SHEET_ERROR, LAST_SHEET_ERROR_TS
    now_ts = time.time()
    if msg == LAST_SHEET_ERROR and (now_ts - LAST_SHEET_ERROR_TS) < 60:
        return
    LAST_SHEET_ERROR = msg
    LAST_SHEET_ERROR_TS = now_ts
    log_event("erro de conexao com planilha", msg)


def load_config():
    global CONFIG
    with CONFIG_LOCK:
        loaded = read_json_file(safe_path(CONFIG_FILE), DEFAULT_CONFIG)
        merged = dict(DEFAULT_CONFIG)
        merged.update({k: loaded.get(k, v) for k, v in DEFAULT_CONFIG.items()})
        try:
            merged["vias"] = max(1, int(merged.get("vias", 2)))
        except Exception:
            merged["vias"] = 2
        modo = str(merged.get("modo_vias") or "").strip().lower()
        if modo not in ("hotel", "hotel_cliente"):
            modo = "hotel" if int(merged.get("vias", 2) or 2) <= 1 else "hotel_cliente"
        merged["modo_vias"] = modo
        merged["vias"] = 1 if modo == "hotel" else 2
        merged["notificacao_windows"] = bool(merged.get("notificacao_windows", True))
        try:
            merged["intervalo_busca_segundos"] = max(1, int(merged.get("intervalo_busca_segundos", 5)))
        except Exception:
            merged["intervalo_busca_segundos"] = 5
        try:
            merged["api_port"] = int(merged.get("api_port", 5050))
        except Exception:
            merged["api_port"] = 5050
        merged["impressao_automatica"] = bool(merged.get("impressao_automatica", True))
        CONFIG = merged
        write_json_file(safe_path(CONFIG_FILE), CONFIG)
        return dict(CONFIG)


def get_config():
    with CONFIG_LOCK:
        return dict(CONFIG)


def save_config(new_values, log_change=True):
    global CONFIG
    allowed = set(DEFAULT_CONFIG.keys())
    cleaned = {}
    for key, value in (new_values or {}).items():
        if key in allowed:
            cleaned[key] = value
    with CONFIG_LOCK:
        cfg = dict(CONFIG)
        cfg.update(cleaned)
        modo = str(cfg.get("modo_vias") or "").strip().lower()
        if modo not in ("hotel", "hotel_cliente"):
            modo = "hotel" if int(cfg.get("vias", 2) or 2) <= 1 else "hotel_cliente"
        cfg["modo_vias"] = modo
        cfg["vias"] = 1 if modo == "hotel" else 2
        cfg["notificacao_windows"] = bool(cfg.get("notificacao_windows", True))
        CONFIG = cfg
        write_json_file(safe_path(CONFIG_FILE), CONFIG)
    if log_change:
        log_event("configuracao alterada", ", ".join(sorted(cleaned.keys())) or "sem alteracoes")
    refresh_status_from_config()
    return get_config()


def load_status():
    global STATUS
    with STATUS_LOCK:
        loaded = read_json_file(safe_path(STATUS_FILE), DEFAULT_STATUS)
        merged = dict(DEFAULT_STATUS)
        merged.update(loaded)
        merged["servidor"] = "online"
        merged["status_geral"] = "ok"
        merged["iniciado_em"] = merged.get("iniciado_em") or now_str()
        merged["atualizado_em"] = now_str()
        STATUS = merged
        write_json_file(safe_path(STATUS_FILE), STATUS)
        return dict(STATUS)


def update_status(**kwargs):
    global STATUS
    with STATUS_LOCK:
        if not STATUS:
            STATUS = dict(DEFAULT_STATUS)
        STATUS.update(kwargs)
        STATUS["atualizado_em"] = now_str()
        try:
            write_json_file(safe_path(STATUS_FILE), STATUS)
        except Exception:
            pass
        return dict(STATUS)


def get_status():
    with STATUS_LOCK:
        return dict(STATUS)


def refresh_status_from_config():
    cfg = get_config()
    status_geral = "pausado" if not cfg.get("impressao_automatica") else "ok"
    update_status(
        impressora_configurada=cfg.get("printer_name"),
        impressao_automatica=cfg.get("impressao_automatica"),
        status_geral=status_geral
    )


def load_counter():
    global contador
    try:
        if os.path.exists(safe_path(COUNTER_FILE)):
            conteudo = open(safe_path(COUNTER_FILE), "r", encoding="utf-8").read().strip()
            contador = int(conteudo) if conteudo else 1
        else:
            contador = 1
    except Exception:
        contador = 1


def save_counter():
    try:
        with open(safe_path(COUNTER_FILE), "w", encoding="utf-8") as f:
            f.write(str(contador))
    except Exception as exc:
        log_event("erro ao salvar contador", str(exc))


def fmt_brl(valor):
    try:
        return f"{float(valor):.2f}".replace(".", ",")
    except Exception:
        return "0,00"


def to_float(valor):
    try:
        if isinstance(valor, (int, float)):
            return float(valor)
        txt = str(valor).strip().replace("R$", "").replace(".", "").replace(",", ".")
        return float(txt)
    except Exception:
        return 0.0


def notificar(quarto, comanda):
    if not get_config().get("notificacao_windows", True):
        return
    if Notification is None:
        return
    try:
        cfg = get_config()
        toast = Notification(
            app_id=cfg.get("nome_hotel", "Room Service"),
            title="Novo Pedido",
            msg=f"Apto {quarto} | Comanda #{comanda:03d}",
            duration="short"
        )
        toast.show()
    except Exception:
        pass


def salvar_historico(texto):
    hoje = datetime.now().strftime("%d-%m-%Y")
    try:
        with open(safe_path(f"historico_{hoje}.txt"), "a", encoding="utf-8") as f:
            f.write(texto + "\n\n============================\n\n")
    except Exception as exc:
        log_event("erro ao salvar historico", str(exc))


def montar_itens(texto_pedido):
    itens = []
    texto_pedido = str(texto_pedido or "").strip()
    if not texto_pedido:
        return itens

    partes = [p.strip() for p in texto_pedido.split(",") if p.strip()]
    for parte in partes:
        m = re.match(r"(.+?)\s*x\s*(\d+)\s*-\s*R\$\s*([\d\.,]+)", parte, re.IGNORECASE)
        if m:
            nome = m.group(1).strip()
            qtd = int(m.group(2))
            tot_item = float(m.group(3).replace(",", "."))
            val_unit = tot_item / qtd if qtd > 0 else tot_item
            nome_lines = [nome[i:i + 20] for i in range(0, len(nome), 20)] or [nome]
            qtd_str = str(qtd).ljust(3)
            vun_str = fmt_brl(val_unit).rjust(7)
            vtot_str = fmt_brl(tot_item).rjust(8)
            itens.append(f"{qtd_str} {nome_lines[0].ljust(20)} {vun_str} {vtot_str}")
            for extra in nome_lines[1:]:
                itens.append(f"    {extra}")
        else:
            itens.append(parte[:42])
    return itens


def conectar_planilha():
    cfg = get_config()
    try:
        scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
        creds = ServiceAccountCredentials.from_json_keyfile_name(safe_path(cfg.get("creds_file")), scope)
        client = gspread.authorize(creds)
        sheet = client.open_by_key(cfg.get("spreadsheet_id")).worksheet(cfg.get("worksheet_name"))
        update_status(conexao_planilha="conectado", ultimo_erro=None, status_geral="ok" if cfg.get("impressao_automatica") else "pausado")
        log_event("conexao com planilha", f"aba={cfg.get('worksheet_name')}")
        return sheet, "Conectado"
    except Exception as exc:
        msg = erro_texto(exc)
        if "invalid_grant" in msg.lower() or "invalid jwt signature" in msg.lower():
            msg = (
                "Falha na autenticacao do Google Sheets. Verifique se o arquivo CREDENCIAL_NAO_VERSIONADA e o correto, "
                "se a conta de servico tem acesso a planilha e se a data/hora do Windows esta correta. "
                f"Detalhe tecnico: {msg}"
            )
        elif "does not have permission" in msg.lower() or "[403]" in msg:
            email = credenciais_resumo().get("client_email") or "client_email da conta de servico"
            msg = (
                "Sem permissao para abrir a planilha Google. Compartilhe a planilha configurada com "
                f"{email} como Editor, ou confira se o spreadsheet_id do config.json e o da planilha correta. "
                f"Detalhe tecnico: {msg}"
            )
        update_status(conexao_planilha="erro", ultimo_erro=msg, status_geral="erro")
        log_sheet_error(msg)
        return None, msg


def listar_impressoras():
    try:
        flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        printers = []
        default_name = ""
        try:
            default_name = win32print.GetDefaultPrinter()
        except Exception:
            default_name = ""
        for p in win32print.EnumPrinters(flags):
            nome = p[2]
            printers.append({"name": nome, "default": nome == default_name})
        return printers
    except Exception as exc:
        log_event("erro ao listar impressoras", str(exc))
        return []


def imprimir_logo(handle):
    try:
        cfg = get_config()
        caminho = safe_path(cfg.get("logo_file"))
        if not os.path.exists(caminho):
            return
        img = Image.open(caminho).convert("1")
        largura_max = 220
        if img.width > largura_max:
            img = img.resize((largura_max, int(img.height * (largura_max / img.width))))
        width, height = img.size
        bytes_per_line = (width + 7) // 8
        data = bytearray()
        pixels = img.load()
        for y in range(height):
            for x in range(0, width, 8):
                byte = 0
                for bit in range(8):
                    if x + bit < width and pixels[x + bit, y] == 0:
                        byte |= (1 << (7 - bit))
                data.append(byte)
        comando = b"\x1d\x76\x30\x00" + bytes([bytes_per_line % 256, bytes_per_line // 256]) + bytes([height % 256, height // 256])
        win32print.WritePrinter(handle, b"\x1b\x61\x01")
        win32print.WritePrinter(handle, comando + data)
        win32print.WritePrinter(handle, b"\n")
    except Exception as exc:
        log_event("erro ao imprimir logo", str(exc))


def imprimir(d):
    cfg = get_config()
    printer_name = cfg.get("printer_name")
    cols = 42
    historico_partes = []

    def linha(char="-"):
        return char * cols + "\n"

    def centro(txt):
        return str(txt or "")[:cols].center(cols) + "\n"

    def escrever_em(handle, txt):
        win32print.WritePrinter(handle, str(txt).encode("cp850", errors="replace"))

    def comando_em(handle, raw):
        win32print.WritePrinter(handle, raw)

    def imprimir_uma_via(titulo_via, assinatura=False):
        handle = None
        texto_via = ""
        try:
            handle = win32print.OpenPrinter(printer_name)
            win32print.StartDocPrinter(handle, 1, ("Pedido Room Service", None, "RAW"))
            win32print.StartPagePrinter(handle)

            comando_em(handle, b"\x1b\x40")
            comando_em(handle, b"\x1bt\x02")
            try:
                comando_em(handle, b"\x1b\x42\x04\x02")
            except Exception:
                pass

            comando_em(handle, b"\x1b\x61\x01")
            comando_em(handle, b"\x1b\x45\x01")
            escrever_em(handle, "Muller & Fioreze - Hotel Boutique\n")
            comando_em(handle, b"\x1b\x45\x00")
            escrever_em(handle, "R. Júlio Hanke, 184 - Carniel - Gramado RS\n")
            escrever_em(handle, "(54) 3286-2508 - Recepção Ramal \n")
            escrever_em(handle, linha())
            escrever_em(handle, "\n")
            escrever_em(handle, centro(titulo_via))
            escrever_em(handle, linha())
            escrever_em(handle, "\n")

            comando_em(handle, b"\x1d\x21\x11")
            escrever_em(handle, f"APTO {d.get('quarto', '-')}\n")
            comando_em(handle, b"\x1d\x21\x00")

            texto_via += f"COMANDA: {int(d.get('comanda', 0)):03d}\n"
            texto_via += f"HOSPEDE: {d.get('nome', '-')}\n"
            texto_via += f"LOCAL: {d.get('consumo', 'Nao informado')}\n"
            texto_via += f"ATENDENTE: {d.get('atendente', 'Online')}\n"
            texto_via += f"RECEBIDO: {d.get('criado', '-')}\n"
            texto_via += f"IMPRESSO: {d.get('impresso', '-')}\n"
            texto_via += linha()
            texto_via += "\n"
            texto_via += "QTD DESCRICAO         UNIT   TOTAL\n"
            texto_via += linha()
            texto_via += "\n"

            for item in d.get("itens", []):
                texto_via += item[:cols] + "\n"

            texto_via += linha()
            texto_via += "\n"
            escrever_em(handle, texto_via)

            comando_em(handle, b"\x1b\x45\x01")
            escrever_em(handle, f"TOTAL: R$ {fmt_brl(d.get('total', 0))}".rjust(cols) + "\n")
            comando_em(handle, b"\x1b\x45\x00")

            obs = str(d.get("observacao", "") or "").strip()
            if obs and obs.lower() != "pedido via site":
                obs_txt = "\n" + linha() + "\nOBSERVACAO:\n"
                for i in range(0, len(obs), cols):
                    obs_txt += obs[i:i + cols] + "\n"
                escrever_em(handle, obs_txt)
                texto_via += obs_txt

            if assinatura:
                escrever_em(handle, "\n")
                escrever_em(handle, "\n")
                escrever_em(handle, linha())
                escrever_em(handle, "\n")
                escrever_em(handle, centro("ASSINATURA DO HOSPEDE"))

            escrever_em(handle, "\n\n\n\n\n\n")
            comando_em(handle, b"\x1d\x56\x00")
            win32print.EndPagePrinter(handle)
            win32print.EndDocPrinter(handle)
            win32print.ClosePrinter(handle)
            historico_partes.append(f"{titulo_via}\n{texto_via}")
            return True
        except Exception:
            try:
                if handle:
                    win32print.ClosePrinter(handle)
            except Exception:
                pass
            raise

    try:
        log_event("impressao iniciada", f"apto={d.get('quarto')} impressora={printer_name}")
        modo = str(cfg.get("modo_vias") or "hotel_cliente").strip().lower()
        imprimir_uma_via("VIA ESTABELECIMENTO", assinatura=False)
        if modo != "hotel":
            time.sleep(0.2)
            imprimir_uma_via("VIA DO HOSPEDE", assinatura=True)

        salvar_historico("\n\n".join(historico_partes))
        log_event("impressao concluida", f"apto={d.get('quarto')} comanda={d.get('comanda'):03d} modo={modo}")
        return True
    except Exception as exc:
        msg = erro_texto(exc)
        log_event("erro de impressao", msg)
        update_status(ultimo_erro=msg, status_geral="erro")
        return False

def imprimir_teste():
    cfg = get_config()
    pedido = {
        "comanda": 0,
        "nome": "TESTE DO SISTEMA",
        "quarto": "TESTE",
        "consumo": "Servidor local",
        "atendente": "ERP",
        "observacao": f"Teste de impressao em {cfg.get('printer_name')}",
        "itens": montar_itens("Comanda de teste x1 - R$ 0,00"),
        "total": 0,
        "criado": now_str(),
        "impresso": now_str()
    }
    return imprimir(pedido)


def montar_pedido_da_linha(linha):
    global contador
    data = str(linha[0]).strip() if len(linha) > 0 else ""
    nome = str(linha[1]).strip() if len(linha) > 1 else ""
    quarto = str(linha[2]).strip() if len(linha) > 2 else ""
    pedido_txt = str(linha[3]).strip() if len(linha) > 3 else ""
    total_raw = str(linha[4]).strip() if len(linha) > 4 else ""
    consumo = str(linha[6]).strip() if len(linha) > 6 else ""
    atendente = str(linha[7]).strip() if len(linha) > 7 else "Online"
    observacao = str(linha[9]).strip() if len(linha) > 9 else ""

    if not any([nome, quarto, pedido_txt]):
        return None

    return {
        "comanda": contador,
        "nome": nome,
        "quarto": quarto,
        "consumo": consumo if consumo else "Nao informado",
        "atendente": atendente if atendente else "Online",
        "observacao": observacao,
        "itens": montar_itens(pedido_txt),
        "total": to_float(total_raw),
        "criado": data,
        "impresso": now_str()
    }


def registrar_sucesso_pedido(sheet, linha_num, pedido, status_impresso):
    global contador, ultimo_pedido
    ultimo_pedido = pedido
    sheet.update_cell(linha_num, 6, "impresso")
    total = get_status().get("total_impressoes_sessao", 0) or 0
    update_status(
        ultimo_pedido_impresso=f"Apto {pedido.get('quarto')} | Comanda #{pedido.get('comanda'):03d}",
        ultima_data_hora_impressao=now_str(),
        total_impressoes_sessao=total + 1,
        ultimo_erro=None,
        status_geral="ok"
    )
    log_event("pedido marcado como impresso", f"linha={linha_num}")
    if str(status_impresso).strip().lower() != "reimprimir":
        contador += 1
        save_counter()


def registrar_erro_pedido(sheet, linha_num, erro):
    try:
        sheet.update_cell(linha_num, 6, "erro_impressao")
    except Exception as exc:
        log_event("erro ao marcar erro_impressao", str(exc))
    update_status(ultimo_erro=str(erro), status_geral="erro")


def status_deve_imprimir(status_impresso, linha):
    status = str(status_impresso or "").strip().lower()
    if status in PRINT_QUEUE_STATUSES:
        return True
    if status == "":
        data_linha = str(linha[0] if len(linha) > 0 else "")
        tem_pedido = any(str(linha[i]).strip() for i in (1, 2, 3) if len(linha) > i)
        return tem_pedido and today_date_str() in data_linha
    if status in PRINT_DONE_STATUSES:
        return False
    return False


def motor_principal():
    global rodando
    sheet = None
    log_event("servidor iniciado")

    while rodando:
        cfg = get_config()
        intervalo = max(1, int(cfg.get("intervalo_busca_segundos", 5) or 5))

        if not cfg.get("impressao_automatica", True):
            update_status(status_geral="pausado", impressao_automatica=False)
            time.sleep(intervalo)
            continue

        try:
            if sheet is None:
                sheet, _ = conectar_planilha()
                if sheet is None:
                    time.sleep(intervalo)
                    continue

            linhas = sheet.get_all_values()
            if len(linhas) > 1:
                for i, linha in enumerate(linhas[1:], start=2):
                    if not rodando:
                        break
                    if len(linha) < 5:
                        continue

                    status_impresso = str(linha[5]).strip().lower() if len(linha) > 5 else ""
                    if not status_deve_imprimir(status_impresso, linha):
                        if status_impresso not in PRINT_DONE_STATUSES:
                            log_event("pedido ignorado por status de impressao", f"linha={i} status={status_impresso}")
                        continue

                    pedido = montar_pedido_da_linha(linha)
                    if pedido is None:
                        continue

                    log_event("pedido encontrado", f"linha={i} apto={pedido.get('quarto')} status={status_impresso}")
                    try:
                        if winsound:
                            winsound.Beep(1200, 300)
                    except Exception:
                        pass
                    notificar(pedido["quarto"], pedido["comanda"])

                    if imprimir(pedido):
                        registrar_sucesso_pedido(sheet, i, pedido, status_impresso)
                    else:
                        registrar_erro_pedido(sheet, i, get_status().get("ultimo_erro") or "Falha de impressao")

            time.sleep(intervalo)

        except Exception as exc:
            log_event("erro no motor principal", f"{exc}\n{traceback.format_exc()}")
            update_status(conexao_planilha="erro", ultimo_erro=erro_texto(exc), status_geral="erro")
            sheet = None
            time.sleep(intervalo)


def get_public_config():
    cfg = get_config()
    return dict(cfg)


def credenciais_resumo():
    cfg = get_config()
    caminho = safe_path(cfg.get("creds_file"))
    info = {
        "arquivo": caminho,
        "existe": os.path.exists(caminho),
        "type": None,
        "project_id": None,
        "client_email": None,
        "private_key_id": None,
        "private_key_presente": False,
        "private_key_formato_ok": False,
        "erro": None
    }
    if not info["existe"]:
        info["erro"] = "Arquivo de credenciais nao encontrado."
        return info
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            data = json.load(f)
        private_key = str(data.get("private_key") or "")
        private_key_id = str(data.get("private_key_id") or "")
        info.update({
            "type": data.get("type"),
            "project_id": data.get("project_id"),
            "client_email": data.get("client_email"),
            "private_key_id": (private_key_id[:8] + "...") if private_key_id else "",
            "private_key_presente": bool(private_key),
            "private_key_formato_ok": "CREDENCIAL_NAO_VERSIONADA" in private_key and "END PRIVATE KEY" in private_key,
        })
        if data.get("type") != "service_account":
            info["erro"] = "O JSON nao parece ser de uma conta de servico."
        elif not info["private_key_formato_ok"]:
            info["erro"] = "A chave privada esta ausente ou com formato invalido."
    except Exception as exc:
        info["erro"] = erro_texto(exc)
    return info


def diagnostico_local():
    cfg = get_config()
    return {
        "success": True,
        "hora_local": now_str(),
        "timezone_windows": time.tzname,
        "python": sys.version.split()[0],
        "sistema": platform.platform(),
        "base_dir": BASE_DIR,
        "status": get_status(),
        "config": get_public_config(),
        "credenciais": credenciais_resumo(),
        "dica_invalid_jwt": (
            "Se aparecer Invalid JWT Signature, confira a data/hora do Windows, "
            "compartilhe a planilha com o client_email da conta de servico ou gere uma nova chave JSON."
        )
    }


def ultimas_linhas_log(qtd=200):
    try:
        qtd = max(1, min(1000, int(qtd)))
    except Exception:
        qtd = 200
    try:
        with open(safe_path(LOG_FILE), "r", encoding="utf-8") as f:
            linhas = f.readlines()
        return [l.rstrip("\n") for l in linhas[-qtd:]]
    except Exception:
        return []


def create_api_app():
    app = Flask(__name__)
    CORS(app)

    @app.get("/")
    def api_home():
        st = get_status()
        cfg = get_public_config()
        erro = st.get("ultimo_erro") or "Nenhum"
        html = f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Servidor de Impressao</title>
  <style>
    body{{font-family:Arial,sans-serif;background:#f7f5ef;color:#202124;margin:0;padding:28px}}
    main{{max-width:760px;margin:auto;background:#fff;border:1px solid #ece4dc;border-radius:14px;padding:22px}}
    h1{{font-size:22px;margin:0 0 6px}} p{{margin:6px 0;color:#5f6368;font-weight:700}}
    dl{{display:grid;grid-template-columns:210px 1fr;gap:10px;margin-top:20px}}
    dt{{font-size:11px;text-transform:uppercase;color:#9aa1ad;font-weight:900}} dd{{margin:0;font-weight:900;word-break:break-word}}
    .ok{{color:#15803d}} .erro{{color:#dc2626}} .pausado{{color:#b45309}}
    a{{color:#513b2d;font-weight:900}}
  </style>
</head>
<body>
  <main>
    <h1>Servidor de Impressao</h1>
    <p>{cfg.get("nome_hotel", "Room Service")}</p>
    <dl>
      <dt>Status geral</dt><dd class="{st.get("status_geral", "offline")}">{st.get("status_geral", "offline")}</dd>
      <dt>Servidor</dt><dd>{st.get("servidor", "-")}</dd>
      <dt>API</dt><dd>{st.get("api", "-")}</dd>
      <dt>Impressora</dt><dd>{st.get("impressora_configurada", "-")}</dd>
      <dt>Automatica</dt><dd>{"Ativa" if st.get("impressao_automatica") else "Pausada"}</dd>
      <dt>Planilha</dt><dd>{st.get("conexao_planilha", "-")}</dd>
      <dt>Ultima impressao</dt><dd>{st.get("ultima_data_hora_impressao") or "-"}</dd>
      <dt>Ultimo pedido</dt><dd>{st.get("ultimo_pedido_impresso") or "-"}</dd>
      <dt>Ultimo erro</dt><dd>{erro}</dd>
    </dl>
    <p style="margin-top:22px"><a href="/status">Ver JSON de status</a> &nbsp; <a href="/diagnostics">Diagnostico</a> &nbsp; <a href="/logs">Ver logs</a> &nbsp; <a href="/printers">Ver impressoras</a></p>
  </main>
</body>
</html>"""
        return html

    @app.get("/health")
    def api_health():
        return jsonify({"success": True, "status": get_status().get("status_geral", "offline")})

    @app.get("/status")
    def api_status():
        return jsonify(get_status())

    @app.get("/diagnostics")
    def api_diagnostics():
        return jsonify(diagnostico_local())

    @app.get("/config")
    def api_config_get():
        return jsonify(get_public_config())

    @app.post("/config")
    def api_config_post():
        data = request.get_json(silent=True) or {}
        cfg = save_config(data)
        if tray_icon:
            try:
                tray_icon.menu = build_tray_menu()
                tray_icon.update_menu()
            except Exception:
                pass
        return jsonify({"success": True, "config": cfg})

    @app.get("/printers")
    def api_printers():
        return jsonify({"printers": listar_impressoras(), "selected": get_config().get("printer_name")})

    @app.post("/test-print")
    def api_test_print():
        ok = imprimir_teste()
        return jsonify({"success": ok, "error": None if ok else get_status().get("ultimo_erro")}), (200 if ok else 500)

    @app.post("/pause")
    def api_pause():
        cfg = save_config({"impressao_automatica": False})
        log_event("impressao pausada", "api")
        return jsonify({"success": True, "config": cfg, "status": get_status()})

    @app.post("/resume")
    def api_resume():
        cfg = save_config({"impressao_automatica": True})
        log_event("impressao retomada", "api")
        return jsonify({"success": True, "config": cfg, "status": get_status()})

    @app.post("/reprint-last")
    def api_reprint_last():
        if not ultimo_pedido:
            return jsonify({"success": False, "error": "Nenhum pedido impresso nesta sessao."}), 404
        ok = imprimir(ultimo_pedido)
        return jsonify({"success": ok, "error": None if ok else get_status().get("ultimo_erro")}), (200 if ok else 500)

    @app.get("/logs")
    def api_logs():
        return jsonify({"logs": ultimas_linhas_log(request.args.get("lines", 200))})

    return app


def run_api_server():
    if Flask is None:
        log_event("api local indisponivel", "Instale Flask e flask-cors")
        update_status(api="erro: Flask nao instalado")
        return
    cfg = get_config()
    try:
        api_url = f"http://{cfg.get('api_host')}:{cfg.get('api_port')}"
        update_status(api=api_url)
        log_event("api local iniciando", api_url)
        app = create_api_app()
        app.run(host=cfg.get("api_host"), port=int(cfg.get("api_port")), debug=False, use_reloader=False, threaded=True)
    except Exception as exc:
        log_event("erro na api local", str(exc))
        update_status(api=f"erro: {exc}", ultimo_erro=erro_texto(exc), status_geral="erro")


def acao_reimprimir(icon, item):
    if ultimo_pedido:
        ok = imprimir(ultimo_pedido)
        if ok:
            log_event("reimpressao do ultimo pedido", "tray")
    else:
        log_event("reimpressao solicitada sem ultimo pedido", "tray")


def acao_nenhuma(icon, item):
    pass


def acao_pausar(icon, item):
    save_config({"impressao_automatica": False})
    log_event("impressao pausada", "tray")
    try:
        icon.menu = build_tray_menu()
        icon.update_menu()
    except Exception:
        pass


def acao_retomar(icon, item):
    save_config({"impressao_automatica": True})
    log_event("impressao retomada", "tray")
    try:
        icon.menu = build_tray_menu()
        icon.update_menu()
    except Exception:
        pass


def acao_teste(icon, item):
    imprimir_teste()


def acao_status(icon, item):
    cfg = get_config()
    webbrowser.open(f"http://{cfg.get('api_host')}:{cfg.get('api_port')}/")


def acao_atualizar_menu(icon, item):
    try:
        icon.menu = build_tray_menu()
        icon.update_menu()
    except Exception:
        pass


def make_printer_action(nome):
    def action(icon, item):
        save_config({"printer_name": nome})
        log_event("impressora selecionada", nome)
        try:
            icon.menu = build_tray_menu()
            icon.update_menu()
        except Exception:
            pass
    return action


def build_printer_menu():
    cfg = get_config()
    printers = listar_impressoras()
    items = []
    if not printers:
        return Menu(MenuItem("Nenhuma impressora encontrada", acao_nenhuma, enabled=False))
    for p in printers:
        nome = p["name"]
        checked = lambda item, n=nome: get_config().get("printer_name") == n
        items.append(MenuItem(nome, make_printer_action(nome), checked=checked, radio=True))
    return Menu(*items)


def build_tray_menu():
    cfg = get_config()
    pausado = not cfg.get("impressao_automatica", True)
    pause_item = MenuItem("Pausar Impressao", acao_pausar, enabled=not pausado)
    resume_item = MenuItem("Retomar Impressao", acao_retomar, enabled=pausado)
    return Menu(
        MenuItem(f"Status: {'Pausado' if pausado else 'Online'}", acao_nenhuma, enabled=False),
        MenuItem(f"Impressora: {cfg.get('printer_name')}", acao_nenhuma, enabled=False),
        MenuItem("Selecionar Impressora", build_printer_menu()),
        MenuItem("Atualizar Lista de Impressoras", acao_atualizar_menu),
        pause_item,
        resume_item,
        MenuItem("Imprimir Teste", acao_teste),
        MenuItem("Reimprimir Ultimo", acao_reimprimir),
        MenuItem("Abrir Status no Navegador", acao_status),
        MenuItem("Encerrar Servidor", acao_encerrar)
    )


def acao_encerrar(icon, item):
    global rodando
    rodando = False
    update_status(servidor="offline", status_geral="offline", api="encerrado")
    log_event("servidor encerrado", "tray")
    try:
        icon.stop()
    except Exception:
        pass
    os._exit(0)


def load_tray_image():
    cfg = get_config()
    candidates = [cfg.get("logo_file"), "icon.ico", "logo.png", "logo ff.png"]
    for candidate in candidates:
        if not candidate:
            continue
        try:
            path = safe_path(candidate)
            if not os.path.exists(path):
                continue
            img = Image.open(path).convert("RGBA")
            if img.mode == "RGBA":
                alpha_box = img.getbbox()
                if alpha_box:
                    img = img.crop(alpha_box)
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            bg.alpha_composite(img)
            pixels = bg.convert("RGB")
            bbox = pixels.point(lambda p: 0 if p > 245 else 255).getbbox()
            if bbox:
                img = img.crop(bbox)
            if img.width / max(1, img.height) > 1.8:
                crop_w = min(img.width, int(img.height * 1.25))
                img = img.crop((0, 0, crop_w, img.height))
            img.thumbnail((56, 56))
            canvas = Image.new("RGBA", (64, 64), (255, 255, 255, 0))
            x = (64 - img.width) // 2
            y = (64 - img.height) // 2
            canvas.paste(img, (x, y), img)
            return canvas
        except Exception as exc:
            bootstrap_log(f"erro ao carregar icone {candidate}: {exc}")
    return Image.new("RGB", (64, 64), color="#513b2d")


def setup_tray():
    global tray_icon
    imagem = load_tray_image()

    tray_icon = Icon("FiorezeServer", imagem, "Servidor de Impressao Room Service", build_tray_menu())

    threading.Thread(target=motor_principal, daemon=True).start()
    threading.Thread(target=run_api_server, daemon=True).start()

    tray_icon.run()


if __name__ == "__main__":
    load_config()
    load_status()
    load_counter()
    refresh_status_from_config()
    setup_tray()
