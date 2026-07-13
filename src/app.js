import { chapters } from './data/chapters.js';

const root = document.getElementById('root');
const progressKey = 'eagle-logic-progress-v2';
const state = {
  view: viewFromHash(),
  course: null,
  lessons: {},
  progress: loadProgress(),
  author: { signedIn: false, documents: [], activeId: null, draft: null, preview: false, notice: '' },
};

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(progressKey)) || { unlockedTabs: {}, activeTabs: {}, answers: {} }; }
  catch { return { unlockedTabs: {}, activeTabs: {}, answers: {} }; }
}
function saveProgress() { localStorage.setItem(progressKey, JSON.stringify(state.progress)); }
function escapeHtml(value = '') { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function escapeAttr(value = '') { return escapeHtml(value).replaceAll("'", '&#39;'); }
function id() { return crypto.randomUUID().replaceAll('-', ''); }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `lesson-${Date.now()}`; }

function viewFromHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (params.get('lesson')) return { kind: 'lesson', lessonId: params.get('lesson') };
  if (params.get('chapter')) return { kind: 'chapter', chapterId: Number(params.get('chapter')) };
  if (params.get('view') === 'author') return { kind: 'author' };
  if (params.get('view') === 'dashboard') return { kind: 'dashboard' };
  return { kind: 'landing' };
}
function hashFor(view) {
  if (view.kind === 'lesson') return `#lesson=${encodeURIComponent(view.lessonId)}`;
  if (view.kind === 'chapter') return `#chapter=${view.chapterId}`;
  if (view.kind === 'author') return '#view=author';
  if (view.kind === 'dashboard') return '#view=dashboard';
  return '';
}
function setView(view) {
  state.view = view;
  const nextHash = hashFor(view);
  if (location.hash !== nextHash) history.pushState(null, '', nextHash || location.pathname);
  ensureViewData().then(render);
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  if (!response.ok) throw new Error(await response.text() || `Request failed (${response.status}).`);
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : response.text();
}
async function loadCourse() { if (!state.course) state.course = await api('/api/course'); }
async function loadLesson(lessonId, author = false) {
  const path = author ? `/api/author/lessons/${encodeURIComponent(lessonId)}` : `/api/lessons/${encodeURIComponent(lessonId)}`;
  const doc = await api(path);
  if (author) {
    state.author.documents = state.author.documents.map((item) => item.id === doc.id ? doc : item);
    state.author.activeId = doc.id; state.author.draft = structuredClone(doc);
  } else state.lessons[lessonId] = doc;
  return doc;
}
async function ensureViewData() {
  await loadCourse();
  if (state.view.kind === 'lesson' && !state.lessons[state.view.lessonId]) await loadLesson(state.view.lessonId);
  if (state.view.kind === 'author' && state.author.signedIn && !state.author.documents.length) state.author.documents = await api('/api/author/lessons');
}

