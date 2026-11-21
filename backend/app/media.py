"""Bounded, locally stored raster images. Remote URLs and active formats are rejected."""
import base64
import binascii
import warnings
from io import BytesIO

from PIL import Image

MAX_IMAGE_BYTES = 2 * 1024 * 1024
FORMATS = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}


def validate_images(images):
    for image in images:
        try:
            header, encoded = image.split(",", 1)
            mime = header.removeprefix("data:").removesuffix(";base64")
            if header != "data:" + mime + ";base64" or mime not in FORMATS:
                raise ValueError()
            if len(encoded) > 4 * ((MAX_IMAGE_BYTES + 2) // 3):
                raise ValueError()
            raw = base64.b64decode(encoded, validate=True)
            if not raw or len(raw) > MAX_IMAGE_BYTES:
                raise ValueError()
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(raw)) as opened:
                    if opened.format != FORMATS[mime] or opened.width * opened.height > 16000000:
                        raise ValueError()
                    opened.verify()
        except (ValueError, OSError, SyntaxError, binascii.Error, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise ValueError("Use valid PNG, JPEG or WebP images, up to 2 MiB and 16 million pixels each")
    return images
