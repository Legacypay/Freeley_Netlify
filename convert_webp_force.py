import os
import glob
from PIL import Image

assets_dir = 'assets'
images = glob.glob(f'{assets_dir}/*.jpeg')

for img_path in images:
    try:
        with Image.open(img_path) as im:
            base = os.path.splitext(img_path)[0]
            webp_path = f"{base}.webp"
            im.save(webp_path, 'webp', quality=85)
            print(f"Force converted {img_path} to {webp_path}")
    except Exception as e:
        print(f"Failed to convert {img_path}: {e}")
