const INJECT_SCRIPT_ID = 'bds-injected-data';

const safeSerialize = (data) => {
  return JSON.stringify(data).replace(/<\//g, '<\\/');
};

export const injectPanelData = (htmlText, data) => {
  const html = String(htmlText || '');
  if (!html.trim()) throw new Error('静态模板为空');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const payload = safeSerialize(data || {});

  const staleScripts = doc.querySelectorAll(
    'script[data-bds-echarts], script[src*="echarts.min.js"], script[src*="echarts-wordcloud.min.js"]',
  );
  staleScripts.forEach((node) => node.remove());

  const oldNode = doc.getElementById(INJECT_SCRIPT_ID);
  if (oldNode) oldNode.remove();

  const scriptNode = doc.createElement('script');
  scriptNode.id = INJECT_SCRIPT_ID;
  scriptNode.type = 'application/json';
  scriptNode.textContent = payload;

  if (!doc.body) {
    const body = doc.createElement('body');
    doc.documentElement.appendChild(body);
  }
  doc.body.appendChild(scriptNode);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
};

export const downloadHtmlText = (htmlText, fileName) => {
  const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
