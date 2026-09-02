from __future__ import annotations

import pytest

from bridge.ai_providers.crypto import (
    DecryptionError,
    decrypt_secret,
    encrypt_secret,
    load_or_create_master_key,
)


def test_encrypt_decrypt_roundtrip() -> None:
    from cryptography.fernet import Fernet

    key = Fernet.generate_key()
    ciphertext = encrypt_secret("sk-super-secret-123", key)
    assert ciphertext != b"sk-super-secret-123"
    assert decrypt_secret(ciphertext, key) == "sk-super-secret-123"


def test_decrypt_with_wrong_key_fails_cleanly() -> None:
    from cryptography.fernet import Fernet

    key_a = Fernet.generate_key()
    key_b = Fernet.generate_key()
    ciphertext = encrypt_secret("sk-secret", key_a)
    with pytest.raises(DecryptionError):
        decrypt_secret(ciphertext, key_b)


def test_load_or_create_master_key_persists_across_calls(tmp_path) -> None:
    key_path = tmp_path / "secret.key"
    assert not key_path.exists()

    first = load_or_create_master_key(key_path)
    assert key_path.exists()

    second = load_or_create_master_key(key_path)
    assert first == second  # riusa la stessa chiave, non ne genera una nuova ogni volta


def test_load_or_create_master_key_restricts_permissions(tmp_path) -> None:
    key_path = tmp_path / "secret.key"
    load_or_create_master_key(key_path)
    mode = key_path.stat().st_mode & 0o777
    assert mode == 0o600
