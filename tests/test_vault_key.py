"""Tests for vault key selection and the production guard."""
import os
import subprocess
import sys

CHECK = "import backend.config as c; print(c.VAULT_SECRET_KEY == c.DEV_VAULT_SECRET_KEY)"


def _run(env_overrides):
    env = {**os.environ, **env_overrides}
    return subprocess.run([sys.executable, "-c", CHECK], env=env, capture_output=True, text=True)


def test_blank_key_falls_back_to_dev_key():
    assert _run({"VAULT_SECRET_KEY": ""}).stdout.strip() == "True"


def test_production_refuses_dev_key():
    res = _run({"VAULT_SECRET_KEY": "", "CERVISETU_ENV": "production"})
    assert res.returncode != 0 and "VAULT_SECRET_KEY must be set" in res.stderr


def test_production_accepts_private_key():
    res = _run({"VAULT_SECRET_KEY": "x" * 43, "CERVISETU_ENV": "production"})
    assert res.returncode == 0 and res.stdout.strip() == "False"
