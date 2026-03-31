export function startDealFlowSync(
  dealflowUrl: string,
  apiKey: string,
  onBatch: (companies: Record<string, unknown>[], sent: number, total: number) => void,
  onComplete: (totalSent: number) => void,
  onError: (error: string) => void
): () => void {
  const baseUrl = dealflowUrl.replace(/\/$/, '');
  const syncUrl = `${baseUrl}/portal?key=${encodeURIComponent(apiKey)}&mode=sync`;

  // Open popup/tab
  let popup: Window | null = null;
  try {
    popup = window.open(syncUrl, 'dealflow-sync', 'width=520,height=420,scrollbars=yes,resizable=yes');
  } catch { /* blocked */ }

  if (!popup || popup.closed) {
    try {
      popup = window.open(syncUrl, '_blank');
    } catch { /* blocked */ }
  }

  if (!popup) {
    onError(
      'Popup was blocked by your browser. Please allow popups for this site and try again.'
    );
    return () => {};
  }

  let completed = false;
  let totalReceived = 0;

  // Handler for processing sync messages (from postMessage or BroadcastChannel)
  const processMessage = (data: Record<string, unknown>) => {
    if (!data || data.type !== 'dealflow-batch') return;

    if (data.done) {
      completed = true;
      const finalTotal = (data.sent || data.total || totalReceived) as number;
      onComplete(finalTotal);
      cleanup();
      try { popup?.close(); } catch { /* ignore */ }
    } else {
      const companies = (data.companies || []) as Record<string, unknown>[];
      totalReceived += companies.length;
      onBatch(companies, (data.sent || totalReceived) as number, (data.total || 0) as number);
    }
  };

  // Listen via window.postMessage (popup mode)
  const messageHandler = (event: MessageEvent) => {
    if (event.data && typeof event.data === 'object') {
      processMessage(event.data);
    }
  };
  window.addEventListener('message', messageHandler);

  // Also listen via BroadcastChannel (new tab mode)
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel('dealflow-sync');
    channel.onmessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') {
        processMessage(event.data);
      }
    };
  } catch {
    // BroadcastChannel not supported
  }

  // Check if popup was closed without completing
  const interval = setInterval(() => {
    try {
      if (popup && popup.closed && !completed) {
        if (totalReceived > 0) {
          onComplete(totalReceived);
        } else {
          onError('Sync window was closed. Make sure you have companies assigned to this client in DealFlow.');
        }
        cleanup();
      }
    } catch { /* cross-origin */ }
  }, 1500);

  // Timeout after 2 minutes
  const timeout = setTimeout(() => {
    if (!completed) {
      if (totalReceived > 0) {
        onComplete(totalReceived);
      } else {
        onError('Sync timed out. Check that DealFlow is accessible and companies are assigned to this client.');
      }
      cleanup();
      try { popup?.close(); } catch { /* ignore */ }
    }
  }, 120000);

  function cleanup() {
    window.removeEventListener('message', messageHandler);
    clearInterval(interval);
    clearTimeout(timeout);
    try { channel?.close(); } catch { /* ignore */ }
  }

  return cleanup;
}
