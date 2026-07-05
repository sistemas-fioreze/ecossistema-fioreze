import os
import time
import threading
import tkinter as tk
from tkinter import messagebox
from datetime import datetime
import re

# =========================
# TENTATIVA DE IMPORTS (EVITA CRASH)
# =========================
try:
    import gspread
    from oauth2client.service_account import ServiceAccountCredentials
except ImportError:
    messagebox.showerror("Erro", "Falta gspread ou oauth2client.\nAbra o CMD e digite:\npip install gspread oauth2client")
    exit()

try:
    import win32print
except ImportError:
    messagebox.showerror("Erro", "Falta pywin32.\nAbra o CMD e digite:\npip install pywin32")
    exit()

try:
    from PIL import Image
except ImportError:
    messagebox.showerror("Erro", "Falta Pillow.\nAbra o CMD e digite:\npip install Pillow")
    exit()

try:
    import winsound
except ImportError:
    pass

try:
    from winotify import Notification
except Exception:
    Notification = None

# =========================
# CONFIGURAÇÕES
# =========================
SPREADSHEET_ID = "GOOGLE_SHEET_ID_REMOVIDO"
PRINTER_NAME = "CAMINHO_IMPRESSORA_EXEMPLO"
CREDS_FILE = "CREDENCIAL_NAO_VERSIONADA"
LOGO_FILE = "logo.png"

rodando = True
ultimo_pedido = None

try:
    if os.path.exists("contador.txt"):
        conteudo = open("contador.txt", "r").read().strip()
        contador = int(conteudo) if conteudo else 1
    else:
        contador = 1
except Exception:
    contador = 1

# =========================
# UTILITÁRIOS E FORMATAÇÃO DE COLUNAS
# =========================
def fmt_brl(valor):
    try:
        return f"{float(valor):.2f}".replace(".", ",")
    except Exception:
        return "0,00"

def notificar(quarto, comanda):
    if Notification is None: return
    try:
        toast = Notification(app_id="Hotel Fioreze", title="Novo Pedido", msg=f"Apto {quarto} | Comanda #{comanda:03d}", duration="short")
        toast.show()
    except: pass

def salvar_historico(texto):
    hoje = datetime.now().strftime("%d-%m-%Y")
    try:
        with open(f"historico_{hoje}.txt", "a", encoding="utf-8") as f:
            f.write(texto + "\n\n============================\n\n")
    except: pass

def to_float(valor):
    try:
        if isinstance(valor, (int, float)): return float(valor)
        txt = str(valor).strip().replace("R$", "").replace(".", "").replace(",", ".")
        return float(txt)
    except: return 0.0

def montar_itens(texto_pedido):
    itens = []
    texto_pedido = str(texto_pedido or "").strip()
    if not texto_pedido: return itens

    # Elgin i9 tem 48 caracteres por linha. Layout:
    # QTD. (4) + ESPAÇO (1) + DESCRIÇÃO (22) + ESPAÇO (1) + V.UNIT (8) + ESPAÇO (1) + V.TOTAL (9) = 46 caracteres

    partes = [p.strip() for p in texto_pedido.split(",") if p.strip()]
    for parte in partes:
        m = re.match(r"(.+?)\s*x\s*(\d+)\s*-\s*R\$\s*([\d\.,]+)", parte, re.IGNORECASE)
        if m:
            nome = m.group(1).strip()
            qtd = int(m.group(2))
            tot_item = float(m.group(3).replace(",", "."))
            val_unit = tot_item / qtd if qtd > 0 else tot_item

            # Quebra o nome do produto se for maior que 22 caracteres
            nome_lines = [nome[i:i+22] for i in range(0, len(nome), 22)]

            qtd_str = str(qtd).ljust(4)
            vun_str = fmt_brl(val_unit).rjust(8)
            vtot_str = fmt_brl(tot_item).rjust(9)

            # Linha principal com Valores
            linha1 = f"{qtd_str} {nome_lines[0].ljust(22)} {vun_str} {vtot_str}"
            itens.append(linha1)

            # Linhas extras para a descrição (se o nome for longo)
            for extra in nome_lines[1:]:
                itens.append(f"     {extra.ljust(22)}")
        else:
            # Caso não reconheça o padrão (fallback de segurança)
            itens.append(f"1    {parte[:22].ljust(22)}")

    return itens

# =========================
# CONEXÃO COM GOOGLE SHEETS
# =========================
def conectar_planilha():
    try:
        scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDS_FILE, scope)
        client = gspread.authorize(creds)
        return client.open_by_key(SPREADSHEET_ID).worksheet("Pedidos"), "Conectado"
    except Exception as e:
        return None, str(e)

