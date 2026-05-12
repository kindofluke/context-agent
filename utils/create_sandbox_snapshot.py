#!/usr/bin/env python3
"""
Create a Deno Sandbox with ct-agent installed and save it as a reusable snapshot.

The script:
  1. Builds a fresh ct-agent wheel from the local source
  2. Creates a persistent 10 GB Deno volume
  3. Boots a sandbox with that volume as its root filesystem
     (Deno provisions the base Linux OS onto the empty volume on first boot)
  4. Installs Python + pip via apt-get, then ct-agent via pip
  5. Snaps the volume into an immutable bootable snapshot
  6. Cleans up the temporary volume (unless --keep-volume is passed)
  7. Prints a formatted summary of the resulting snapshot

The snapshot is a full bootable Linux image with ct-agent pre-installed.
Boot a future sandbox from it with:  sdk.sandbox.create(root="<snapshot-slug>")

Requirements:
  - DENO_DEPLOY_TOKEN env var must be set

Usage:
  uv run python utils/create_sandbox_snapshot.py
  uv run python utils/create_sandbox_snapshot.py --snapshot-slug my-snapshot --region ord
"""

import argparse
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from deno_sandbox import DenoDeploy

PROJECT_ROOT = Path(__file__).parent.parent
DEFAULT_REGION = "ord"
VOLUME_CAPACITY = "10GB"  # enough room for Python + all deps


# ── helpers ──────────────────────────────────────────────────────────────────


def build_wheel() -> Path:
    print("Building ct-agent wheel from local source…")
    result = subprocess.run(
        ["uv", "build", "--wheel"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  Build failed:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    wheels = sorted(
        (PROJECT_ROOT / "dist").glob("context_agent-*.whl"),
        key=lambda p: p.stat().st_mtime,
    )
    if not wheels:
        print("  No wheel found in dist/", file=sys.stderr)
        sys.exit(1)

    wheel = wheels[-1]
    print(f"  Built: {wheel.name}")
    return wheel


def spawn_and_stream(sandbox, command: str, *args: str, label: str) -> int:
    """Run a sandbox command, stream its output, return the exit code."""
    proc = sandbox.spawn(command, args=list(args), stdout="piped", stderr="piped")

    for chunk in proc.stdout:
        for line in chunk.decode(errors="replace").splitlines():
            line = line.strip()
            if line:
                print(f"    [{label}] {line}")

    status = proc.wait()
    return status["code"]


def _require(sandbox, command: str, *args: str, label: str) -> None:
    """Run a sandbox command and raise RuntimeError if it exits non-zero."""
    code = spawn_and_stream(sandbox, command, *args, label=label)
    if code != 0:
        raise RuntimeError(f"{command} exited with code {code}")


def fmt_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def print_snapshot_summary(snapshot: dict, wheel: Path) -> None:
    w = 64
    bar = "━" * w
    sep = "─" * w

    # Extract fields (SDK returns snake_case)
    snap_id = snapshot.get("id", "—")
    slug = snapshot.get("slug", "—")
    region = snapshot.get("region", "—")
    bootable = "yes" if snapshot.get("is_bootable") else "no"
    alloc = fmt_bytes(snapshot.get("allocated_size", 0))
    flat = fmt_bytes(snapshot.get("flattened_size", 0))
    base = snapshot.get("base_snapshot") or {}
    base_slug = base.get("slug", "—") if base else "—"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    package = wheel.stem  # e.g. "context_agent-0.1.0"

    print(f"\n{bar}")
    print(f"  {'DENO SANDBOX SNAPSHOT':^{w - 4}}")
    print(bar)
    print(f"  {'Slug':<18} {slug}")
    print(f"  {'ID':<18} {snap_id}")
    print(f"  {'Region':<18} {region}")
    print(f"  {'Bootable':<18} {bootable}")
    print(f"  {'Allocated size':<18} {alloc}")
    print(f"  {'Flattened size':<18} {flat}")
    print(f"  {'Base snapshot':<18} {base_slug}")
    print(f"  {'Created':<18} {now}")
    print(sep)
    print(f"  {'Installed package':<18} {package}")
    print(sep)
    print(f"  Boot a future sandbox from this snapshot:")
    print(f'    sdk.sandbox.create(root="{slug}")')
    print(f"{bar}\n")


# ── main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create a Deno Sandbox snapshot with ct-agent pre-installed."
    )
    parser.add_argument(
        "--snapshot-slug",
        default=None,
        help="Slug for the resulting snapshot (auto-generated if omitted).",
    )
    parser.add_argument(
        "--region",
        default=DEFAULT_REGION,
        help=f"Deno Deploy region (default: {DEFAULT_REGION}).",
    )
    parser.add_argument(
        "--keep-volume",
        action="store_true",
        help="Keep the setup volume after snapshotting (default: delete it).",
    )
    args = parser.parse_args()

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    snapshot_slug = args.snapshot_slug or f"ct-agent-{timestamp}"
    volume_slug = f"ct-agent-setup-{timestamp}"

    wheel = build_wheel()
    remote_wheel = f"/tmp/{wheel.name}"

    sdk = DenoDeploy()

    # ── 1. Create a persistent volume ────────────────────────────────────────
    print(f"\nCreating volume  : {volume_slug}  ({args.region}, {VOLUME_CAPACITY})")
    sdk.volumes.create(volume_slug, args.region, VOLUME_CAPACITY)
    print("  Volume created.")

    snapshot = None
    try:
        # ── 2. Boot sandbox with the volume as root ──────────────────────────
        # Deno provisions the base Linux OS onto the empty volume on first boot.
        print("\nBooting sandbox (first boot provisions base OS onto volume)…")
        with sdk.sandbox.create(root=volume_slug, memory_mb=2048, region=args.region) as sandbox:
            print(f"  Sandbox {sandbox.id} is ready.")

            # ── 3. Install Python via apt ─────────────────────────────────────
            print("\nInstalling Python via apt-get…")
            _require(sandbox, "apt-get", "update", "-qq", label="apt")
            _require(
                sandbox,
                "apt-get", "install", "-y",
                "python3", "python3-pip", "python3-dev", "build-essential",
                label="apt",
            )

            # ── 4. Upload wheel ───────────────────────────────────────────────
            print(f"\nUploading wheel: {wheel.name}")
            sandbox.fs.upload(str(wheel), remote_wheel)
            print("  Upload complete.")

            # ── 5. Install ct-agent ───────────────────────────────────────────
            # --break-system-packages is safe here; we own the whole volume.
            print("\nInstalling ct-agent…")
            _require(
                sandbox,
                "pip3", "install", "--break-system-packages", remote_wheel,
                label="pip",
            )
            print("  ct-agent installed.")

            # ── 6. Verify ─────────────────────────────────────────────────────
            print("\nVerifying installation…")
            spawn_and_stream(sandbox, "ct-agent", "--help", label="verify")

        # ── 7. Snapshot the volume ────────────────────────────────────────────
        print(f"\nCreating snapshot: {snapshot_slug}")
        snapshot = sdk.volumes.snapshot(volume_slug, slug=snapshot_slug)
        print(f"  Snapshot {snapshot['id']} created.")

    except Exception as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        raise
    finally:
        if not args.keep_volume:
            print(f"\nCleaning up volume: {volume_slug}")
            try:
                sdk.volumes.delete(volume_slug)
                print("  Volume deleted.")
            except Exception as exc:
                print(f"  Warning: could not delete volume — {exc}")

    if snapshot:
        print_snapshot_summary(snapshot, wheel)


if __name__ == "__main__":
    main()
