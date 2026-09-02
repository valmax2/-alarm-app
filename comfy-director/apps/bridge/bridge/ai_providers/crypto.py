"""Cifratura a riposo delle credenziali dei provider AI (spec §20: "Le chiavi/API
credential devono... non finire nei log... non finire nei repository... essere
conservate in modo sicuro"; ARCHITECTURE_DECISION.md §10).

La master key è generata al primo utilizzo e salvata in `data/secret.key` — fuori dal
repository (`.gitignore`), fuori dal database (chiave e dati cifrati non nello stesso
posto), con permessi ristretti quando il filesystem lo consente. Nessuna chiave è mai
hardcoded nel codice.
"""

from __future__ import annotations

from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken


class DecryptionError(Exception):
    """La chiave locale non corrisponde o il valore cifrato è corrotto."""


def load_or_create_master_key(key_path: Path) -> bytes:
    if key_path.exists():
        return key_path.read_bytes()
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key()
    key_path.write_bytes(key)
    try:
        key_path.chmod(0o600)
    except OSError:
        pass  # best-effort: alcuni filesystem (es. certi mount Windows) non supportano chmod
    return key


def encrypt_secret(plaintext: str, key: bytes) -> bytes:
    return Fernet(key).encrypt(plaintext.encode("utf-8"))


def decrypt_secret(ciphertext: bytes, key: bytes) -> str:
    try:
        return Fernet(key).decrypt(ciphertext).decode("utf-8")
    except InvalidToken as exc:
        raise DecryptionError("Impossibile decifrare la credenziale (chiave locale mancante o cambiata?)") from exc
