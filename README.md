# Eagle Logic

Eagle Logic is a desktop-first interactive logic learning platform. This first build includes:

- A landing page with all 17 planned chapters.
- A Chapter 1 lesson menu.
- Project-backed published lessons with local progress saving.
- An owner-only block editor for rich text, tooltips, images, one-question quizzes, and future interactive placeholders.
- Draft preview and whole-lesson publishing.
- An Instructor/Admin dashboard reserved for future lesson-visibility and student-data controls.

## Run Locally

Open PowerShell in this folder and run:

```powershell
.\scripts\start-server.cmd
```

Then open:

```text
http://localhost:5173/
```

If port 5173 is already in use, the app may already be running. Refresh the browser, or start it on another port:

```powershell
.\scripts\start-server.cmd 5174
```

The app uses no package manager and no build step. Restart the local server after changing server code so the authoring API is updated.

## Author Lessons

Open the app and select **Authoring** in the top bar. The owner workspace uses a password stored as a hash in:

```text
config/authoring.json
```

Lessons are stored as versioned project files:

```text
content/lessons/
content/assets/
```

The server creates the initial lesson JSON files from the existing Markdown source the first time it starts. The original `.md` and `.docx` files remain unchanged as source material.

The owner workspace saves drafts separately from published lessons. Students only receive the published version. Instructor/Admin access is intentionally separate and does not provide authoring controls.

## Content Blocks

Each lesson has navigable tabs. Each tab has visible titled sections, and each section can contain ordered text, image, quiz, or interactive-placeholder blocks. Text supports headings, paragraphs, bold, italic, lists, links, quotes, and in-text tooltips.