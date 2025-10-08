# Use the official Appwrite Python runtime as base
FROM appwrite/runtime-for-python:3.12

# Install system dependencies required for libmongocrypt
RUN apt-get update && \
    apt-get install -y curl gpg && \
    curl -s --location https://pgp.mongodb.com/libmongocrypt.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/libmongocrypt.gpg && \
    echo "deb https://libmongocrypt.s3.amazonaws.com/apt/debian bookworm/libmongocrypt/1.16 main" | tee /etc/apt/sources.list.d/libmongocrypt.list && \
    apt-get update && \
    apt-get install -y libmongocrypt-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy function code
COPY . /usr/local/server/src/function

# Set working directory
WORKDIR /usr/local/server/src/function

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the function port
EXPOSE 3000

# Set the entrypoint
CMD ["python", "-m", "src.main"]

