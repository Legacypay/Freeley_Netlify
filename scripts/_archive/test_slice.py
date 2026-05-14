from PIL import Image

def analyze(img_path):
    img = Image.open(img_path).convert("RGBA")
    data = list(img.getdata())
    width, height = img.size
    
    col_active = [False] * width
    threshold = 245
    for i, item in enumerate(data):
        r, g, b, a = item
        if not (r > threshold and g > threshold and b > threshold):
            x = i % width
            col_active[x] = True
            
    segments = []
    in_seg = False
    start = 0
    for x in range(width):
        if col_active[x] and not in_seg:
            in_seg = True
            start = x
        elif not col_active[x] and in_seg:
            in_seg = False
            segments.append((start, x))
    if in_seg:
        segments.append((start, width))
    
    print(f"{img_path}: width {width}, found {len(segments)} segments")
    for s in segments:
        print(s)

analyze('/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/male_extreme_weight_loss_1773594837259.png')
analyze('/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/female_extreme_weight_loss_1773595063672.png')
