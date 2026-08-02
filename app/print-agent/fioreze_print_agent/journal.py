import json
from pathlib import Path

from .config import APP_DIR


JOURNAL_FILE = APP_DIR / "print-journal.json"
MAX_ENTRIES = 1000


class PrintJournal:
    def __init__(self, path=JOURNAL_FILE):
        self.path = Path(path)

    def contains(self, job_id):
        return str(job_id) in self._read()

    def record(self, job_id):
        entries = self._read()
        job_id = str(job_id)
        entries = [entry for entry in entries if entry != job_id]
        entries.append(job_id)
        entries = entries[-MAX_ENTRIES:]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(entries), encoding="utf-8")
        temporary.replace(self.path)

    def _read(self):
        if not self.path.exists():
            return []
        try:
            value = json.loads(self.path.read_text(encoding="utf-8"))
            return [str(entry) for entry in value] if isinstance(value, list) else []
        except (OSError, ValueError):
            return []
