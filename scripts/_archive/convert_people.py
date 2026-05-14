from PIL import Image

try:
    with Image.open("assets/michael.jpeg") as im:
        im.save("assets/michael.webp", "webp", quality=85)
        print("Converted Michael")
except Exception as e:
    print(f"Error michael: {e}")

try:
    with Image.open("assets/sarah.jpeg") as im:
        im.save("assets/sarah.webp", "webp", quality=85)
        print("Converted Sarah")
except Exception as e:
    print(f"Error sarah: {e}")
