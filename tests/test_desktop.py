import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from desktop import default_data_dir,lock_instance


class DesktopTests(unittest.TestCase):
    def test_user_data_directory_does_not_depend_on_bundle_path(self):
        with patch.dict(os.environ,{'LOCALAPPDATA':str(Path(tempfile.gettempdir())/'synthetic-user')}):
            self.assertEqual(default_data_dir(),Path(tempfile.gettempdir())/'synthetic-user'/'QiYingProfit')

    @unittest.skipUnless(os.name=='nt','Windows process locking')
    def test_same_data_directory_cannot_have_two_instances(self):
        with tempfile.TemporaryDirectory() as folder:
            first=lock_instance(Path(folder))
            self.assertIsNotNone(first)
            self.assertIsNone(lock_instance(Path(folder)))
            first.close()
            next_instance=lock_instance(Path(folder))
            self.assertIsNotNone(next_instance)
            next_instance.close()
