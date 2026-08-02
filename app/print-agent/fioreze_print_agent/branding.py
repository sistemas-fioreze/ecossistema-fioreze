from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

from .api import ApiError, PrintAgentApi
from .config import APP_DIR


TRAY_ICON_FILE = APP_DIR / "unit-tray-icon.png"
TRAY_ICON_SIZE = 128


def load_unit_tray_icon(origin, icon_url, path=TRAY_ICON_FILE):
    path = Path(path)
    if icon_url:
        try:
            payload = PrintAgentApi(origin).download_public_image(icon_url)
            image = prepare_tray_image(payload)
            path.parent.mkdir(parents=True, exist_ok=True)
            image.save(path, format="PNG")
            return image
        except (ApiError, OSError, ValueError):
            pass
    if path.exists():
        try:
            with Image.open(path) as cached:
                return cached.convert("RGBA").copy()
        except (OSError, ValueError):
            pass
    return fallback_tray_image()


def prepare_tray_image(payload):
    with Image.open(BytesIO(payload)) as source:
        source.load()
        image = source.convert("RGBA")
    image = ImageOps.contain(image, (104, 104), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (TRAY_ICON_SIZE, TRAY_ICON_SIZE), (255, 255, 255, 255))
    offset = ((TRAY_ICON_SIZE - image.width) // 2, (TRAY_ICON_SIZE - image.height) // 2)
    canvas.alpha_composite(image, offset)
    return canvas


def fallback_tray_image():
    image = Image.new("RGBA", (TRAY_ICON_SIZE, TRAY_ICON_SIZE), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((8, 8, 120, 120), radius=24, fill=(45, 49, 53, 255))
    draw.text((45, 31), "F", fill=(255, 255, 255, 255), stroke_width=1)
    return image
