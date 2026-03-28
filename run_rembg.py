from rembg import remove
from PIL import Image
import sys

for param in sys.argv[1:]:
    input_path, output_path = param.split('|')
    print(f"Processing {input_path} -> {output_path}")
    try:
        input_image = Image.open(input_path)
        output_image = remove(input_image)
        output_image.save(output_path)
    except Exception as e:
        print(f"Failed {e}")