function shell(content) {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <button class="icon-button" data-view="landing" aria-label="Home" title="Home">âŒ‚</button>
        <div class="topbar-actions">
          <button class="secondary-button" data-view="dashboard">Instructor Dashboard</button>
          <button class="primary-button" data-view="author">Authoring</button>
        </div>
      </header>
      <main class="workspace">${content}</main>
    </div>`;
  root.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView({ kind: button.dataset.view })));
}

function landing() {
  return `<section class="landing"><div class="landing-heading"><p class="small-caps">Logic course</p><h1>Eagle Logic</h1><p>Choose a chapter to continue learning.</p></div><div class="chapter-grid">${chapters.map((chapter) => {
    const count = state.course.lessons.filter((lesson) => lesson.chapterId === chapter.id).length;
    return `<button class="chapter-card ${count ? 'is-current' : ''}" data-chapter="${chapter.id}"><span><strong>${escapeHtml(chapter.title)}</strong><em>${count ? `${count} lesson${count === 1 ? '' : 's'} available` : 'Coming later'}</em></span><b>â€º</b></button>`;
  }).join('')}</div></section>`;
}
function chapterMenu(chapterId) {
  const chapter = chapters.find((item) => item.id === chapterId);
  const lessons = state.course.lessons.filter((lesson) => lesson.chapterId === chapterId).sort((a, b) => a.lessonNumber - b.lessonNumber);
  return `<section class="chapter-page"><button class="back-link" data-view="landing">Back to chapters</button><div class="section-heading"><p class="small-caps">Chapter ${chapterId}</p><h1>${escapeHtml(chapter?.title || 'Chapter')}</h1></div>${lessons.length ? `<div class="lesson-list">${lessons.map((lesson) => `<button class="lesson-card" data-lesson="${lesson.id}"><span><strong>Lesson ${lesson.lessonNumber}: ${escapeHtml(lesson.title)}</strong><p>${escapeHtml(lesson.summary || '')}</p></span><b>â€º</b></button>`).join('')}</div>` : '<p class="placeholder-copy">Lessons for this chapter are coming later.</p>'}</section>`;
}

function getTabs(doc) { return doc?.published?.tabs || []; }
function activeTab(doc) {
  const tabs = getTabs(doc); const active = state.progress.activeTabs[doc.id] || tabs[0]?.id;
  return tabs.find((tab) => tab.id === active) || tabs[0];
}
function renderLesson(doc, preview = false) {
  const tabs = getTabs(doc); const current = activeTab(doc); const unlocked = preview ? tabs.length : Math.max(1, state.progress.unlockedTabs[doc.id] || 1);
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === current?.id));
  return `<section class="lesson-layout"><article class="lesson-content"><div class="lesson-title-row"><div><p class="small-caps">${preview ? 'Draft preview' : `Lesson ${doc.lessonNumber}`}</p><h1>${escapeHtml(doc.title)}</h1></div></div>
    <nav class="section-nav inline" aria-label="Lesson tabs">${tabs.map((tab, tabIndex) => `<button class="section-link ${tab.id === current?.id ? 'is-active' : ''}" data-tab="${tab.id}" ${tabIndex >= unlocked && !preview ? 'disabled' : ''}>${escapeHtml(tab.title)}</button>`).join('')}</nav>
    <div class="reading-panel">${current ? current.containers.map((container) => `<section class="lesson-container"><h2>${escapeHtml(container.title)}</h2>${renderBlocks(container.blocks, doc.id, preview)}</section>`).join('') : '<p>No published content yet.</p>'}${!preview && current ? `<div class="inline-interaction"><button class="primary-button" data-complete-tab>${index === tabs.length - 1 ? 'Lesson complete' : 'Next lesson tab'}</button></div>` : ''}</div>
  </article></section>`;
}
function renderBlocks(blocks, lessonId, preview) {
  return blocks.map((block) => {
    if (block.type === 'richText') return `<div class="rich-content">${sanitizeRichHtml(block.html)}</div>`;
    if (block.type === 'image') return `<figure class="lesson-image align-${block.alignment || 'center'} width-${block.width || 'wide'}"><img src="${escapeAttr(block.src)}" alt="${escapeAttr(block.alt)}">${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}</figure>`;
    if (block.type === 'quiz') return renderQuiz(block, lessonId, preview);
    if (block.type === 'legacySymbolizing') return `<aside class="interactive-placeholder"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.instructions)}</p><span>Legacy interactive</span></aside>`;
    return `<aside class="interactive-placeholder"><strong>${escapeHtml(block.title || 'Interactive activity')}</strong><p>${escapeHtml(block.instructions || '')}</p>${block.status ? `<span>${escapeHtml(block.status)}</span>` : ''}</aside>`;
  }).join('');
}
function renderQuiz(block, lessonId, preview) {
  const answer = state.progress.answers[block.id]; const response = answer?.value || '';
  const feedback = answer ? `<p class="feedback ${answer.correct ? 'is-correct' : 'is-wrong'}">${answer.correct ? 'Correct.' : escapeHtml(block.explanation || 'Review this question and try again.')}</p>` : '';
  const context = block.context ? `<p class="quiz-context">${escapeHtml(block.context)}</p>` : '';
  if (block.quizType === 'fillBlank') return `<section class="question-block"><p class="question-count">Fill in the blank</p><h3>${escapeHtml(block.prompt)}</h3>${context}<div class="fill-row"><input data-quiz-fill="${block.id}" placeholder="Type your answer" value="${escapeAttr(response)}" ${preview ? 'disabled' : ''}><button class="secondary-button" data-quiz-submit="${block.id}" ${preview ? 'disabled' : ''}>Check</button></div>${feedback}</section>`;
  return `<section class="question-block"><p class="question-count">${block.quizType === 'inUse' ? 'Term in use' : 'Multiple choice'}</p><h3>${escapeHtml(block.prompt)}</h3>${context}<div class="choice-stack">${(block.choices || []).map((choice) => `<button data-quiz-choice="${block.id}" data-choice="${escapeAttr(choice)}" ${preview ? 'disabled' : ''}>${escapeHtml(choice)}</button>`).join('')}</div>${feedback}</section>`;
}

function sanitizeRichHtml(value = '') {
  const allowed = new Set(['P', 'H2', 'H3', 'H4', 'STRONG', 'EM', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'SPAN', 'BR']);
  const documentNode = new DOMParser().parseFromString(String(value), 'text/html');
  documentNode.body.querySelectorAll('*').forEach((node) => {
    if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); return; }
    [...node.attributes].forEach((attribute) => {
      const allowedAttribute = (node.tagName === 'A' && attribute.name === 'href' && /^(https?:|mailto:|#)/i.test(attribute.value)) || (node.tagName === 'SPAN' && attribute.name === 'data-tooltip');
      if (!allowedAttribute) node.removeAttribute(attribute.name);
    });
    if (node.tagName === 'SPAN' && node.dataset.tooltip) node.className = 'tooltip-term';
    if (node.tagName === 'A') { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
  });
  return documentNode.body.innerHTML;
}
function dashboard() { return `<section class="dashboard"><div class="section-heading"><p class="small-caps">Instructor/Admin</p><h1>Operational Dashboard</h1><p class="placeholder-copy">Instructor accounts will manage published lesson visibility and student data. They do not receive authoring access.</p></div><div class="dashboard-grid"><div class="dashboard-panel"><h3>Lesson visibility</h3><p>Reserved for instructor-controlled lesson access.</p></div><div class="dashboard-panel"><h3>Student data</h3><p>Reserved for roster and progress views.</p></div><div class="dashboard-panel"><h3>Authoring boundary</h3><p>Only the owner password opens the separate authoring workspace.</p></div></div></section>`; }

function authorLogin() {
  return `<section class="author-login"><div><p class="small-caps">Owner access</p><h1>Authoring</h1><p>Sign in to draft, preview, and publish lessons.</p><form id="author-login-form"><label>Password<input id="author-password" type="password" required autocomplete="current-password"></label><button class="primary-button" type="submit">Sign in</button></form>${state.author.notice ? `<p class="form-notice is-error">${escapeHtml(state.author.notice)}</p>` : ''}</div></section>`;
}
function authorWorkspace() {
  const doc = state.author.draft;
  return `<section class="author-workspace"><aside class="author-sidebar"><div class="author-sidebar-heading"><div><p class="small-caps">Owner authoring</p><h2>Lessons</h2></div><button class="icon-button" data-new-lesson aria-label="New lesson" title="New lesson">+</button></div><div class="author-lesson-list">${state.author.documents.sort((a, b) => a.chapterId - b.chapterId || a.lessonNumber - b.lessonNumber).map((item) => `<button class="author-lesson-item ${item.id === doc?.id ? 'is-active' : ''}" data-author-lesson="${item.id}"><span>Chapter ${item.chapterId}, Lesson ${item.lessonNumber}</span><strong>${escapeHtml(item.title)}</strong></button>`).join('')}</div><button class="secondary-button author-logout" data-author-logout>Sign out</button></aside><div class="author-editor">${doc ? authorEditor(doc) : '<p>Select a lesson to start editing.</p>'}</div></section>`;
}
function authorEditor(doc) {
  const tabs = doc.draft.tabs || [];
  const selectedTabId = doc.editorTabId && tabs.some((tab) => tab.id === doc.editorTabId) ? doc.editorTabId : tabs[0]?.id;
  doc.editorTabId = selectedTabId;
  const tab = tabs.find((item) => item.id === selectedTabId);
  return `<div class="author-editor-head"><div><p class="small-caps">Draft</p><h1>${escapeHtml(doc.title)}</h1></div><div class="author-actions"><button class="secondary-button" data-author-preview>${state.author.preview ? 'Back to editor' : 'Preview draft'}</button><button class="secondary-button" data-save-draft>Save draft</button><button class="primary-button" data-publish>Publish lesson</button></div></div>${state.author.notice ? `<p class="form-notice">${escapeHtml(state.author.notice)}</p>` : ''}${state.author.preview ? `<div class="author-preview">${renderLesson({ ...doc, published: doc.draft }, true)}</div>` : `<div class="editor-scroll"><section class="lesson-metadata"><h2>Lesson details</h2><label>Title<input data-meta="title" value="${escapeAttr(doc.title)}"></label><label>Summary<textarea data-meta="summary">${escapeHtml(doc.summary || '')}</textarea></label><label>Chapter<input data-meta="chapterId" type="number" min="1" max="17" value="${doc.chapterId}"></label><label>Lesson number<input data-meta="lessonNumber" type="number" min="1" value="${doc.lessonNumber}"></label></section><section class="tab-editor"><div class="editor-section-head"><h2>Lesson tabs</h2><button class="secondary-button" data-add-tab>Add tab</button></div><div class="author-tabs">${tabs.map((item, index) => `<div class="author-tab ${item.id === tab?.id ? 'is-active' : ''}"><button data-editor-tab="${item.id}">${escapeHtml(item.title)}</button><span><button class="icon-button" data-move-tab="${item.id}" data-direction="-1" aria-label="Move tab earlier" title="Move earlier" ${index === 0 ? 'disabled' : ''}>â†‘</button><button class="icon-button" data-move-tab="${item.id}" data-direction="1" aria-label="Move tab later" title="Move later" ${index === tabs.length - 1 ? 'disabled' : ''}>â†“</button><button class="icon-button" data-remove-tab="${item.id}" aria-label="Remove tab" title="Remove tab">Ã—</button></span></div>`).join('')}</div></section>${tab ? authorTab(doc, tab) : ''}</div>`}`;
}
function authorTab(doc, tab) {
  return `<section class="container-editor"><div class="editor-section-head"><div><p class="small-caps">Active tab</p><h2>${escapeHtml(tab.title)}<×Ï=¶‰žËkºwµçp ¡‰±½¬¹¡½¥•Ìñðmt¤¹©½¥¸ q¸œ¤¥ôð½Ñ•áÑ…É•„øð½±…‰•°ù€€è€œôñ±…‰•°ù½ÉÉ•Ð…¹ÍÝ•Èñ¥¹ÁÕÐ‘…Ñ„µ‰±½¬µ™¥•±ôˆ‘í‰±½¬¹¥‘õñ…¹ÍÝ•ÈˆÙ…±Õ”ôˆ‘í•Í…Á•ÑÑÈ¡‰±½¬¹…¹ÍÝ•Èñð€œœ¥ôˆøð½±…‰•°øñ±…‰•°ùáÁ±…¹…Ñ¥½¸…™Ñ•È…¸¥¹½ÉÉ•Ð…¹ÍÝ•ÈñÑ•áÑ…É•„‘…Ñ„µ‰±½¬µ™¥•±ôˆ‘í‰±½¬¹¥‘õñ•áÁ±…¹…Ñ¥½¸ˆø‘í•Í…Á•!Ñµ°¡‰±½¬¹•áÁ±…¹…Ñ¥½¸ñð€œœ¥ôð½Ñ•áÑ…É•„øð½±…‰•°øð½‘¥Øøð½Í•Ñ¥½¸ù€ì(€¥˜€¡‰±½¬¹ÑåÁ”€ôôô€±•…åMåµ‰½±¥é¥¹œœ¤É•ÑÕÉ¸€ñÍ•Ñ¥½¸±…ÍÌô‰…ÕÑ¡½Èµ‰±½¬ˆøñ‘¥Ø±…ÍÌô‰‰±½¬µ±…‰•°ˆøñÍÑÉ½¹œù1•…ä¥¹Ñ•É…Ñ¥Ù”ð½ÍÑÉ½¹œø‘í½¹ÑÉ½±Íôð½‘¥ØøñÀùQ¡¥ÌÁÉ•Í•ÉÙ•ÌÑ¡”ÁÉ•Ù¥½ÕÌ]•±°µ½Éµ•½ÉµÕ±„…Ñ¥Ù¥Ñä±½…Ñ¥½¸¸ð½Àøð½Í•Ñ¥½¸ù€ì(€É•ÑÕÉ¸€ñÍ•Ñ¥½¸±…ÍÌô‰…ÕÑ¡½Èµ‰±½¬ˆøñ‘¥Ø±…ÍÌô‰‰±½¬µ±…‰•°ˆøñÍÑÉ½¹œù%¹Ñ•É…Ñ¥Ù”Á±…•¡½±‘•Èð½ÍÑÉ½¹œø‘í½¹ÑÉ½±Íôð½‘¥Øøñ±…‰•°ùQ¥Ñ±”ñ¥¹ÁÕÐ‘…Ñ„µ‰±½¬µ™¥•±ôˆ‘í‰±½¬¹¥‘õñÑ¥Ñ±”ˆÙ…±Õ”ôˆ‘í•Í…Á•ÑÑÈ¡‰±½¬¹Ñ¥Ñ±”ñð€œœ¥ôˆøð½±…‰•°øñ±…‰•°ù%¹ÍÑÉÕÑ¥½¹ÌñÑ•áÑ…É•„‘…Ñ„µ‰±½¬µ™¥•±ôˆ‘í‰±½¬¹¥‘õñ¥¹ÍÑÉÕÑ¥½¹Ìˆø‘í•Í…Á•!Ñµ°¡‰±½¬¹¥¹ÍÑÉÕÑ¥½¹Ìñð€œœ¥ôð½Ñ•áÑ…É•„øð½±…‰•°øñ±…‰•°ùMÑ…ÑÕÌñÍ•±•Ð‘…Ñ„µ‰±½¬µ™¥•±ôˆ‘í‰±½¬¹¥‘õñÍÑ…ÑÕÌˆøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆ€‘ì…‰±½¬¹ÍÑ…ÑÕÌ€ü€Í•±•Ñ•œ€è€œôù9¼ÍÑ…ÑÕÌð½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰½µ¥¹œÍ½½¸ˆ€‘í‰±½¬¹ÍÑ…ÑÕÌ€ôôô€½µ¥¹œÍ½½¸œ€ü€Í•±•Ñ•œ€è€œôù½µ¥¹œÍ½½¸ð½½ÁÑ¥½¸øð½Í•±•Ðøð½±…‰•°øñ‘¥Ø±…ÍÌô‰Á±…•¡½±‘•ÈµÍÑ…”ˆùI•Í•ÉÙ•¥¹Ñ•É…Ñ¥Ù”‘¥ÍÁ±…ä…É•„ð½‘¥Øøð½Í•Ñ¥½¸ù€ì)ô()™Õ¹Ñ¥½¸‰±…¹­	±½¬¡ÑåÁ”¤ì(€¥˜€¡ÑåÁ”€ôôô€¥µ…”œ¤É•ÑÕÉ¸ì¥è¥ ¤°ÑåÁ”°ÍÉŒè€œœ°…±Ðè€œœ°…ÁÑ¥½¸è€œœ°…±¥¹µ•¹Ðè€•¹Ñ•Èœ°Ý¥‘Ñ è€Ý¥‘”œôì(€¥˜€¡ÑåÁ”€ôôô€ÅÕ¥èœ¤É•ÑÕÉ¸ì¥è¥ ¤°ÑåÁ”°ÅÕ¥éQåÁ”è€µÕ±Ñ¥Á±•¡½¥”œ°ÁÉ½µÁÐè€œœ°½¹Ñ•áÐè€œœ°¡½¥•Ìèl=ÁÑ¥½¸½¹”œ°€=ÁÑ¥½¸ÑÝ¼t°…¹ÍÝ•Èè€œœ°•áÁ±…¹…Ñ¥½¸è€œœôì(€¥˜€¡ÑåÁ”€ôôô€¥¹Ñ•É…Ñ¥Ù•A±…•¡½±‘•Èœ¤É•ÑÕÉ¸ì¥è¥ ¤°ÑåÁ”°Ñ¥Ñ±”è€%¹Ñ•É…Ñ¥Ù”…Ñ¥Ù¥Ñäœ°¥¹ÍÑÉÕÑ¥½¹Ìè€œœ°ÍÑ…ÑÕÌè€½µ¥¹œÍ½½¸œôì(€É•ÑÕÉ¸ì¥è¥ ¤°ÑåÁ”è€É¥¡Q•áÐœ°¡Ñµ°è€œñÀùMÑ…ÉÐÝÉ¥Ñ¥¹œ¡•É”¸ð½Àøœôì)ô)™Õ¹Ñ¥½¸‰±…¹­½¹Ñ…¥¹•È¡Ñ¥Ñ±”€ô€9•ÜÍ•Ñ¥½¸œ¤ìÉ•ÑÕÉ¸ì¥è¥ ¤°Ñ¥Ñ±”°‰±½­Ìèm‰±…¹­	±½¬ É¥¡Q•áÐœ¥tôìô)™Õ¹Ñ¥½¸•ÑÕÑ¡½É	±½¬¡‰±½­%¤ì™½È€¡½¹ÍÐÑ…ˆ½˜ÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì¤™½È€¡½¹ÍÐ½¹Ñ…¥¹•È½˜Ñ…ˆ¹½¹Ñ…¥¹•ÉÌ¤ì½¹ÍÐ‰±½¬€ô½¹Ñ…¥¹•È¹‰±½­Ì¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€ôôô‰±½­%¤ì¥˜€¡‰±½¬¤É•ÑÕÉ¸‰±½¬ìôÉ•ÑÕÉ¸¹Õ±°ìô)™Õ¹Ñ¥½¸•Ñ½¹Ñ…¥¹•È¡½¹Ñ…¥¹•É%¤ì™½È€¡½¹ÍÐÑ…ˆ½˜ÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì¤ì½¹ÍÐ½¹Ñ…¥¹•È€ôÑ…ˆ¹½¹Ñ…¥¹•ÉÌ¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€ôôô½¹Ñ…¥¹•É%¤ì¥˜€¡½¹Ñ…¥¹•È¤É•ÑÕÉ¸ìÑ…ˆ°½¹Ñ…¥¹•ÈôìôÉ•ÑÕÉ¸¹Õ±°ìô)™Õ¹Ñ¥½¸µ½Ù•%Ñ•´¡¥Ñ•µÌ°¥Ñ•µ%°‘¥É•Ñ¥½¸¤ì½¹ÍÐ¥¹‘•à€ô¥Ñ•µÌ¹™¥¹‘%¹‘•à ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€ôôô¥Ñ•µ%¤ì½¹ÍÐÑ…É•Ð€ô¥¹‘•à€¬‘¥É•Ñ¥½¸ì¥˜€¡¥¹‘•à€øô€À€˜˜Ñ…É•Ð€øô€À€˜˜Ñ…É•Ð€ð¥Ñ•µÌ¹±•¹Ñ ¤m¥Ñ•µÍm¥¹‘•át°¥Ñ•µÍmÑ…É•Ñut€ôm¥Ñ•µÍmÑ…É•Ñt°¥Ñ•µÍm¥¹‘•áutìô()…Íå¹Œ™Õ¹Ñ¥½¸Í¥¹%¸¡Á…ÍÍÝ½É¤ì…Ý…¥Ð…Á¤ œ½…Á¤½…ÕÑ¡½È½±½¥¸œ°ìµ•Ñ¡½è€A=MPœ°¡•…‘•ÉÌèì€½¹Ñ•¹ÐµQåÁ”œè€…ÁÁ±¥…Ñ¥½¸½©Í½¸œô°‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡ìÁ…ÍÍÝ½Éô¤ô¤ìÍÑ…Ñ”¹…ÕÑ¡½È¹Í¥¹•‘%¸€ôÑÉÕ”ìÍÑ…Ñ”¹…ÕÑ¡½È¹‘½Õµ•¹ÑÌ€ô…Ý…¥Ð…Á¤ œ½…Á¤½…ÕÑ¡½È½±•ÍÍ½¹Ìœ¤ì…Ý…¥ÐÍ•±•ÑÕÑ¡½É1•ÍÍ½¸¡ÍÑ…Ñ”¹…ÕÑ¡½È¹‘½Õµ•¹ÑÍlÁtü¹¥¤ìô)…Íå¹Œ™Õ¹Ñ¥½¸Í•±•ÑÕÑ¡½É1•ÍÍ½¸¡±•ÍÍ½¹%¤ì¥˜€ …±•ÍÍ½¹%¤É•ÑÕÉ¸ì…Ý…¥Ð±½…‘1•ÍÍ½¸¡±•ÍÍ½¹%°ÑÉÕ”¤ìÍÑ…Ñ”¹…ÕÑ¡½È¹ÁÉ•Ù¥•Ü€ô™…±Í”ìÍÑ…Ñ”¹…ÕÑ¡½È¹¹½Ñ¥”€ô€œœìÉ•¹‘•È ¤ìô)…Íå¹Œ™Õ¹Ñ¥½¸Í…Ù•É…™Ð ¤ì½¹ÍÐ‘½Œ€ôÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ðì½¹ÍÐÍ…Ù•€ô…Ý…¥Ð…Á¤¡€½…Á¤½…ÕÑ¡½È½±•ÍÍ½¹Ì¼‘í•¹½‘•UI%½µÁ½¹•¹Ð¡‘½Œ¹¥¥õ€°ìµ•Ñ¡½è€AUPœ°¡•…‘•ÉÌèì€½¹Ñ•¹ÐµQåÁ”œè€…ÁÁ±¥…Ñ¥½¸½©Í½¸œô°‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡‘½Œ¤ô¤ìÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð€ôÍ…Ù•ìÍÑ…Ñ”¹…ÕÑ¡½È¹‘½Õµ•¹ÑÌ€ôÍÑ…Ñ”¹…ÕÑ¡½È¹‘½Õµ•¹ÑÌ¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€ôôôÍ…Ù•¹¥€üÍ…Ù•€è¥Ñ•´¤ìÍÑ…Ñ”¹…ÕÑ¡½È¹¹½Ñ¥”€ô€É…™ÐÍ…Ù•¸œìÉ•¹‘•È ¤ìô)…Íå¹Œ™Õ¹Ñ¥½¸ÁÕ‰±¥Í¡1•ÍÍ½¸ ¤ì…Ý…¥ÐÍ…Ù•É…™Ð ¤ì½¹ÍÐÍ…Ù•€ô…Ý…¥Ð…Á¤¡€½…Á¤½…ÕÑ¡½È½±•ÍÍ½¹Ì¼‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹¥¥ô½ÁÕ‰±¥Í¡€°ìµ•Ñ¡½è€A=MPœô¤ìÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð€ôÍ…Ù•ìÍÑ…Ñ”¹…ÕÑ¡½È¹‘½Õµ•¹ÑÌ€ôÍÑ…Ñ”¹…ÕÑ¡½È¹‘½Õµ•¹ÑÌ¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€ôôôÍ…Ù•¹¥€üÍ…Ù•€è¥Ñ•´¤ìÍÑ…Ñ”¹±•ÍÍ½¹ÍmÍ…Ù•¹¥‘t€ôì€¸¸¹Í…Ù•°ÁÕ‰±¥Í¡•èÍ…Ù•¹ÁÕ‰±¥Í¡•ôìÍÑ…Ñ”¹…ÕÑ¡½È¹¹½Ñ¥”€ô€1•ÍÍ½¸ÁÕ‰±¥Í¡•¸œìÉ•¹‘•È ¤ìô)…Íå¹Œ™Õ¹Ñ¥½¸É•…Ñ•1•ÍÍ½¸ ¤ì½¹ÍÐ±•ÍÍ½¹9Õµ‰•È€ô5…Ñ ¹µ…à À°€¸¸¹ÍÑ…Ñ”¹…ÕÑ¡½È¹‘½Õµ•¹ÑÌ¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹¡…ÁÑ•É%€ôôô€Ä¤¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹±•ÍÍ½¹9Õµ‰•Èñð€À¤¤€¬€Äì½¹ÍÐ±•ÍÍ½¹%€ô¹•Üµ±•ÍÍ½¸´‘í…Ñ”¹¹½Ü ¥õ€ì½¹ÍÐ‘½Œ€ôì¥è±•ÍÍ½¹%°¡…ÁÑ•É%è€Ä°±•ÍÍ½¹9Õµ‰•È°Ñ¥Ñ±”è€U¹Ñ¥Ñ±•±•ÍÍ½¸œ°ÍÕµµ…Éäè€œœ°‘É…™ÐèìÑ…‰Ìèmì¥è€É•…‘¥¹œœ°Ñ¥Ñ±”è€I•…‘¥¹œœ°½¹Ñ…¥¹•ÉÌèm‰±…¹­½¹Ñ…¥¹•È I•…‘¥¹œœ¥tõtô°ÁÕ‰±¥Í¡•èìÑ…‰ÌèmtôôìÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð€ô‘½ŒìÍÑ…Ñ”¹…ÕÑ¡½È¹‘½Õµ•¹ÑÌ¹ÁÕÍ ¡‘½Œ¤ì…Ý…¥ÐÍ…Ù•É…™Ð ¤ìô()™Õ¹Ñ¥½¸‰¥¹‘1•ÍÍ½¸¡‘½Œ°ÁÉ•Ù¥•Ü€ô™…±Í”¤ì(€¥˜€¡ÁÉ•Ù¥•Ü¤É•ÑÕÉ¸ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÑ…‰tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøìÍÑ…Ñ”¹ÁÉ½É•ÍÌ¹…Ñ¥Ù•Q…‰Ím‘½Œ¹¥‘t€ô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Ñ…ˆìÍ…Ù•AÉ½É•ÍÌ ¤ìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µ½µÁ±•Ñ”µÑ…‰tœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐÑ…‰Ì€ô•ÑQ…‰Ì¡‘½Œ¤ì½¹ÍÐ¥¹‘•à€ôÑ…‰Ì¹™¥¹‘%¹‘•à ¡Ñ…ˆ¤€ôøÑ…ˆ¹¥€ôôô…Ñ¥Ù•Q…ˆ¡‘½Œ¤¹¥¤ìÍÑ…Ñ”¹ÁÉ½É•ÍÌ¹Õ¹±½­•‘Q…‰Ím‘½Œ¹¥‘t€ô5…Ñ ¹µ¥¸¡Ñ…‰Ì¹±•¹Ñ °5…Ñ ¹µ…à¡ÍÑ…Ñ”¹ÁÉ½É•ÍÌ¹Õ¹±½­•‘Q…‰Ím‘½Œ¹¥‘tñð€Ä°¥¹‘•à€¬€È¤¤ì¥˜€¡Ñ…‰Ím¥¹‘•à€¬€Åt¤ÍÑ…Ñ”¹ÁÉ½É•ÍÌ¹…Ñ¥Ù•Q…‰Ím‘½Œ¹¥‘t€ôÑ…‰Ím¥¹‘•à€¬€Åt¹¥ìÍ…Ù•AÉ½É•ÍÌ ¤ìÉ•¹‘•È ¤ìô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÅÕ¥èµ¡½¥•tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôø…¹ÍÝ•ÉEÕ¥è¡‘½Œ°‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ÅÕ¥é¡½¥”°‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹¡½¥”¤¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÅÕ¥èµÍÕ‰µ¥Ñtœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐ¥¹ÁÕÐ€ôÉ½½Ð¹ÅÕ•ÉåM•±•Ñ½È¡m‘…Ñ„µÅÕ¥èµ™¥±°ôˆ‘í‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ÅÕ¥éMÕ‰µ¥Ñô‰u€¤ì…¹ÍÝ•ÉEÕ¥è¡‘½Œ°‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ÅÕ¥éMÕ‰µ¥Ð°¥¹ÁÕÐü¹Ù…±Õ”ñð€œœ¤ìô¤¤ì)ô)™Õ¹Ñ¥½¸…¹ÍÝ•ÉEÕ¥è¡‘½Œ°‰±½­%°Ù…±Õ”¤ì½¹ÍÐ‰±½¬€ô™¥¹‘AÕ‰±¥Í¡•‘	±½¬¡‘½Œ°‰±½­%¤ì½¹ÍÐ½ÉÉ•Ð€ôMÑÉ¥¹œ¡Ù…±Õ”¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤€ôôôMÑÉ¥¹œ¡‰±½¬ü¹…¹ÍÝ•Èñð€œœ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤ìÍÑ…Ñ”¹ÁÉ½É•ÍÌ¹…¹ÍÝ•ÉÍm‰±½­%‘t€ôìÙ…±Õ”°½ÉÉ•ÐôìÍ…Ù•AÉ½É•ÍÌ ¤ìÉ•¹‘•È ¤ìô)™Õ¹Ñ¥½¸™¥¹‘AÕ‰±¥Í¡•‘	±½¬¡‘½Œ°‰±½­%¤ì™½È€¡½¹ÍÐÑ…ˆ½˜•ÑQ…‰Ì¡‘½Œ¤¤™½È€¡½¹ÍÐ½¹Ñ…¥¹•È½˜Ñ…ˆ¹½¹Ñ…¥¹•ÉÌ¤ì½¹ÍÐ‰±½¬€ô½¹Ñ…¥¹•È¹‰±½­Ì¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€ôôô‰±½­%¤ì¥˜€¡‰±½¬¤É•ÑÕÉ¸‰±½¬ìôÉ•ÑÕÉ¸¹Õ±°ìô()™Õ¹Ñ¥½¸‰¥¹‘ÕÑ¡½È ¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½È œ…ÕÑ¡½Èµ±½¥¸µ™½É´œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ìÍÑ…Ñ”¹…ÕÑ¡½È¹¹½Ñ¥”€ô€œœìÑÉäì…Ý…¥ÐÍ¥¹%¸¡É½½Ð¹ÅÕ•ÉåM•±•Ñ½È œ…ÕÑ¡½ÈµÁ…ÍÍÝ½Éœ¤¹Ù…±Õ”¤ìô…Ñ €¡•ÉÉ½È¤ìÍÑ…Ñ”¹…ÕÑ¡½È¹¹½Ñ¥”€ô•ÉÉ½È¹µ•ÍÍ…”ìÉ•¹‘•È ¤ìôô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ…ÕÑ¡½Èµ±•ÍÍ½¹tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøÍ•±•ÑÕÑ¡½É1•ÍÍ½¸¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…ÕÑ¡½É1•ÍÍ½¸¤¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µ¹•Üµ±•ÍÍ½¹tœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøÉ•…Ñ•1•ÍÍ½¸ ¤¹…Ñ ¡Í¡½ÝÕÑ¡½ÉÉÉ½È¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µ…ÕÑ¡½Èµ±½½ÕÑtœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°…Íå¹Œ€ ¤€ôøì…Ý…¥Ð…Á¤ œ½…Á¤½…ÕÑ¡½È½±½½ÕÐœ°ìµ•Ñ¡½è€A=MPœô¤ìÍÑ…Ñ”¹…ÕÑ¡½È€ôìÍ¥¹•‘%¸è™…±Í”°‘½Õµ•¹ÑÌèmt°…Ñ¥Ù•%è¹Õ±°°‘É…™Ðè¹Õ±°°ÁÉ•Ù¥•Üè™…±Í”°¹½Ñ¥”è€œœôìÉ•¹‘•È ¤ìô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µ…ÕÑ¡½ÈµÁÉ•Ù¥•Ýtœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøìÍÑ…Ñ”¹…ÕÑ¡½È¹ÁÉ•Ù¥•Ü€ô€…ÍÑ…Ñ”¹…ÕÑ¡½È¹ÁÉ•Ù¥•ÜìÉ•¹‘•È ¤ìô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µÍ…Ù”µ‘É…™Ñtœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøÍ…Ù•É…™Ð ¤¹…Ñ ¡Í¡½ÝÕÑ¡½ÉÉÉ½È¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µÁÕ‰±¥Í¡tœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøÁÕ‰±¥Í¡1•ÍÍ½¸ ¤¹…Ñ ¡Í¡½ÝÕÑ¡½ÉÉÉ½È¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µµ•Ñ…tœ¤¹™½É…  ¡¥¹ÁÕÐ¤€ôø¥¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¥¹ÁÕÐœ°€ ¤€ôøì½¹ÍÐ­•ä€ô¥¹ÁÕÐ¹‘…Ñ…Í•Ð¹µ•Ñ„ìÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ñm­•åt€ô­•ä€ôôô€¡…ÁÑ•É%œñð­•ä€ôôô€±•ÍÍ½¹9Õµ‰•Èœ€ü9Õµ‰•È¡¥¹ÁÕÐ¹Ù…±Õ”¤€è¥¹ÁÕÐ¹Ù…±Õ”ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ•‘¥Ñ½ÈµÑ…‰tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøìÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹•‘¥Ñ½ÉQ…‰%€ô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹•‘¥Ñ½ÉQ…ˆìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µ…‘µÑ…‰tœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐÑ…ˆ€ôì¥èÑ…ˆ´‘í¥ ¥õ€°Ñ¥Ñ±”è€9•ÜÑ…ˆœ°½¹Ñ…¥¹•ÉÌèm‰±…¹­½¹Ñ…¥¹•È 9•ÜÍ•Ñ¥½¸œ¥tôìÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì¹ÁÕÍ ¡Ñ…ˆ¤ìÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹•‘¥Ñ½ÉQ…‰%€ôÑ…ˆ¹¥ìÉ•¹‘•È ¤ìô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÑ…ˆµÑ¥Ñ±•tœ¤¹™½É…  ¡¥¹ÁÕÐ¤€ôø¥¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¥¹ÁÕÐœ°€ ¤€ôøìÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì¹™¥¹ ¡Ñ…ˆ¤€ôøÑ…ˆ¹¥€ôôô¥¹ÁÕÐ¹‘…Ñ…Í•Ð¹Ñ…‰Q¥Ñ±”¤¹Ñ¥Ñ±”€ô¥¹ÁÕÐ¹Ù…±Õ”ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µµ½Ù”µÑ…‰tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøìµ½Ù•%Ñ•´¡ÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì°‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹µ½Ù•Q…ˆ°9Õµ‰•È¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘¥É•Ñ¥½¸¤¤ìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÉ•µ½Ù”µÑ…‰tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì¥˜€¡ÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì¹±•¹Ñ €ôôô€Ä¤É•ÑÕÉ¸ìÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì€ôÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì¹™¥±Ñ•È ¡Ñ…ˆ¤€ôøÑ…ˆ¹¥€„ôô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹É•µ½Ù•Q…ˆ¤ìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ…‘µ½¹Ñ…¥¹•Étœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐÑ…ˆ€ôÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€ôôô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…‘‘½¹Ñ…¥¹•È¤ìÑ…ˆ¹½¹Ñ…¥¹•ÉÌ¹ÁÕÍ ¡‰±…¹­½¹Ñ…¥¹•È ¤¤ìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ½¹Ñ…¥¹•ÈµÑ¥Ñ±•tœ¤¹™½É…  ¡¥¹ÁÕÐ¤€ôø¥¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¥¹ÁÕÐœ°€ ¤€ôøì•Ñ½¹Ñ…¥¹•È¡¥¹ÁÕÐ¹‘…Ñ…Í•Ð¹½¹Ñ…¥¹•ÉQ¥Ñ±”¤¹½¹Ñ…¥¹•È¹Ñ¥Ñ±”€ô¥¹ÁÕÐ¹Ù…±Õ”ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µµ½Ù”µ½¹Ñ…¥¹•Étœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐÑ…ˆ€ôÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€ôôô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Ñ…‰=Ý¹•È¤ìµ½Ù•%Ñ•´¡Ñ…ˆ¹½¹Ñ…¥¹•ÉÌ°‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹µ½Ù•½¹Ñ…¥¹•È°9Õµ‰•È¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘¥É•Ñ¥½¸¤¤ìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÉ•µ½Ù”µ½¹Ñ…¥¹•Étœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐÑ…ˆ€ôÍÑ…Ñ”¹…ÕÑ¡½È¹‘É…™Ð¹‘É…™Ð¹Ñ…‰Ì¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€ôôô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Ñ…‰=Ý¹•È¤ì¥˜€¡Ñ…ˆ¹½¹Ñ…¥¹•ÉÌ¹±•¹Ñ €ôôô€Ä¤É•ÑÕÉ¸ìÑ…ˆ¹½¹Ñ…¥¹•ÉÌ€ôÑ…ˆ¹½¹Ñ…¥¹•ÉÌ¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€„ôô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹É•µ½Ù•½¹Ñ…¥¹•È¤ìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ…‘µ‰±½­tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì•Ñ½¹Ñ…¥¹•È¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹½¹Ñ…¥¹•É=Ý¹•È¤¹½¹Ñ…¥¹•È¹‰±½­Ì¹ÁÕÍ ¡‰±…¹­	±½¬¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…‘‘	±½¬¤¤ìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µµ½Ù”µ‰±½­tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐ½¹Ñ…¥¹•È€ô•Ñ½¹Ñ…¥¹•È¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹½¹Ñ…¥¹•É=Ý¹•È¤¹½¹Ñ…¥¹•Èìµ½Ù•%Ñ•´¡½¹Ñ…¥¹•È¹‰±½­Ì°‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹µ½Ù•	±½¬°9Õµ‰•È¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘¥É•Ñ¥½¸¤¤ìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÉ•µ½Ù”µ‰±½­tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐ½¹Ñ…¥¹•È€ô•Ñ½¹Ñ…¥¹•È¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹½¹Ñ…¥¹•É=Ý¹•È¤¹½¹Ñ…¥¹•Èì½¹Ñ…¥¹•È¹‰±½­Ì€ô½¹Ñ…¥¹•È¹‰±½­Ì¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹¥€„ôô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹É•µ½Ù•	±½¬¤ì¥˜€ …½¹Ñ…¥¹•È¹‰±½­Ì¹±•¹Ñ ¤½¹Ñ…¥¹•È¹‰±½­Ì¹ÁÕÍ ¡‰±…¹­	±½¬ É¥¡Q•áÐœ¤¤ìÉ•¹‘•È ¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ‰±½¬µ™¥•±‘tœ¤¹™½É…  ¡¥¹ÁÕÐ¤€ôø¥¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¥¹ÁÕÐœ°€ ¤€ôøì½¹ÍÐm‰±½­%°™¥•±‘t€ô¥¹ÁÕÐ¹‘…Ñ…Í•Ð¹‰±½­¥•±¹ÍÁ±¥Ð ðœ¤ì•ÑÕÑ¡½É	±½¬¡‰±½­%¥m™¥•±‘t€ô¥¹ÁÕÐ¹Ù…±Õ”ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ‰±½¬µ¡½¥•Ítœ¤¹™½É…  ¡¥¹ÁÕÐ¤€ôø¥¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¥¹ÁÕÐœ°€ ¤€ôøì•ÑÕÑ¡½É	±½¬¡¥¹ÁÕÐ¹‘…Ñ…Í•Ð¹‰±½­¡½¥•Ì¤¹¡½¥•Ì€ô¥¹ÁÕÐ¹Ù…±Õ”¹ÍÁ±¥Ð q¸œ¤¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÉ¥ µ•‘¥Ñ½Étœ¤¹™½É…  ¡•‘¥Ñ½È¤€ôø•‘¥Ñ½È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±ÕÈœ°€ ¤€ôøì•ÑÕÑ¡½É	±½¬¡•‘¥Ñ½È¹‘…Ñ…Í•Ð¹É¥¡‘¥Ñ½È¤¹¡Ñµ°€ôÍ…¹¥Ñ¥é•I¥¡!Ñµ°¡•‘¥Ñ½È¹¥¹¹•É!Q50¤ìô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ™½Éµ…Ñtœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôøì‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È µ½ÕÍ•‘½Ý¸œ°€¡•Ù•¹Ð¤€ôø•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤¤ì‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐÑ…É•Ð€ôÉ½½Ð¹ÅÕ•ÉåM•±•Ñ½È¡m‘…Ñ„µÉ¥ µ•‘¥Ñ½Èôˆ‘í‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹É¥¡Q…É•Ñô‰u€¤ìÑ…É•Ðü¹™½ÕÌ ¤ì¥˜€¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™½Éµ…Ð€ôôô€±¥¹¬œ¤ì½¹ÍÐ¡É•˜€ôÁÉ½µÁÐ 1¥¹¬UI0œ¤ì¥˜€¡¡É•˜¤‘½Õµ•¹Ð¹•á•½µµ…¹ É•…Ñ•1¥¹¬œ°™…±Í”°¡É•˜¤ìô•±Í”‘½Õµ•¹Ð¹•á•½µµ…¹¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™½Éµ…Ð°™…±Í”°‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™½Éµ…ÑY…±Õ”ñð¹Õ±°¤ìô¤ìô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ…ÁÁ±äµÑ½½±Ñ¥Átœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôøì‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È µ½ÕÍ•‘½Ý¸œ°€¡•Ù•¹Ð¤€ôø•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤¤ì‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì½¹ÍÐ•‘¥Ñ½È€ôÉ½½Ð¹ÅÕ•ÉåM•±•Ñ½È¡m‘…Ñ„µÉ¥ µ•‘¥Ñ½Èôˆ‘í‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…ÁÁ±åQ½½±Ñ¥Áô‰u€¤ì½¹ÍÐ‰½‘ä€ôÉ½½Ð¹ÅÕ•ÉåM•±•Ñ½È¡m‘…Ñ„µÑ½½±Ñ¥Àµ‰½‘äôˆ‘í‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…ÁÁ±åQ½½±Ñ¥Áô‰u€¤ü¹Ù…±Õ”¹ÑÉ¥´ ¤ì½¹ÍÐÍ•±•Ñ¥½¸€ôÝ¥¹‘½Ü¹•ÑM•±•Ñ¥½¸ ¤ì¥˜€ …‰½‘äñð€…Í•±•Ñ¥½¸ü¹É…¹•½Õ¹Ðñð€…•‘¥Ñ½Èü¹½¹Ñ…¥¹Ì¡Í•±•Ñ¥½¸¹…¹¡½É9½‘”¤¤É•ÑÕÉ¸ì½¹ÍÐÉ…¹”€ôÍ•±•Ñ¥½¸¹•ÑI…¹•Ð À¤ì¥˜€¡É…¹”¹½±±…ÁÍ•¤É•ÑÕÉ¸ì½¹ÍÐÍÁ…¸€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ÍÁ…¸œ¤ìÍÁ…¸¹‘…Ñ…Í•Ð¹Ñ½½±Ñ¥À€ô‰½‘äìÍÁ…¸¹±…ÍÍ9…µ”€ô€Ñ½½±Ñ¥ÀµÑ•É´œìÑÉäìÉ…¹”¹ÍÕÉÉ½Õ¹‘½¹Ñ•¹ÑÌ¡ÍÁ…¸¤ìô…Ñ ì½¹ÍÐ™É…µ•¹Ð€ôÉ…¹”¹•áÑÉ…Ñ½¹Ñ•¹ÑÌ ¤ìÍÁ…¸¹…ÁÁ•¹¡™É…µ•¹Ð¤ìÉ…¹”¹¥¹Í•ÉÑ9½‘”¡ÍÁ…¸¤ìô•ÑÕÑ¡½É	±½¬¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…ÁÁ±åQ½½±Ñ¥À¤¹¡Ñµ°€ôÍ…¹¥Ñ¥é•I¥¡!Ñµ°¡•‘¥Ñ½È¹¥¹¹•É!Q50¤ìÉ½½Ð¹ÅÕ•ÉåM•±•Ñ½È¡m‘…Ñ„µÑ½½±Ñ¥Àµ‰½‘äôˆ‘í‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…ÁÁ±åQ½½±Ñ¥Áô‰u€¤¹Ù…±Õ”€ô€œœìô¤ìô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ¥µ…”µÕÁ±½…‘tœ¤¹™½É…  ¡¥¹ÁÕÐ¤€ôø¥¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¡…¹”œ°€ ¤€ôøÕÁ±½…‘%µ…”¡¥¹ÁÕÐ¤¹…Ñ ¡Í¡½ÝÕÑ¡½ÉÉÉ½È¤¤¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸ÕÁ±½…‘%µ…”¡¥¹ÁÕÐ¤ì½¹ÍÐ™¥±”€ô¥¹ÁÕÐ¹™¥±•Ìü¹lÁtì¥˜€ …™¥±”¤É•ÑÕÉ¸ì¥˜€¡™¥±”¹Í¥é”€ø€ÄÀ€¨€ÄÀÈÐ€¨€ÄÀÈÐ¤Ñ¡É½Ü¹•ÜÉÉ½È %µ…•ÌµÕÍÐ‰”€ÄÀ5½ÈÍµ…±±•È¸œ¤ì½¹ÍÐ‰åÑ•Ì€ô¹•ÜU¥¹ÐáÉÉ…ä¡…Ý…¥Ð™¥±”¹…ÉÉ…å	Õ™™•È ¤¤ì±•Ð‰¥¹…Éä€ô€œœì‰åÑ•Ì¹™½É…  ¡‰åÑ”¤€ôøì‰¥¹…Éä€¬ôMÑÉ¥¹œ¹™É½µ¡…É½‘”¡‰åÑ”¤ìô¤ì½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥Ð…Á¤ œ½…Á¤½…ÕÑ¡½È½…ÍÍ•ÑÌœ°ìµ•Ñ¡½è€A=MPœ°¡•…‘•ÉÌèì€½¹Ñ•¹ÐµQåÁ”œè€…ÁÁ±¥…Ñ¥½¸½©Í½¸œô°‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡ì¹…µ”è™¥±”¹¹…µ”°ÑåÁ”è™¥±”¹ÑåÁ”°‘…Ñ„è‰Ñ½„¡‰¥¹…Éä¤ô¤ô¤ì•ÑÕÑ¡½É	±½¬¡¥¹ÁÕÐ¹‘…Ñ…Í•Ð¹¥µ…•UÁ±½…¤¹ÍÉŒ€ôÉ•ÍÕ±Ð¹ÍÉŒìÉ•¹‘•È ¤ìô)™Õ¹Ñ¥½¸Í¡½ÝÕÑ¡½ÉÉÉ½È¡•ÉÉ½È¤ìÍÑ…Ñ”¹…ÕÑ¡½È¹¹½Ñ¥”€ô•ÉÉ½È¹µ•ÍÍ…”ìÉ•¹‘•È ¤ìô()™Õ¹Ñ¥½¸É•¹‘•È ¤ì(€¥˜€ …ÍÑ…Ñ”¹½ÕÉÍ”¤ìÉ½½Ð¹¥¹¹•É!Q50€ô€œñµ…¥¸±…ÍÌô‰±½…‘¥¹œˆù1½…‘¥¹œ…±”1½¥Œ¸¸¸ð½µ…¥¸øœìÉ•ÑÕÉ¸ìô(€¥˜€¡ÍÑ…Ñ”¹Ù¥•Ü¹­¥¹€ôôô€±…¹‘¥¹œœ¤ìÍ¡•±°¡±…¹‘¥¹œ ¤¤ìÉ½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ¡…ÁÑ•Étœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøÍ•ÑY¥•Ü¡ì­¥¹è€¡…ÁÑ•Èœ°¡…ÁÑ•É%è9Õµ‰•È¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹¡…ÁÑ•È¤ô¤¤¤ìÉ•ÑÕÉ¸ìô(€¥˜€¡ÍÑ…Ñ”¹Ù¥•Ü¹­¥¹€ôôô€¡…ÁÑ•Èœ¤ìÍ¡•±°¡¡…ÁÑ•É5•¹Ô¡ÍÑ…Ñ”¹Ù¥•Ü¹¡…ÁÑ•É%¤¤ìÉ½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ±•ÍÍ½¹tœ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøÍ•ÑY¥•Ü¡ì­¥¹è€±•ÍÍ½¸œ°±•ÍÍ½¹%è‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹±•ÍÍ½¸ô¤¤¤ìÉ•ÑÕÉ¸ìô(€¥˜€¡ÍÑ…Ñ”¹Ù¥•Ü¹­¥¹€ôôô€±•ÍÍ½¸œ¤ì½¹ÍÐ‘½Œ€ôÍÑ…Ñ”¹±•ÍÍ½¹ÍmÍÑ…Ñ”¹Ù¥•Ü¹±•ÍÍ½¹%‘tìÍ¡•±°¡‘½Œ€üÉ•¹‘•É1•ÍÍ½¸¡‘½Œ¤€è€œñµ…¥¸±…ÍÌô‰±½…‘¥¹œˆù1½…‘¥¹œ±•ÍÍ½¸¸¸¸ð½µ…¥¸øœ¤ì¥˜€¡‘½Œ¤‰¥¹‘1•ÍÍ½¸¡‘½Œ¤ìÉ•ÑÕÉ¸ìô(€¥˜€¡ÍÑ…Ñ”¹Ù¥•Ü¹­¥¹€ôôô€‘…Í¡‰½…Éœ¤ìÍ¡•±°¡‘…Í¡‰½…É ¤¤ìÉ•ÑÕÉ¸ìô(€¥˜€¡ÍÑ…Ñ”¹Ù¥•Ü¹­¥¹€ôôô€…ÕÑ¡½Èœ¤ìÍ¡•±°¡ÍÑ…Ñ”¹…ÕÑ¡½È¹Í¥¹•‘%¸€ü…ÕÑ¡½É]½É­ÍÁ…” ¤€è…ÕÑ¡½É1½¥¸ ¤¤ì‰¥¹‘ÕÑ¡½È ¤ìô)ô()Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È Á½ÁÍÑ…Ñ”œ°€ ¤€ôøìÍÑ…Ñ”¹Ù¥•Ü€ôÙ¥•ÝÉ½µ!…Í  ¤ì•¹ÍÕÉ•Y¥•Ý…Ñ„ ¤¹Ñ¡•¸¡É•¹‘•È¤ìô¤ì)•¹ÍÕÉ•Y¥•Ý…Ñ„ ¤¹Ñ¡•¸¡É•¹‘•È¤¹…Ñ  ¡•ÉÉ½È¤€ôøìÉ½½Ð¹¥¹¹•É!Q50€ô€ñµ…¥¸±…ÍÌô‰±½…‘¥¹œˆø‘í•Í…Á•!Ñµ°¡•ÉÉ½È¹µ•ÍÍ…”¥ôMÑ…ÉÐÑ¡”±½…°Í•ÉÙ•ÈÝ¥Ñ ÍÉ¥ÁÑÌ½ÍÑ…ÉÐµÍ•ÉÙ•È¹µ¸ð½µ…¥¸ù€ìô¤ì(