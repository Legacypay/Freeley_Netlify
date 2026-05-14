import os
from PIL import Image # type: ignore
from rembg import remove # type: ignore

def process_and_crop(input_path, output_prefix, num_slices=7):
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        return
        
    print(f"Processing {input_path} with rembg...")
    original_img = Image.open(input_path).convert("RGBA")
    
    # Remove background entirely using rembg
    no_bg_img = remove(original_img)
    
    width, height = no_bg_img.size
    slice_width = width // num_slices
    
    for i in range(num_slices):
        left = i * slice_width
        right = (i + 1) * slice_width
        
        # Crop the slice
        img_slice = no_bg_img.crop((left, 0, right, height))
        
        # Get bounding box of the non-transparent pixels
        bbox = img_slice.getbbox()
        if bbox:
            print(f"Bounding box for slice {i+1}: {bbox}")
            # Crop to exactly the person's pixels
            img_slice = img_slice.crop(bbox)
        else:
            print(f"Warning: No content found in slice {i+1}")
            
        output_path = f"{output_prefix}_{i+1}.png"
        img_slice.save(output_path)
        print(f"Saved {output_path}")

male_path = '/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/male_extreme_weight_loss_1773594837259.png'
female_path = '/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/female_extreme_weight_loss_1773595063672.png'

process_and_crop(male_path, 'assets/brand/male_stage', 7)
process_and_crop(female_path, 'assets/brand/female_stage', 7)
