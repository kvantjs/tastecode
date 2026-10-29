import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const children = []
let shuttingDown = false

function run(name, cwd, args, env = {}) {
  const child = spawn('pnpm', args, {
    cwd: path.join(root, cwd),
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
  child.once('error', (error) => {
    if (!shuttingDown) console.error(`[${name}] ${error.message}`)
    void shutdown(1)
  })
  child.once('exit', (code, signal) => {
    if (shuttingDown) return
    const reason = code === null ? `signal ${signal ?? 'unknown'}` : `code ${code}`
    console.error(`[${name}] exited with ${reason}`)
    void shutdown(code ?? 1)
  })
  children.push(child)
}

async function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
  await new Promise((resolve) => setTimeout(resolve, 250))
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  process.exit(code)
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

run('server', 'apps/server', ['run', 'dev'], {
  HARNESS_RENDERER_ORIGIN: 'http://127.0.0.1:5183',
})
run('web', 'apps/web', ['run', 'dev', '--', '--host', '0.0.0.0'])
