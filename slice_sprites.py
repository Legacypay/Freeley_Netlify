from PIL import Image
import os

def slice_image(input_path, output_prefix, num_slices=7):
    if not os.path.exists(input_path):
        print(f"Skipping {input_path}, not found.")
        return
    
    img = Image.open(input_path)
    width, height = img.size
    slice_width = width // num_slices
    
    for i in range(num_slices):
        left = i * slice_width
        right = (i + 1) * slice_width
        
        # Crop the image
        img_slice = img.crop((left, 0, right, height))
        
        # Save the slice
        output_path = f"{output_prefix}_{i+1}.png"
        img_slice.save(output_path)
        print(f"Saved {output_path}")

slice_image('/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/male_extreme_weight_loss_1773594837259.png', 'assets/brand/male_stage')
slice_image('/Users/anthonydel/.gemini/antigravity/brain/98fb4220-00f8-44eb-bc7f-98d26c2d724d/female_extreme_weight_loss_1773595063672.png', 'assets/brand/female_stage')
