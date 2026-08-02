import tempfile
import unittest
from pathlib import Path

from fioreze_print_agent.journal import MAX_ENTRIES, PrintJournal


class JournalTests(unittest.TestCase):
    def test_records_printed_job_before_remote_ack(self):
        with tempfile.TemporaryDirectory() as directory:
            journal = PrintJournal(Path(directory) / "journal.json")
            self.assertFalse(journal.contains("job-1"))
            journal.record("job-1")
            self.assertTrue(journal.contains("job-1"))

    def test_limits_local_history(self):
        with tempfile.TemporaryDirectory() as directory:
            journal = PrintJournal(Path(directory) / "journal.json")
            for index in range(MAX_ENTRIES + 3):
                journal.record(f"job-{index}")
            self.assertFalse(journal.contains("job-0"))
            self.assertTrue(journal.contains(f"job-{MAX_ENTRIES + 2}"))
