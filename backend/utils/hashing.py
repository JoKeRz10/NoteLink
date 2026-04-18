import hashlib

def calculate_text_hash(text: str) -> str:
    """Calculates SHA-256 hash of a text string."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def calculate_file_hash(file_path: str) -> str:
    """Calculates SHA-256 hash of a file's content."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()
