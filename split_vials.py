import cv2
import numpy as np
from PIL import Image

img = cv2.imread('assets/brand/longevity_3vials_transparent.png', cv2.IMREAD_UNCHANGED)
if img is None:
    print("Could not read image")
    exit(1)

alpha = img[:, :, 3]
_, thresh = cv2.threshold(alpha, 10, 255, cv2.THRESH_BINARY)

contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

bboxes = []
for cnt in contours:
    x, y, w, h = cv2.boundingRect(cnt)
    if w > 50 and h > 50:
        bboxes.append((x, y, w, h))

bboxes = sorted(bboxes, key=lambda b: b[2] * b[3], reverse=True)[:3]
bboxes.sort(key=lambda b: b[0])

print("Found bboxes:", bboxes)

names = ['sermorelin', 'glutathione', 'nad']
pil_img = Image.open('assets/brand/longevity_3vials_transparent.png')

if len(bboxes) == 3:
    for i, bbox in enumerate(bboxes):
        x, y, w, h = bbox
        pad = 5
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(pil_img.width, x + w + pad)
        y2 = min(pil_img.height, y + h + pad)
        
        crop = pil_img.crop((x1, y1, x2, y2))
        crop.save(f'assets/brand/{names[i]}_vial.png')
        print(f"Saved assets/brand/{names[i]}_vial.png")
else:
    print("Found", len(bboxes), "bboxes, expected 3. Aborting crop.")
