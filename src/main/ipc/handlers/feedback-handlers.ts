import { BrowserWindow, dialog, IpcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { PATHS } from '../../config';
import store from '../../store';
import { BaseHandlerArg } from '../../types/common';

export type FeedbackPayload = {
  type: 'bug' | 'feature' | 'feedback' | 'other';
  message: string;
  contact?: string | null;
  appVersion?: string | null;
  locale?: string | null;
  platform?: string | null;
  logFilePaths?: string[];
};

export type FeedbackHandlers = typeof FeedbackHandlers;

const FEEDBACK_WORKER_URL =
  process.env.FIGHTPLANNER_FEEDBACK_WORKER_URL ||
  (store.get('feedbackWorkerUrl') as string | undefined) ||
  'https://fightplanner-feedback.nathancarlos19100.workers.dev/';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONTACT_LENGTH = 200;

const sanitizeText = (value: unknown, maxLength: number) =>
  String(value || '')
    .trim()
    .slice(0, maxLength);

const MAX_LOG_FILE_BYTES = 2 * 1024 * 1024;
const MAX_LOG_FILES = 5;
const LOG_EXTENSIONS = ['log', 'txt', 'json'];

const pickedLogFiles = new Set<string>();

const isInsideLogsDir = (filePath: string) => {
  const relative = path.relative(path.resolve(PATHS.logsDir()), filePath);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const readLogAttachments = (filePaths: unknown) => {
  const paths = Array.isArray(filePaths) ? filePaths : [];
  if (paths.length > MAX_LOG_FILES) {
    throw new Error(`You can attach up to ${MAX_LOG_FILES} log files`);
  }

  return paths.map((rawPath) => {
    const filePath = path.resolve(String(rawPath));
    if (!isInsideLogsDir(filePath) && !pickedLogFiles.has(filePath)) {
      throw new Error('Invalid log file path');
    }
    const name = path.basename(filePath);
    if (!LOG_EXTENSIONS.includes(path.extname(name).slice(1).toLowerCase())) {
      throw new Error('Log file must be .log, .txt, or .json');
    }
    if (fs.statSync(filePath).size > MAX_LOG_FILE_BYTES) {
      throw new Error(`${name} is larger than 2 MB`);
    }
    return { name, content: fs.readFileSync(filePath) };
  });
};

const FeedbackHandlers = {
  ['select-feedback-log-files']: async (common: BaseHandlerArg) => {
    const win = BrowserWindow.fromWebContents(common.event.sender);
    const result = await dialog.showOpenDialog(win!, {
      defaultPath: PATHS.logsDir(),
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Logs', extensions: LOG_EXTENSIONS }],
    });
    if (result.canceled) {
      return { success: true, files: [] };
    }

    const files = result.filePaths.map((filePath) => {
      const resolved = path.resolve(filePath);
      pickedLogFiles.add(resolved);
      return {
        name: path.basename(resolved),
        filePath: resolved,
        size: fs.statSync(resolved).size,
      };
    });
    return { success: true, files };
  },

  ['submit-feedback']: async (
    common: BaseHandlerArg,
    payload: FeedbackPayload,
  ) => {
    const workerUrl = sanitizeText(FEEDBACK_WORKER_URL, 500);
    if (!workerUrl) {
      return {
        success: false,
        error: 'Feedback worker URL is not configured',
      };
    }

    const type = ['bug', 'feature', 'feedback', 'other'].includes(payload.type)
      ? payload.type
      : 'feedback';
    const message = sanitizeText(payload.message, MAX_MESSAGE_LENGTH);

    if (message.length < 10) {
      return {
        success: false,
        error: 'Feedback message is too short',
      };
    }

    try {
      const logs = readLogAttachments(payload.logFilePaths);
      const body = new FormData();
      body.append(
        'payload_json',
        JSON.stringify({
          type,
          message,
          contact: sanitizeText(payload.contact, MAX_CONTACT_LENGTH) || null,
          appVersion: sanitizeText(payload.appVersion, 80) || null,
          locale: sanitizeText(payload.locale, 20) || null,
          platform: sanitizeText(payload.platform, 40) || process.platform,
          sentAt: new Date().toISOString(),
        }),
      );
      logs.forEach((log) => {
        body.append(
          'logs',
          new Blob([log.content], { type: 'text/plain' }),
          log.name,
        );
      });

      const response = await fetch(workerUrl, { method: 'POST', body });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        return {
          success: false,
          error:
            result?.error || `Feedback service returned ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to submit feedback';
      return { success: false, error: message };
    }
  },
};

export function registerFeedbackHandlers(ipcMain: IpcMain) {
  Object.entries(FeedbackHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, (event, ...args) =>
      handler({ event }, ...(args as [FeedbackPayload])),
    );
  });
}
