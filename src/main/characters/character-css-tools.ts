import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface ToolExecutionResult {
  stdout: string;
  stderr: string;
}

function getToolCandidates() {
  const appPath = app.getAppPath();
  const resourcesPath = process.resourcesPath;

  return [
    path.join(appPath, 'tools'),
    path.join(resourcesPath, 'tools'),
    path.join(path.dirname(appPath), 'tools'),
  ];
}

function resolveToolsPath(...segments: string[]) {
  for (const candidate of getToolCandidates()) {
    const resolved = path.join(candidate, ...segments);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return path.join(app.getAppPath(), 'tools', ...segments);
}

function prepareExecutableTool(executablePath: string) {
  if (process.platform === 'win32') {
    return executablePath;
  }

  const isAppImageMount =
    Boolean(process.env.APPIMAGE) ||
    executablePath.includes(`${path.sep}.mount_`);

  if (!isAppImageMount) {
    try {
      fs.accessSync(executablePath, fs.constants.X_OK);
      return executablePath;
    } catch {
      // Packaged resources can be read-only and lose executable permissions.
    }
  }

  const sourceDirectory = path.dirname(executablePath);
  const cacheDirectory = path.join(
    app.getPath('temp'),
    'fightplanner-tools',
    app.getVersion(),
    path.basename(sourceDirectory),
  );
  const preparedPath = path.join(
    cacheDirectory,
    path.basename(executablePath),
  );

  if (!fs.existsSync(preparedPath)) {
    fs.cpSync(sourceDirectory, cacheDirectory, {
      recursive: true,
      force: true,
    });
  }

  fs.chmodSync(preparedPath, 0o755);
  return preparedPath;
}

function prepareMsbtEditorExecutable(
  executablePath: string,
  patchedAssemblyPath: string,
) {
  const sourceDirectory = path.dirname(executablePath);
  const cacheDirectory = path.join(
    app.getPath('temp'),
    'fightplanner-tools',
    app.getVersion(),
    path.basename(sourceDirectory),
  );
  const preparedPath = path.join(cacheDirectory, path.basename(executablePath));

  if (!fs.existsSync(preparedPath)) {
    fs.cpSync(sourceDirectory, cacheDirectory, {
      recursive: true,
      force: true,
    });
  }

  // The self-contained app hosts carry the runtime, while this assembly also
  // understands MOSAIC's added_labels extension used by Echo fighters.
  fs.copyFileSync(
    patchedAssemblyPath,
    path.join(cacheDirectory, 'MSBTEditorCli.dll'),
  );
  if (process.platform !== 'win32') {
    fs.chmodSync(preparedPath, 0o755);
  }

  return preparedPath;
}

export function resolveParamLabelsPath(): string | null {
  const candidates = [
    resolveToolsPath('ParamXML', 'ParamLabels.csv'),
    resolveToolsPath('prc2json', 'ParamLabels.csv'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveParamXmlExecutable() {
  let relativeExecutablePath: string;

  switch (process.platform) {
    case 'win32':
      relativeExecutablePath = path.join('ParamXML', 'windows', 'ParamXML.exe');
      break;
    case 'darwin':
      relativeExecutablePath = path.join(
        'ParamXML',
        process.arch === 'arm64' ? 'osx-arm64' : 'osx-x64',
        'ParamXML',
      );
      break;
    case 'linux':
      relativeExecutablePath = path.join('ParamXML', 'linux', 'ParamXML');
      break;
    default:
      throw new Error(`Unsupported platform for ParamXML: ${process.platform}`);
  }

  const executablePath = resolveToolsPath(relativeExecutablePath);
  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `ParamXML executable not found for ${process.platform}: ${executablePath}`,
    );
  }

  return prepareExecutableTool(executablePath);
}

export function runParamXml(inputXmlPath: string) {
  const executablePath = resolveParamXmlExecutable();
  const workingDirectory = path.dirname(inputXmlPath);
  const outputPath = path.join(
    workingDirectory,
    `${path.basename(inputXmlPath, path.extname(inputXmlPath))}.prc`,
  );

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  return new Promise<ToolExecutionResult & { outputPath: string }>(
    (resolve, reject) => {
      const child = spawn(executablePath, ['-a', inputXmlPath], {
        cwd: workingDirectory,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('error', reject);
      child.on('close', (exitCode) => {
        if (exitCode !== 0) {
          reject(
            new Error(
              `ParamXML exited with code ${exitCode}.${stderr ? ` ${stderr.trim()}` : ''}`,
            ),
          );
          return;
        }
        if (!fs.existsSync(outputPath)) {
          reject(
            new Error(
              `ParamXML completed but did not generate ${path.basename(outputPath)}`,
            ),
          );
          return;
        }
        resolve({ stdout, stderr, outputPath });
      });
    },
  );
}

export function runParamXmlDisassemble(inputPrcPath: string, outputXmlPath: string) {
  const executablePath = resolveParamXmlExecutable();
  const workingDirectory = path.dirname(inputPrcPath);

  if (fs.existsSync(outputXmlPath)) {
    fs.unlinkSync(outputXmlPath);
  }

  const labelsPath = resolveParamLabelsPath();
  const args = ['-d', inputPrcPath, '-o', outputXmlPath];
  if (labelsPath) {
    args.push('-l', labelsPath);
  }

  return new Promise<ToolExecutionResult & { outputPath: string }>(
    (resolve, reject) => {
      const child = spawn(executablePath, args, {
        cwd: workingDirectory,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });

      child.on('error', reject);
      child.on('close', (exitCode) => {
        if (exitCode !== 0) {
          reject(
            new Error(
              `ParamXML exited with code ${exitCode}.${stderr ? ` ${stderr.trim()}` : ''}`,
            ),
          );
          return;
        }

        if (!fs.existsSync(outputXmlPath)) {
          reject(
            new Error('ParamXML completed but did not generate XML output'),
          );
          return;
        }

        resolve({ stdout, stderr, outputPath: outputXmlPath });
      });
    },
  );
}

export function resolveMsbtEditorExecutable() {
  let relativeExecutablePath: string;

  switch (process.platform) {
    case 'win32':
      relativeExecutablePath = path.join(
        'MSBTEditorCLI',
        'win-x64',
        'MSBTEditorCli.exe',
      );
      break;
    case 'darwin':
      relativeExecutablePath = path.join(
        'MSBTEditorCLI',
        process.arch === 'arm64' ? 'osx-arm64' : 'osx-x64',
        'MSBTEditorCli',
      );
      break;
    case 'linux':
      relativeExecutablePath = path.join(
        'MSBTEditorCLI',
        'linux-x64',
        'MSBTEditorCli',
      );
      break;
    default:
      throw new Error(
        `Unsupported platform for MSBTEditorCLI: ${process.platform}`,
      );
  }

  const executablePath = resolveToolsPath(relativeExecutablePath);
  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `MSBTEditorCLI executable not found for ${process.platform}/${process.arch}: ${executablePath}`,
    );
  }

  const patchedAssemblyPath = resolveToolsPath(
    'MSBTEditorCLI',
    'MSBTEditorCli.dll',
  );
  if (!fs.existsSync(patchedAssemblyPath)) {
    throw new Error(
      `Patched MSBTEditorCLI assembly not found: ${patchedAssemblyPath}`,
    );
  }

  return prepareMsbtEditorExecutable(executablePath, patchedAssemblyPath);
}

export function runNativeTool(executablePath: string, args: string[]) {
  return new Promise<ToolExecutionResult>((resolve, reject) => {
    const child = spawn(executablePath, args, {
      cwd: path.dirname(executablePath),
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(
          new Error(
            `${path.basename(executablePath)} exited with code ${exitCode}.${stderr ? ` ${stderr.trim()}` : ''}`,
          ),
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function runDotnetTool(toolPath: string, args: string[]) {
  if (!fs.existsSync(toolPath)) {
    throw new Error(`Required tool not found: ${toolPath}`);
  }

  return new Promise<ToolExecutionResult>((resolve, reject) => {
    const child = spawn('dotnet', [toolPath, ...args], {
      env: { ...process.env, DOTNET_ROLL_FORWARD: 'Major' },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            'dotnet is required to save the Character CSS Layout, but it was not found in PATH. Install the .NET runtime and restart MOSAIC.',
          ),
        );
        return;
      }

      reject(error);
    });
    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(
          new Error(
            `dotnet ${path.basename(toolPath)} exited with code ${exitCode}.${stderr ? ` ${stderr.trim()}` : ''}`,
          ),
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

export async function runMsbtToJson(inputMsbtPath: string, outputJsonPath: string) {
  if (fs.existsSync(outputJsonPath)) {
    fs.unlinkSync(outputJsonPath);
  }

  const msbtToolPath = resolveMsbtEditorExecutable();
  return runNativeTool(msbtToolPath, [inputMsbtPath, outputJsonPath]);
}

export async function runPrcToJson(inputPrcPath: string, outputJsonPath: string) {
  if (fs.existsSync(outputJsonPath)) {
    fs.unlinkSync(outputJsonPath);
  }

  const prcToolPath = resolveToolsPath('prc2json', 'prc2json.dll');
  const args = ['-d', inputPrcPath, '-o', outputJsonPath];
  const labelsPath = resolveParamLabelsPath();
  if (labelsPath) {
    args.push('-l', labelsPath);
  }

  return runDotnetTool(prcToolPath, args);
}
