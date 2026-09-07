# Publishing notes

Each note has a raw Markdown file and a generated outline Markdown file. The raw file is the source of truth. The outline must contain the same information, although its headings may organize the information differently.

## Add or update a note

1. Create a directory under `content/notes` using the note slug.
2. Add `note.md` with metadata for `title`, `date`, `status`, `summary`, and `slug`.
3. Add `outline.md` with the generated outline and a `source_digest` value for the complete raw file.
4. Run `npm run build` to update the static HTML.
5. Run `npm test` before opening the pull request.

Use `published` or `draft` for the status. The homepage lists all notes from newest to oldest and labels drafts.

The authoring agent should update only the outline sections affected by a raw content change when possible. It must then update `source_digest` before publishing.

## Check generated files

Run `npm run build:check` when you want to confirm that the committed HTML matches the Markdown sources without changing any files.
