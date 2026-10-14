"""Build only code, web assets and synthetic fixtures; never include local user data."""

import argparse
import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from desktop import APP_VERSION


def build():
    if (
        sys.platform != 'win32'
        or platform.machine().lower() not in ('amd64', 'x86_64')
        or struct.calcsize('P') != 8
    ):
        raise SystemExit('Build this release on 64-bit Windows.')
    if subprocess.check_output(
        ['git', 'status', '--porcelain'], cwd=ROOT, text=True
    ).strip():
        raise SystemExit(
            'Commit source changes before building a release so BUILD-INFO matches the source.'
        )
    # Unique output directory avoids deleting existing builds or user files.
    from datetime import datetime

    work = ROOT / 'build' / ('windows-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
    work.mkdir(parents=True)
    distribution = work / 'dist'
    command = [
        sys.executable,
        '-m',
        'PyInstaller',
        '--onefile',
        '--console',
        '--name',
        'QiYingProfit',
        '--distpath',
        str(distribution),
        '--workpath',
        str(work / 'intermediate'),
        '--specpath',
        str(work),
        '--add-data',
        str(ROOT / 'web') + ':web',
        '--add-data',
        str(ROOT / 'data/samples/demo.json') + ':data/samples',
        '--collect-all',
        'openpyxl',
        '--exclude-module',
        'tkinter',
        '--exclude-module',
        'numpy',
        '--exclude-module',
        'pandas',
        '--exclude-module',
        'PIL',
        '--exclude-module',
        'matplotlib',
        str(ROOT / 'desktop.py'),
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    package = work / f'QiYingProfit-{APP_VERSION}-windows-x64'
    package.mkdir()
    shutil.copy2(distribution / 'QiYingProfit.exe', package / 'QiYingProfit.exe')
    shutil.copy2(ROOT / 'docs/windows-release-guide.txt', package / '使用说明.txt')
    licenses = package / 'licenses'
    licenses.mkdir()
    for name in ('openpyxl', 'et_xmlfile', 'pyinstaller'):
        dist = importlib.metadata.distribution(name)
        for file in dist.files or []:
            if any(
                word in file.name.lower() for word in ('license', 'copying', 'notice')
            ) and file.suffix.lower() in ('.txt', '.md', ''):
                origin = Path(dist.locate_file(file))
                if origin.is_file():
                    shutil.copy2(origin, licenses / (name + '-' + origin.name))
    python_license = Path(sys.base_prefix) / 'LICENSE.txt'
    if not python_license.is_file():
        raise SystemExit('Python runtime LICENSE.txt is required for distribution.')
    shutil.copy2(python_license, licenses / 'Python-LICENSE.txt')
    git_sha = subprocess.check_output(
        ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True
    ).strip()
    (package / 'BUILD-INFO.json').write_text(
        json.dumps(
            {
                'version': APP_VERSION,
                'source_commit': git_sha,
                'python': platform.python_version(),
                'pyinstaller': importlib.metadata.version('pyinstaller'),
                'openpyxl': importlib.metadata.version('openpyxl'),
                'platform': 'windows-x64',
            },
            indent=2,
        ),
        encoding='utf-8',
    )
    target = ROOT / 'dist'
    target.mkdir(exist_ok=True)
    archive = target / (package.name + '.zip')
    if archive.exists():
        raise SystemExit(
            f'Release asset already exists: {archive}; choose a new version.'
        )
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(package.rglob('*')):
            if path.is_file():
                bundle.write(path, path.relative_to(package.parent))
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum = target / 'SHA256SUMS.txt'
    checksum.write_text(digest + '  ' + archive.name + '\n', encoding='ascii')
    print(
        json.dumps(
            {
                'archive': str(archive),
                'sha256': digest,
                'checksum': str(checksum),
                'build_directory': str(work),
            },
            indent=2,
        )
    )


if __name__ == '__main__':
    build()
