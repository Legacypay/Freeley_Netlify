import urllib.request
import urllib.parse
import os

prompts = [
    {
        "filename": "assets/blog_hero_semaglutide_delivery.jpg",
        "prompt": "A clean, modern, aesthetic flat lay photo of a premium medical package or elegant white pharmacy box arriving safely on a marble table, telemedicine concept, minimal, high-end healthcare brand aesthetic, soft natural lighting."
    },
    {
        "filename": "assets/blog_hero_finasteride_hair.jpg",
        "prompt": "A modern, aesthetic photo of a confident handsome man looking in the mirror, running his hand through his healthy hair, bright and airy luxury bathroom setting, cinematic lighting, premium men's health concept."
    },
    {
        "filename": "assets/blog_hero_tirzepatide_cost.jpg",
        "prompt": "A clean, modern composition of a minimalist metallic designer calculator next to a sleek, modern, anonymous medical vial on a clean white desk, representing healthcare costs and weight loss investment, premium aesthetic, soft natural lighting."
    }
]

req_headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
}

for item in prompts:
    filename = item["filename"]
    prompt = item["prompt"]
    encoded_prompt = urllib.parse.quote(prompt)
    
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1200&height=800&nologo=true"
    
    print(f"Downloading {filename}...")
    try:
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req) as response, open(filename, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
        print(f"Successfully downloaded {filename}")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")
