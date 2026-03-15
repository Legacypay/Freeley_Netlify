import subprocess
import urllib.parse
import os

images = {
    "sema_new.jpg": "Ultra premium pharmaceutical product photography of a single clear glass medical vial. Solid gold metal flip-top cap, green rubber stopper. The vial label is solid dark emerald green with elegant warm cream typography. Top text 'Freeley', main text 'Semaglutide'. Clean minimalist layout. Plain smooth soft warm cream background. Photorealistic, highly detailed, commercial beauty shot style.",
    "tirz.jpg": "Ultra premium pharmaceutical product photography of a single clear glass medical vial. Solid gold metal flip-top cap, green rubber stopper. The vial label is solid warm cream with elegant dark emerald green typography. Top text 'Freeley', main text 'Tirzepatide'. Clean minimalist layout. Plain smooth soft dark emerald green background. Photorealistic, highly detailed, commercial beauty shot style.",
    "sermorelin.jpg": "Ultra premium pharmaceutical product photography of a single clear glass medical vial. Solid gold metal flip-top cap, green rubber stopper. The vial label is solid dark emerald green with elegant warm cream typography. Top text 'Freeley', main text 'Sermorelin'. Clean minimalist layout. Plain smooth soft warm cream background. Photorealistic, highly detailed, commercial beauty shot style.",
    "nad_plus.jpg": "Ultra premium pharmaceutical product photography of a single clear glass medical vial. Solid gold metal flip-top cap, green rubber stopper. The vial label is solid dark emerald green with elegant warm cream typography. Top text 'Freeley', main text 'NAD+'. Clean minimalist layout. Plain smooth soft warm cream background. Photorealistic, highly detailed, commercial beauty shot style.",
    "b12_mic_new.jpg": "Ultra premium pharmaceutical product photography of a single clear glass medical vial. Solid gold metal flip-top cap, green rubber stopper. The vial label is solid warm cream with elegant dark emerald green typography. Top text 'Freeley', main text 'B12-MIC'. Clean minimalist layout. Plain smooth soft dark emerald green background. Photorealistic, highly detailed, commercial beauty shot style.",
    "peptides_new.jpg": "Ultra premium pharmaceutical product photography of three clear glass medical vials standing next to each other in a row. Each has a solid gold metal flip-top cap and green rubber stopper. The vial labels are solid dark emerald green with elegant warm cream typography. Top text 'Freeley', main text 'Sermorelin', 'NAD+', and 'B12-MIC'. Clean minimalist layout. Plain smooth soft warm cream background. Photorealistic, highly detailed, commercial beauty shot style."
}

base_url = "https://image.pollinations.ai/prompt/{}?width=1000&height=1000&nologo=true"

for filename, prompt in images.items():
    encoded_prompt = urllib.parse.quote(prompt)
    url = base_url.format(encoded_prompt)
    print(f"Generating {filename}...")
    
    out_path = os.path.join("assets", filename)
    
    # Use curl to download the image directly
    subprocess.run(["curl", "-s", "-L", url, "-o", out_path])
    
    # Immediately convert to webp using our previous pillow script logic
    webp_path = out_path.replace('.jpg', '.webp')
    subprocess.run(["python3", "-c", f"from PIL import Image; Image.open('{out_path}').convert('RGB').save('{webp_path}', 'webp', quality=85)"])
    print(f"Saved {webp_path}")

print("All premium images successfully generated and converted to webp!")
