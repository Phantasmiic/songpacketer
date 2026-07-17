# Packeter Feature Specification

Use this specification in your new workspace to ensure all core features are implemented correctly.

## 📄 PDF Preview Integration
- [x] **Live PDF Preview Sidebar & Modal**
  - [x] UI includes a side-by-side or modal PDF preview
  - [x] PDF generation is debounced to avoid backend overloading on rapid state changes
  - [x] The Object URL is memoized to prevent the `<iframe>` from flickering or reloading on unrelated component re-renders


### 1. Section Headers & Groupings [x]
Allow users to create groupings or sections inside the packet (e.g., "Sunday Morning Worship", "Midweek Retreat"). 

- **Frontend**: 
  - Add an "Add Section" modal to paste and assign multiple songs into a specific section.
  - Visually indent songs that belong to a section in the Review Step.
  - Render sections as colored, nested container cards to differentiate from standalone songs.
  - Provide an "Edit / Expand" toggle on song cards in the Review Step. When collapsed, cards display a compact summary (Song Number, Input Name, Match Status) to reduce vertical scrolling.
- **Backend**:
  - Support a generic `type: "section"` or `is_section` schema in the payload array alongside standard songs.
  - Update the PDF generator to render a bold block of text for the section title (without numbers). 
  - Allow checkboxes to show section headers in index and body.
  - Include a half-line space before section headers in the PDF index to separate groups clearly.
  - [ ] Gracefully handle empty sections and missing headers
  - [ ] Persist section title assignments and groupings accurately to the backend (to preserve progress and avoid losing your spot on page reload)

## 🖱️ Drag & Drop and Reordering
- [ ] **Refine Step Ordering**
  - [ ] Support drag-and-drop reordering of songs and sections in the Refine Step
  - [ ] Restrict drag interactions strictly to a dedicated drag handle to prevent accidental reordering when interacting with card contents
  - [ ] Persist all drag-and-drop ordering to the backend
- [ ] **Generate Step / Layout Syncing**
  - [ ] The PDF draw order must strictly match the UI representation
  - [ ] Include an explicit "Re-optimize Layout" button for generating new layouts
  - [ ] The UI song list should automatically reorder itself if the layout optimizer moves items
  - [ ] Manual reordering changes made in the Generate step should proactively sync back to the Refine step order
  - [ ] The layout optimizer must be constrained to shuffle songs strictly within their section boundaries (songs cannot cross into other sections)
  - [ ] UI song numbers should increment sequentially for songs, ignoring section headers in the count

## 📋 Clipboard & Export
- [ ] **Text-Based Song List Copy**
  - [ ] Provide a simple text-based copy action for the song list
  - [ ] The copied text must reflect the final PDF draw order (rather than the original entry order)

## 🎨 PDF Formatting & Options
- [ ] **Page Numbering Options**
  - [ ] Provide options to show or hide page numbers
  - [ ] Provide an input for a custom starting page number
- [ ] **Layout Options**
  - [ ] Provide a "Require one page per song" toggle to ensure that a single song is not split across a page break (preventing singers from having to flip a page mid-song). Note: This should still allow multiple short songs to seamlessly share the same page, as long as neither song is cut off.

## 💾 State & Data Management
- [ ] **Unsaved State Preservation**
  - [ ] Preserve unsaved packet state across page reloads (e.g., via local storage or cache)
- [ ] **Database Sync Prompt**
  - [ ] Display a prompt to sync the database if the local song count is 0

## 🛠️ Critical Implementation Details
- [ ] Ensure `capo` values are explicitly mapped to avoid falling back to undefined overrides
- [ ] Ensure correct `io.BytesIO` scoping when generating the PDF to prevent namespace errors
- [ ] Correctly parse the data array structure from the `listSongPackets` response
- [ ] Ensure active packet data is correctly cached and invalidated when needed
