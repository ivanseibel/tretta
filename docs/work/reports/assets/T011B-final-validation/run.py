import json
import os
from pathlib import Path
import subprocess

root = Path('/private/tmp/tretta-t011b-revalidation-tR3EE9')
env = os.environ.copy()
env['PATH'] = '/Users/ivanseibel/.nvm/versions/node/v22.23.1/bin:' + env['PATH']
env['pnpm_config_verify_deps_before_run'] = 'false'
env['NEXT_TELEMETRY_DISABLED'] = '1'
checks = [
  ('web', ['pnpm', '--filter', '@tretta/web', 'exec', 'vitest', 'run', '--exclude', 'test/orchestrator-training-refusal.test.tsx']),
  ('runner', ['pnpm', '--filter', '@tretta/web', 'exec', 'vitest', 'run', 'test/orchestrator-training-refusal.test.tsx']),
  ('build', ['pnpm', 'build']),
  ('types', ['pnpm', '-r', '--if-present', 'typecheck']),
]
results = {}
for label, command in checks:
    with (root / (label + '.log')).open('w') as log:
        process = subprocess.run(['rtk', 'proxy', *command], cwd=root / 'tree', env=env, stdout=log, stderr=subprocess.STDOUT)
    results[label] = process.returncode
    (root / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps({'check': label, 'exit': process.returncode}), flush=True)
    if process.returncode:
        print((root / (label + '.log')).read_text()[-9000:])
        raise SystemExit(process.returncode)