# =========================
# IMPRESSÃO (LAYOUT CUPOM FISCAL)
# =========================
def imprimir_logo(handle):
    try:
        caminho = os.path.join(os.getcwd(), LOGO_FILE)
        if not os.path.exists(caminho): return
        img = Image.open(caminho).convert("1")
        if img.width > 384: img = img.resize((384, int(img.height * (384 / img.width))))
        width, height = img.size
        bytes_per_line = (width + 7) // 8
        data = bytearray()
        pixels = img.load()
        for y in range(height):
            for x in range(0, width, 8):
                byte = 0
                for bit in range(8):
                    if x + bit < width and pixels[x + bit, y] == 0: byte |= (1 << (7 - bit))
                data.append(byte)
        comando = b'\x1d\x76\x30\x00' + bytes([bytes_per_line % 256, bytes_per_line // 256]) + bytes([height % 256, height // 256])
        win32print.WritePrinter(handle, comando + data)
        win32print.WritePrinter(handle, b"\n\n")
    except: pass

def imprimir(d):
    handle = None
    texto_salvo = ""
    try:
        handle = win32print.OpenPrinter(PRINTER_NAME)
        win32print.StartDocPrinter(handle, 1, ("Pedido Room Service", None, "RAW"))
        win32print.StartPagePrinter(handle)
        win32print.WritePrinter(handle, b"\x1b\x42\x05\x05\x1b\x42\x05\x05") # BIPES DA IMPRESSORA

        def escrever(txt):
            win32print.WritePrinter(handle, txt.encode("cp850", errors="replace"))

        def cabecalho(tipo):
            win32print.WritePrinter(handle, b"\x1b\x61\x01")
            imprimir_logo(handle)
            win32print.WritePrinter(handle, b"\x1b\x45\x01")
            escrever("Hotel Fioreze Centro\n")
            win32print.WritePrinter(handle, b"\x1b\x45\x00")
            escrever("R. Sao Pedro, 438 - Centro, Gramado - RS\n(54) 3286-0609\n")
            win32print.WritePrinter(handle, b"\x1b\x45\x01")
            escrever("Recepcao ramal 9\n")
            win32print.WritePrinter(handle, b"\x1b\x45\x00")
            escrever(f"\n--- {tipo} ---\n\n")

        def corpo(d):
            nonlocal texto_salvo
            win32print.WritePrinter(handle, b"\x1b\x61\x01\x1b\x45\x01")
            escrever(f"COMANDA #{d['comanda']:03d}\n")

            win32print.WritePrinter(handle, b"\x1b\x45\x00\x1d\x21\x11")
            escrever(f"APARTAMENTO: {d['quarto']}\n")
            win32print.WritePrinter(handle, b"\x1d\x21\x00\n\x1b\x61\x00")

            texto = f"Hospede: {d['nome']}\nLocal: {d['consumo']}\nAtendente: {d['atendente']}\n"
            texto += "-" * 35 + "\n"
            texto += f"Recebido em: {d['criado']}\n"
            texto += f"Impresso em: {d['impresso']}\n"
            texto += "-" * 48 + "\n"

            # CABEÇALHO DA TABELA
            texto += "QTD. DESCRICAO               V.UNIT    V.TOTAL\n"
            texto += "-" * 48 + "\n"

            # ITENS
            for item in d["itens"]:
                texto += f"{item}\n"

            texto += "-" * 48 + "\n"

            # TOTAL ALINHADO À DIREITA
            texto_total = f"TOTAL: R$ {fmt_brl(d['total'])}"
            texto += f"{texto_total.rjust(48)}\n"

            obs = d.get("observacao", "").strip()
            if obs and obs.lower() != "pedido via site":
                win32print.WritePrinter(handle, b"\x1b\x45\x01") # Negrito
                texto += "-" * 48 + "\n"
                texto += f"OBSERVACAO:\n{obs}\n"
                win32print.WritePrinter(handle, b"\x1b\x45\x00") # Tira negrito

            escrever(texto)
            texto_salvo = texto

        cabecalho("VIA COZINHA/RECEP")
        corpo(d)
        win32print.WritePrinter(handle, b"\n\n\n\n\n\n\x1b\x61\x01")
        escrever("________________________________________\nAssinatura do hospede\n")
        win32print.WritePrinter(handle, b"\n\n\n\x1d\x56\x00")

        cabecalho("VIA DO HOSPEDE")
        corpo(d)
        win32print.WritePrinter(handle, b"\n\n")
        escrever("Nosso compromisso e fazer com que todas as pessoas que entrarem em nossos hoteis saiam melhores e mais felizes.\n")
        win32print.WritePrinter(handle, b"\n\n\n\x1d\x56\x00")

        win32print.EndPagePrinter(handle)
        win32print.EndDocPrinter(handle)
        win32print.ClosePrinter(handle)
        salvar_historico(texto_salvo)
    except Exception as e:
        print("Erro ao imprimir:", e)
        try:
            if handle: win32print.ClosePrinter(handle)
        except: pass

# =========================
# LOOP DE VARREDURA
# =========================
def loop_principal():
    global contador, ultimo_pedido, rodando

    sheet, status_conexao = conectar_planilha()
    if not sheet:
        status_label.config(text=f"Erro Conexão: Falha ao abrir CREDENCIAL_NAO_VERSIONADA", fg="red")

    while rodando:
        try:
            if not sheet:
                sheet, status_conexao = conectar_planilha()
                if not sheet:
                    time.sleep(5)
                    continue
                else:
                    status_label.config(text="Sistema Online e Escutando", fg="green")

            linhas = sheet.get_all_values()
            if len(linhas) > 1:
                for i, linha in enumerate(linhas[1:], start=2):
                    if len(linha) < 5: continue

                    status_impresso = str(linha[5]).strip().lower() if len(linha) > 5 else ""
                    if status_impresso == "impresso" or status_impresso == "": continue

                    data = str(linha[0]).strip() if len(linha) > 0 else ""
                    nome = str(linha[1]).strip() if len(linha) > 1 else ""
                    quarto = str(linha[2]).strip() if len(linha) > 2 else ""
                    pedido_txt = str(linha[3]).strip() if len(linha) > 3 else ""
                    total_raw = str(linha[4]).strip() if len(linha) > 4 else ""
                    consumo = str(linha[6]).strip() if len(linha) > 6 else ""
                    atendente = str(linha[7]).strip() if len(linha) > 7 else "Online"
                    observacao = str(linha[9]).strip() if len(linha) > 9 else ""

                    if not any([nome, quarto, pedido_txt]): continue

                    itens = montar_itens(pedido_txt)

                    d = {
                        "comanda": contador,
                        "nome": nome,
                        "quarto": quarto,
                        "consumo": consumo if consumo else "Nao informado",
                        "atendente": atendente if atendente else "Online",
                        "observacao": observacao,
                        "itens": itens,
                        "total": to_float(total_raw),
                        "criado": data,
                        "impresso": datetime.now().strftime("%d/%m/%Y %H:%M:%S")
                    }

                    ultimo_pedido = d
                    try:
                        winsound.Beep(1200, 300)
                    except: pass

                    notificar(d["quarto"], contador)
                    imprimir(d)

                    sheet.update_cell(i, 6, "impresso")

                    if status_impresso == "novo":
                        contador += 1
                        try:
                            with open("contador.txt", "w", encoding="utf-8") as f:
                                f.write(str(contador))
                        except: pass

        except Exception as e:
            status_label.config(text=f"Aviso: Oscilação na rede...", fg="orange")
            sheet = None

        time.sleep(5)

# =========================
# INTERFACE GRÁFICA
# =========================
def reimprimir():
    if ultimo_pedido:
        imprimir(ultimo_pedido)
    else:
        messagebox.showwarning("Aviso", "Nenhum pedido foi impresso nesta sessão ainda.")

def encerrar():
    global rodando
    if messagebox.askyesno("Encerrar", "Deseja fechar o servidor de impressao?"):
        rodando = False
        root.destroy()

root = tk.Tk()
root.title("Fioreze Centro - Servidor de Impressão")
root.geometry("380x250")
root.configure(bg="#f7f5ef")

status_label = tk.Label(root, text="Iniciando...", font=("Arial", 11, "bold"), bg="#f7f5ef", fg="#c1a94c")
status_label.pack(pady=15)

contador_label = tk.Label(root, text=f"Total de Comandas Hoje: {contador-1}", font=("Arial", 10), bg="#f7f5ef")
contador_label.pack()

def atualizar_label():
    contador_label.config(text=f"Próxima Comanda será a #{contador:03d}")
    if rodando: root.after(1000, atualizar_label)

btn_frame = tk.Frame(root, bg="#f7f5ef")
btn_frame.pack(pady=20)

tk.Button(btn_frame, text="Reimprimir Último", command=reimprimir, bg="#c1a94c", fg="white", font=("Arial", 10, "bold"), padx=10, pady=5).pack(side=tk.LEFT, padx=10)
tk.Button(btn_frame, text="Sair do Servidor", command=encerrar, bg="#e53e3e", fg="white", font=("Arial", 10, "bold"), padx=15, pady=5).pack(side=tk.LEFT)

threading.Thread(target=loop_principal, daemon=True).start()
root.after(1000, atualizar_label)
root.mainloop()