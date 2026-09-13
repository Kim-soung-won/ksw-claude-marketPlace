"""설치 도구의 범위·경로·충돌 동작을 임시 프로젝트에서 검사한다."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name('install-codex-agents.py')
ROOT = SCRIPT.resolve().parents[1]

class InstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='codex agent project ')
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name)

    def run_install(self, *args, success=True):
        result = subprocess.run([sys.executable, str(SCRIPT), '--project', str(self.project), *args], capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, success, result.stderr)
        return result

    def test_all_preview_install_and_repeat(self):
        self.run_install('--all')
        self.assertFalse((self.project / '.codex').exists())
        self.run_install('--all', '--write')
        files = list((self.project / '.codex/agents').glob('*.toml'))
        self.assertEqual(len(files), len(list((ROOT / 'plugins').glob('*/agents/*.md'))))
        contents = {p:p.read_text() for p in files}
        self.run_install('--all', '--write')
        self.assertEqual(contents, {p:p.read_text() for p in files})
        for file in files:
            # 정해진 문자열 필드만 출력하는 포맷의 이스케이프/줄바꿈 왕복 확인.
            data = {k:json.loads(v) for k,v in (line.split(' = ',1) for line in file.read_text().splitlines())}
            self.assertEqual(data['name'], file.stem)
            self.assertNotIn('{{PLUGIN_ROOT}}',data['developer_instructions'])
            self.assertIn('\n', data['developer_instructions'])

    def test_selection_and_collision_is_all_or_nothing(self):
        self.run_install('--plugin','planning-plugin','--write')
        file=self.project / '.codex/agents/change-planner.toml'
        self.assertIn('"read-only"', file.read_text())
        file.write_text('user content\n')
        self.run_install('--all','--write',success=False)
        self.assertEqual(file.read_text(),'user content\n')
        self.assertEqual(len(list(file.parent.iterdir())),1)

    def test_skill_only_and_unknown_plugin(self):
        self.run_install('--plugin','module-federation-official-plugin','--write')
        self.assertFalse((self.project / '.codex').exists())
        self.run_install('--plugin','../../outside','--write',success=False)

    def test_directory_symlink_rejected(self):
        elsewhere=self.project/'elsewhere'; elsewhere.mkdir()
        (self.project/'.codex').symlink_to(elsewhere, target_is_directory=True)
        self.run_install('--all','--write',success=False)
        self.assertEqual(list(elsewhere.iterdir()),[])

if __name__ == '__main__':
    unittest.main()
