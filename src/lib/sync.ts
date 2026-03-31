export function startDealFlowSync(
  dealflowUrl: string,
  apiKey: string,
  onBatch: (companies: Record<string, unknown>[], sent: number, total: number) => void,
  onComplete: (totalSent: number) => void,
  onError: (error: string) => void
): () => void {
  const popup = window.open(
    `${dealflowUrl}/portal?key=${encodeURIComponent(apiKey)}&mode=sync`,
    'dealflow-sync',
    'width=500,height=400,scrollbars=yes'
  );

  if (!popup) {
    onError('Popup blocked. Please allow popups for this site.');
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    const data = event.data;
    if (data?.type === 'dealflow-batch') {
      if (data.done) {
        onComplete(data.sent || data.total || 0);
        window.removeEventListener('message', handler);
        try { popup.close(); } catch { /* ignore */ }
      } else {
        onBatch(data.companies || [], data.sent || 0, data.total || 0);
      }
    }
  };

  window.addEventListener('message', handler);

  // Check if popup was closed manually
  const interval = setInterval(() => {
    if (popup.closed) {
      clearInterval(interval);
      window.removeEventListener('message', handler);
    }
  }, 1000);

  return () => {
    window.removeEventListener('message', handler);
    clearInterval(interval);
    try { popup.close(); } catch { /* ignore */ }
  };
}
