import { spawn } from 'node:child_process';

export function executeTool(
  command: string,
  args: readonly string[],
  cwd: string,
  timeoutMs = 120000,
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const child = spawn(command, [...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let output = '';
      let errors = '';
      let expired = false;
      const timer = setTimeout(() => {
        expired = true;
        child.kill();
      }, timeoutMs);

      child.stdout.on(
        'data',
        (chunk: Buffer) => {
          output += chunk.toString();

          if (Buffer.byteLength(output) > 8 * 1048576) {
            expired = true;
            child.kill();
          }
        },
      );
      child.stderr.on(
        'data',
        (chunk: Buffer) => {
          errors = (errors + chunk.toString()).slice(-32768);
        },
      );
      child.on('error', error => {
        clearTimeout(timer);
        reject(error);
      });
      child.on(
        'close',
        code => {
          clearTimeout(timer);

          if (expired || code !== 0) {
            reject(
              new Error(
                'Tool failed: ' + command + ' (' + (expired ? 'deadline/output limit' : code) + ') ' + errors,
              ),
            );
          } else {
            resolve(output.trim());
          }
        },
      );
    },
  );
}
