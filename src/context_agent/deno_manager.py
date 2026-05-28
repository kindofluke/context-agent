"""Download and manage Deno binary in user's home directory."""

import os
import platform
import shutil
import stat
import sys
import urllib.request
import zipfile
from pathlib import Path


DENO_VERSION = "v2.1.4"


def _get_cache_dir() -> Path:
    """Return platform-appropriate cache directory following XDG standards."""
    if sys.platform == "darwin":
        # macOS: ~/Library/Application Support/ct-agents
        return Path.home() / "Library" / "Application Support" / "ct-agents" / "bin"
    elif sys.platform == "win32":
        # Windows: %LOCALAPPDATA%\ct-agents
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            return Path(local_app_data) / "ct-agents" / "bin"
        return Path.home() / "AppData" / "Local" / "ct-agents" / "bin"
    else:
        # Linux/Unix: XDG_DATA_HOME or ~/.local/share/ct-agents
        xdg_data_home = os.environ.get("XDG_DATA_HOME")
        if xdg_data_home:
            return Path(xdg_data_home) / "ct-agents" / "bin"
        return Path.home() / ".local" / "share" / "ct-agents" / "bin"


CACHE_DIR = _get_cache_dir()


def _get_platform_info() -> tuple[str, str]:
    """Return (os_name, arch) for Deno download URL."""
    system = platform.system().lower()
    machine = platform.machine().lower()

    # Map Python's machine names to Deno's architecture names
    if machine in ("x86_64", "amd64"):
        arch = "x86_64"
    elif machine in ("aarch64", "arm64"):
        arch = "aarch64"
    else:
        raise RuntimeError(f"Unsupported architecture: {machine}")

    if system == "darwin":
        return "apple-darwin", arch
    elif system == "linux":
        return "unknown-linux-gnu", arch
    elif system == "windows":
        return "pc-windows-msvc", arch
    else:
        raise RuntimeError(f"Unsupported operating system: {system}")


def _get_download_url() -> tuple[str, str]:
    """Return (download_url, binary_name) for current platform."""
    os_name, arch = _get_platform_info()
    target = f"{arch}-{os_name}"

    # Windows uses .exe, others don't
    binary_name = "deno.exe" if sys.platform == "win32" else "deno"

    url = f"https://github.com/denoland/deno/releases/download/{DENO_VERSION}/deno-{target}.zip"
    return url, binary_name


def _download_and_extract(url: str, dest_dir: Path, binary_name: str) -> Path:
    """Download Deno zip and extract binary to dest_dir."""
    dest_dir.mkdir(parents=True, exist_ok=True)

    zip_path = dest_dir / "deno.zip"
    binary_path = dest_dir / binary_name

    print(f"Downloading Deno {DENO_VERSION} for your platform...")
    print(f"  URL: {url}")

    # Download
    try:
        with urllib.request.urlopen(url) as response:
            with open(zip_path, "wb") as f:
                f.write(response.read())
    except Exception as e:
        raise RuntimeError(f"Failed to download Deno: {e}")

    # Extract
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extract(binary_name, dest_dir)
    except Exception as e:
        raise RuntimeError(f"Failed to extract Deno: {e}")
    finally:
        # Clean up zip file
        try:
            zip_path.unlink()
        except OSError:
            pass

    # Make executable (Unix-like systems)
    if sys.platform != "win32":
        binary_path.chmod(binary_path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    print(f"  Installed to: {binary_path}")
    return binary_path


def get_deno_path() -> str:
    """Return path to Deno binary, downloading if necessary.

    Strategy:
    1. Check for system-installed deno (via PATH)
    2. Check platform-specific cache directory for downloaded binary
    3. If not found, download and cache it

    Returns:
        Absolute path to Deno binary

    Raises:
        FileNotFoundError: If Deno cannot be found or downloaded
    """
    # First, prefer system-installed deno
    system_deno = shutil.which("deno")
    if system_deno:
        return system_deno

    # Check cache
    url, binary_name = _get_download_url()
    cached_binary = CACHE_DIR / binary_name

    if cached_binary.exists():
        return str(cached_binary)

    # Download and cache
    try:
        binary_path = _download_and_extract(url, CACHE_DIR, binary_name)
        return str(binary_path)
    except Exception as e:
        raise FileNotFoundError(
            f"Deno binary not found on system and download failed: {e}\n"
            f"Please install Deno manually: https://deno.land/#installation"
        )
