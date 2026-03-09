FROM python:3.12-slim

WORKDIR /app

# Install system deps needed by torch/Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (smaller image — no CUDA)
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Then install the rest
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Pre-download the model at build time so startup is instant
RUN python -c "import timm; timm.create_model('hf-hub:timm/eva02_large_patch14_clip_336.merged2b_ft_inat21', pretrained=True)"

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
