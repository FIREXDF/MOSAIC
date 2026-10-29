function setupErrorTracking() {
    window.onerror = (
        message: string,
        source: string,
        lineno: number,
        colno: number,
        error: Error | undefined,
    ) => {
        if (window.electronAPI && window.electronAPI.trackError) {
            window.electronAPI.trackError(
                error?.message || String(message),
                error?.stack || `${source}:${lineno}:${colno}`,
                { source: 'renderer', type: 'window.onerror' },
            );
        }
    };

    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
        if (window.electronAPI && window.electronAPI.trackError) {
            const error = event.reason;
            window.electronAPI.trackError(
                error?.message || String(error),
                error?.stack || '',
                { source: 'renderer', type: 'unhandledrejection' },
            );
        }
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupErrorTracking);
} else {
    setupErrorTracking();
}
