"""
Quick test script — sends a local image to the /api/predict endpoint.

Usage::

    python test_predict.py
    python test_predict.py path/to/your/image.jpg
"""





import json
import sys

import requests

API_URL = "http://127.0.0.1:8000/api/predict"

# Default to the bee sprite; pass a different path as the first CLI arg
DEFAULT_IMAGE = r"C:\Users\adamc\Desktop\personal projects\BugLord\BugLord\training\phone test images\beephone.jpg"


def main() -> None:
    image_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IMAGE

    print(f"Sending: {image_path}")
    print(f"     To: {API_URL}\n")

    with open(image_path, "rb") as f:
        response = requests.post(
            API_URL,
            files={"file": (image_path, f, "image/png")},
            timeout=30,
        )

    print(f"Status: {response.status_code}\n")
    try:
        data = response.json()
        print(json.dumps(data, indent=2))
    except requests.exceptions.JSONDecodeError:
        print(response.text)


if __name__ == "__main__":
    main()
