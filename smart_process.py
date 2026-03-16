import os
from PIL import Image # type: ignore
from rembg import remove # type: ignore

def smart_process(input_path, output_prefix, num_expected=7):
    if not os.path.exists(input_path):
        return
        
    print(f"Smart processing {input_path}...")
    original = Image.open(input_path).convert("RGBA")
    
    # 1. Remove background
    no_bg = remove(original)
    width, height = no_bg.size
    
    # 2. Find transparent columns
    data = list(no_bg.getdata()) # type: ignore
    col_has_content = [False] * width
    for y in range(height):
        for x in range(width):
            alpha = data[y * width + x][3] # type: ignore
            if alpha > 10:
                col_has_content[x] = True
                
    segments = []
    in_seg = False
    start_x = 0
    for x in range(width):
        if col_has_content[x] and not in_seg:
            in_seg = True
            start_x = x
        elif not col_has_content[x] and in_seg:
            in_seg = False
            segments.append((start_x, x))
            
    if in_seg:
        segments.append((start_x, width))
        
    # filter small noise
    segments = [s for s in segments if s[1] - s[0] > 30]
    
    print(f"Found {len(segments)} segments")
    
    # Fallback if detection fails (e.g. limbs touching)
    if len(segments) != num_expected:
        print("Fallback to fixed slicing due to overlapping limbs.")
        slice_w = width // num_expected
        segments = [(i * slice_w, (i + 1) * slice_w) for i in range(num_expected)]
        
    for i, (sx, ex) in enumerate(segments):
        pad = 5
        left = max(0, sx - pad)
        right = min(width, ex + pad)
        
        slice_img = no_bg.crop((left, 0, right, height))
        bbox = slice_img.getbbox()
        if bbox:
            slice_img = slice_img.crop(bbox)
            
        out_name = f"{output_prefix}_{i+1}.png"
        slice_img.save(out_name)
        print(f"Saved {out_name} with bbox {bbox}")

male_path = '/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/male_extreme_weight_loss_1773594837259.png'
female_path = '/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/female_extreme_weight_loss_1773595063672.png'

smart_process(male_path, 'assets/brand/male_stage', 7)
smart_process(female_path, 'assets/brand/female_stage', 7)
