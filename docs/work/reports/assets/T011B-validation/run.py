import os
import subprocess
import sys
from pathlib import Path

root = Path('/private/tmp/tretta-t011b-review-82SqkI')
env = os.environ.copy()
env['PATH'] = '/Users/ivanseibel/.nvm/versions/node/v22.23.1/bin:' + env['PATH']
env['pnpm_config_verify_deps_before_run'] = 'false'
env['NEXT_TELEMETRY_DISABLED'] = '1'
checks = {
  'web': ['pnpm', '--filter', '@tretta/web', 'exec', 'vitest', 'run', '--exclude', 'test/orchestrator-training-refusal.test.tsx'],
  'supplemental': ['pnpm', '--filter', '@tretta/web', 'exec', 'vitest', 'run', 'test/orchestrator-training-refusal.test.tsx'],
}
for label in sys.argv[1:]:
    command = ['rtk', 'proxy', *checks[label]]
    with (root / (label + '.log')).open('w') as log:
        result = subprocess.run(command, cwd=root / 'tree', env=env, stdout=log, stderr=subprocess.STDOUT)
    print(f'{label} exit={result.returncode}', flush=True)
    print((root / (label + '.log')).read_text()[-10000:], flush=True)
