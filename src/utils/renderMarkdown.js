const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const inline = (value) =>
  escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

export function renderMarkdown(markdown) {
  const lines = markdown.trim().split(/\r?\n/);
  const html = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    if (line.startsWith('### ')) {
      closeList();
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      closeList();
      const heading = line.slice(3);
      const id = heading
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      html.push(`<h2 id="${id}">${inline(heading)}</h2>`);
    } else if (line.startsWith('# ')) {
      closeList();
      html.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith('- ')) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
    } else {
      closeList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }

  closeList();
  return html.join('');
}
