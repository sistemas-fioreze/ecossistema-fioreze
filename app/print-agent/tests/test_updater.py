import hashlib
import io
import json
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from fioreze_print_agent.updater import (
    UPDATE_BASE_URL,
    UpdateError,
    bootstrap_installed_suite,
    check_for_update,
    defer_update,
    download_update,
    is_update_deferred,
    milliseconds_until_next_local_midnight,
    schedule_update_install,
    validate_manifest,
)


class FakeResponse(io.BytesIO):
    def __init__(self, content, headers=None, url=None):
        super().__init__(content)
        self.headers = headers or {}
        self.url = url

    def geturl(self):
        return self.url or f"{UPDATE_BASE_URL}/latest.json"

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


def manifest_for(content=b"MZ fixture", version="1.4.4"):
    return {
        "schema_version": 1,
        "version": version,
        "file": f"Fioreze-Suite-{version}.exe",
        "sha256": hashlib.sha256(content).hexdigest(),
        "size_bytes": len(content),
        "release_notes": "Melhorias ficticias.",
    }


class UpdaterTests(unittest.TestCase):
    def test_midnight_delay_uses_the_computer_local_clock(self):
        now = datetime(2026, 8, 22, 23, 59, 30, tzinfo=timezone(timedelta(hours=-3)))
        self.assertEqual(milliseconds_until_next_local_midnight(now), 30_000)

        morning = datetime(2026, 8, 22, 8, 0, 0)
        self.assertEqual(milliseconds_until_next_local_midnight(morning), 16 * 60 * 60 * 1000)

    def test_manifest_uses_fixed_https_feed_and_versioned_executable(self):
        parsed = validate_manifest(manifest_for())
        self.assertEqual(parsed["download_url"], f"{UPDATE_BASE_URL}/Fioreze-Suite-1.4.4.exe")
        self.assertNotIn("token", json.dumps(parsed).lower())

    def test_rejects_manifest_with_arbitrary_filename_or_checksum(self):
        invalid_file = manifest_for()
        invalid_file["file"] = "outro.exe"
        with self.assertRaises(UpdateError):
            validate_manifest(invalid_file)
        invalid_hash = manifest_for()
        invalid_hash["sha256"] = "not-a-hash"
        with self.assertRaises(UpdateError):
            validate_manifest(invalid_hash)

    def test_check_announces_only_a_newer_version(self):
        payload = json.dumps(manifest_for()).encode("utf-8")
        opener = lambda *_args, **_kwargs: FakeResponse(payload)
        self.assertEqual(check_for_update("1.4.3", opener=opener)["version"], "1.4.4")
        self.assertIsNone(check_for_update("1.4.4", opener=opener))

    def test_check_rejects_redirect_to_an_untrusted_host(self):
        payload = json.dumps(manifest_for()).encode("utf-8")
        opener = lambda *_args, **_kwargs: FakeResponse(payload, url="https://example.invalid/latest.json")
        with self.assertRaises(UpdateError):
            check_for_update("1.4.3", opener=opener)

    def test_download_verifies_size_and_sha256_before_publishing_file(self):
        content = b"MZ fixture"
        manifest = manifest_for(content)
        opener = lambda *_args, **_kwargs: FakeResponse(
            content,
            {"Content-Length": str(len(content))},
            f"{UPDATE_BASE_URL}/{manifest['file']}",
        )
        progress = []
        with TemporaryDirectory() as directory:
            downloaded = download_update(manifest, directory=directory, opener=opener, on_progress=progress.append)
            self.assertEqual(downloaded.read_bytes(), content)
            self.assertEqual(progress[-1], 100)

    def test_failed_integrity_removes_partial_download(self):
        content = b"MZ fixture"
        manifest = manifest_for(content)
        manifest["sha256"] = "0" * 64
        opener = lambda *_args, **_kwargs: FakeResponse(
            content,
            {"Content-Length": str(len(content))},
            f"{UPDATE_BASE_URL}/{manifest['file']}",
        )
        with TemporaryDirectory() as directory:
            with self.assertRaises(UpdateError):
                download_update(manifest, directory=directory, opener=opener)
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_reminder_is_scoped_to_version_and_expires_after_24_hours(self):
        now = datetime(2026, 8, 13, 12, 0, tzinfo=timezone.utc)
        with TemporaryDirectory() as directory:
            path = Path(directory) / "reminder.json"
            defer_update("1.4.4", path=path, now=now)
            self.assertTrue(is_update_deferred("1.4.4", path=path, now=now + timedelta(hours=23)))
            self.assertFalse(is_update_deferred("1.4.5", path=path, now=now + timedelta(hours=1)))
            self.assertFalse(is_update_deferred("1.4.4", path=path, now=now + timedelta(hours=25)))

    def test_install_uses_non_interactive_powershell_with_literal_local_paths(self):
        calls = []
        with TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "Fioreze-Suite-1.4.4.exe"
            source.write_bytes(b"MZ")
            script = base / "apply.ps1"
            command = schedule_update_install(
                source,
                target=base / "Fioreze-Suite.exe",
                script_path=script,
                popen=lambda args, **kwargs: calls.append((args, kwargs)),
            )
            self.assertIn("-NonInteractive", command)
            self.assertNotIn("-WindowStyle", command)
            self.assertNotIn("-CurrentPid", command)
            script_source = script.read_text(encoding="utf-8")
            self.assertNotIn("Get-Process -Id", script_source)
            self.assertIn("-LiteralPath", script_source)
            self.assertIn("ExecutablePath -eq $Target", script_source)
            self.assertLess(script_source.index("Stop-Process"), script_source.index("Copy-Item"))
            self.assertIn("last-update.log", script_source)
            self.assertFalse(calls[0][1]["shell"])
            self.assertEqual(calls[0][1]["stdin"], -3)
            self.assertEqual(calls[0][1]["stdout"], -3)
            self.assertEqual(calls[0][1]["stderr"], -3)

    def test_external_package_stages_itself_without_removing_the_original(self):
        scheduled = []
        with TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "Downloads" / "Fioreze-Suite.exe"
            target = base / "Installed" / "Fioreze-Suite.exe"
            source.parent.mkdir()
            target.parent.mkdir()
            source.write_bytes(b"MZ new suite")
            target.write_bytes(b"MZ old suite")
            self.assertTrue(bootstrap_installed_suite(
                executable=source,
                installed_executable=target,
                frozen=True,
                directory=base / "updates",
                scheduler=lambda staged, **kwargs: scheduled.append((Path(staged), kwargs)),
            ))
            self.assertEqual(source.read_bytes(), b"MZ new suite")
            self.assertEqual(scheduled[0][0].read_bytes(), b"MZ new suite")
            self.assertEqual(scheduled[0][1]["target"], target)

    def test_installed_or_source_execution_does_not_bootstrap_again(self):
        with TemporaryDirectory() as directory:
            executable = Path(directory) / "Fioreze-Suite.exe"
            executable.write_bytes(b"MZ")
            self.assertFalse(bootstrap_installed_suite(executable=executable, installed_executable=executable, frozen=True))
            self.assertFalse(bootstrap_installed_suite(executable=executable, installed_executable=executable, frozen=False))


if __name__ == "__main__":
    unittest.main()
