import os
import glob
from PIL import Image

# Clear out the erroneous 1kb text file you uploaded by mistake as part of the script testing
if os.path.exists("assets/sema_new.jpg"):
    os.remove("assets/sema_new.jpg")

# The html is strictly looking for .webp files. We need to grab these .jpegs, overwrite the .webp files with them, so the site updates.
files_to_update = {
    "assets/sema_new.jpeg": "assets/sema_new.webp",
    "assets/peptides_new.jpeg": "assets/peptides_new.webp",
    "assets/sermorelin.jpeg": "assets/sermorelin.webp",
    "assets/tirz.jpeg": "assets/tirz.webp",
    "assets/nad_plus.jpeg": "assets/nad_plus.webp"
}

for jpeg_path, webp_path in files_to_update.items():
    if os.path.exists(jpeg_path):
        try:
            with Image.open(jpeg_path) as im:
                im.save(webp_path, 'webp', quality=85)
                print(f"Successfully converted and overwrote {webp_path}")
        except Exception as e:
            print(f"Failed to convert {jpeg_path}: {e}")
    else:
        print(f"Could not find {jpeg_path}")
