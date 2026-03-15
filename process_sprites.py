from PIL import Image

def process_image(input_path, output_prefix, num_expected=7):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    width, height = img.size
    
    # 1. Make white background transparent
    new_data = []
    threshold = 230
    for item in data:
        r, g, b, a = item
        if r > threshold and g > threshold and b > threshold:
            new_data.append((255, 255, 255, 0)) # transparent
        else:
            new_data.append(item)
    
    img.putdata(new_data)
    
    # 2. Find bounding boxes of columns
    col_has_content = [False] * width
    for y in range(height):
        for x in range(width):
            a = new_data[y * width + x][3]
            if a != 0:
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
        
    print(f"Found {len(segments)} horizontal segments in {input_path}")
    segments = [s for s in segments if s[1] - s[0] > 30]
    print(f"After filtering small segments: {len(segments)}")
    
    if len(segments) != num_expected:
        print(f"Fallback to equal slicing due to segment count mismatch.")
        slice_w = width // num_expected
        segments = [ (i*slice_w, (i+1)*slice_w) for i in range(num_expected) ]
        
    for i, (start_x, end_x) in enumerate(segments):
        pad = 20
        left = max(0, start_x - pad)
        right = min(width, end_x + pad)
        
        slice_img = img.crop((left, 0, right, height))
        bbox = slice_img.getbbox()
        if bbox:
            slice_img = slice_img.crop(bbox)
        
        out_name = f"{output_prefix}_{i+1}.png"
        slice_img.save(out_name)
        print(f"Saved {out_name}")

process_image('/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/male_extreme_weight_loss_1773594837259.png', 'assets/brand/male_stage', 7)
process_image('/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/female_extreme_weight_loss_1773595063672.png', 'assets/brand/female_stage', 7)
