import json
import os
import subprocess
import sys
from pathlib import Path

root = Path('/private/tmp/tretta-t011a-review-usByXi')
workspace = root / 'tretta'
env = os.environ.copy()
env['PATH'] = '/Users/ivanseibel/.nvm/versions/node/v22.23.1/bin:' + env['PATH']
env['NEXT_TELEMETRY_DISABLED'] = '1'
env['pnpm_config_verify_deps_before_run'] = 'false'
checks = [
    ('build', ['pnpm', 'build']),
    ('typecheck', ['pnpm', '-r', '--if-present', 'typecheck']),
    ('server', ['pnpm', '--filter', '@tretta/server', 'test']),
    ('protocol', ['pnpm', '--filter', '@tretta/protocol', 'test']),
    ('web', ['pnpm', '--filter', '@tretta/web', 'test']),
]
selected = set(sys.argv[1:])
results = {}
for label, command in checks:
    if selected and label not in selected:
        continue
    with (root / (label + '.log')).open('w') as log:
        run = subprocess.run(['rtk', 'proxy', *command], cwd=workspace, env=env, stdout=log, stderr=subprocess.STDOUT)
    results[label] = run.returncode
    print(json.dumps({'check': label, 'exit': run.returncode}), flush=True)
    (root / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
    if run.returncode:
        print((root / (label + '.log')).read_text()[-7000:], flush=True)
        sys.exit(run.returncode)
