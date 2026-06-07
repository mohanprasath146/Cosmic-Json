import React, { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Copy, X, Maximize2, Minimize2, Check, Edit } from 'lucide-react'
import { loadNotes, saveNotes } from '../utils/storage'
import type { Note } from '../types'
import '../index.css'

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export default function NotesTab() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes())
  const [editing, setEditing] = useState<Note | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const colorInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  const createNew = () => {
    const now = Date.now()
    const n: Note = { id: uid(), title: 'Untitled', content: '', color: '#8cc4ff', createdAt: now, updatedAt: now }
    setNotes((s) => [n, ...s])
    setEditing(n)
    setDialogOpen(true)
  }

  const updateNote = (next: Note) => {
    setNotes((s) => s.map((n) => (n.id === next.id ? next : n)))
  }

  const removeNote = (id: string) => {
    setNotes((s) => s.filter((n) => n.id !== id))
  }

  const openColorPicker = (note: Note) => {
    setEditing(note)
    if (colorInputRef.current) {
      try {
        colorInputRef.current.value = note.color || '#000000'
        colorInputRef.current.dataset.targetId = note.id
      } catch {
        // ignore
      }
    }
    setTimeout(() => colorInputRef.current?.click(), 0)
  }

  const onColorChange = (id: string | null, color: string) => {
    if (!id) return
    const now = Date.now()
    setNotes((s) => s.map((n) => (n.id === id ? { ...n, color, updatedAt: now } : n)))
    setEditing((cur) => (cur && cur.id === id ? { ...cur, color, updatedAt: now } : cur))
  }

  const copyContent = (text: string) => {
    void navigator.clipboard.writeText(text)
  }

  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerId, setViewerId] = useState<string | null>(null)

  const openViewer = (id: string) => {
    setViewerId(id)
    setViewerOpen(true)
  }

  return (
    <div className="content-panel panel notes-panel">
      {/* Animated background elements */}
      <div className="ambient-glow" />
      <div className="dot-pattern" />

      <div className="notes-container">
        <div className="notes-header">
          <div className="notes-logo">NOTES</div>
          <div className="header-stats">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</div>
        </div>

        {/* Masonry Grid */}
        <div className="notes-grid">
          {notes.map((n) => (
            <div
              key={n.id}
              className="note-card"
              style={{ '--accent': n.color, '--dot-color': n.color } as React.CSSProperties}
              onClick={() => openViewer(n.id)}
            >
              <div className="note-card-header">
                <button
                  className="note-color-dot"
                  title="Change color"
                  style={{ background: n.color }}
                  onClick={(e) => { e.stopPropagation(); openColorPicker(n) }}
                />
                <div className="note-title">
                  {n.title}
                </div>
              </div>
              <div className="note-preview">
                {n.content || <span className="note-empty">— empty —</span>}
              </div>
              <div className="note-divider" />
              <div className="note-meta">
                <div className="note-date">
                  {new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
                <div className="note-actions">
                  <button
                    className="icon-mini"
                    title="Copy"
                    onClick={(e) => { e.stopPropagation(); copyContent(n.content) }}
                  >
                    📋
                  </button>
                  <button
                    className="icon-mini"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); removeNote(n.id) }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hidden color picker input (uses data-target-id to avoid state race) */}
        <input
          ref={colorInputRef}
          type="color"
          data-target-id={''}
          aria-hidden
          style={{ position: 'absolute', left: -9999, top: -9999 }}
          onChange={(e) => {
            const id = (e.currentTarget as HTMLInputElement).dataset.targetId ?? editing?.id ?? null
            onColorChange(id, (e.currentTarget as HTMLInputElement).value)
          }}
        />

        {/* Empty State */}
        {!notes.length && (
          <div className="empty-state">
            <div className="empty-symbol">◌</div>
            <h3>Start capturing ideas.</h3>
            <p>Your notes will appear here like floating thoughts.</p>
            <button className="empty-primary-btn" onClick={createNew}>Create your first note</button>
          </div>
        )}
      </div>

        {/* Floating Action Button */}
      <button className="fab" onClick={createNew} aria-label="New note">
        +
      </button>

      {/* Side Sheet Editor (replaces dialog) */}
      <Dialog.Root open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditing(null); setIsFullscreen(false) } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="sheet-overlay" />
          <Dialog.Content
            className={`side-sheet ${isFullscreen ? 'fullscreen-sheet' : ''}`}
            style={{ '--sheet-accent': editing?.color || '#8cc4ff' } as React.CSSProperties}
          >
            <Dialog.Title className="sr-only">Edit note</Dialog.Title>
            <Dialog.Description className="sr-only">Editor for creating and updating notes</Dialog.Description>
              <div className="sheet-header">
              <input
                className="sheet-color"
                type="color"
                aria-label="Choose note color"
                value={editing?.color ?? '#8cc4ff'}
                onChange={(e) => {
                  if (!editing) return
                  onColorChange(editing.id, e.currentTarget.value)
                }}
              />
              <input
                value={editing?.title ?? ''}
                onChange={(e) => editing && setEditing({ ...editing, title: e.target.value })}
                className="sheet-title-input"
                placeholder="Untitled"
                autoFocus
              />
              <div className="sheet-header-actions">
                <button
                  className="sheet-icon-btn"
                  title="Copy"
                  onClick={() => { if (editing) void navigator.clipboard.writeText(editing.content) }}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="sheet-icon-btn"
                  title="Save"
                  onClick={() => {
                    if (!editing) return
                    updateNote({ ...editing, updatedAt: Date.now() })
                    setDialogOpen(false)
                    setIsFullscreen(false)
                  }}
                >
                  <Check size={16} />
                </button>
                <button
                  className="sheet-icon-btn"
                  onClick={() => setIsFullscreen((s) => !s)}
                  title={isFullscreen ? 'Exit full view' : 'Enter full view'}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <Dialog.Close asChild>
                  <button className="sheet-icon-btn" aria-label="Close">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="sheet-body">
              <textarea
                value={editing?.content ?? ''}
                onChange={(e) => editing && setEditing({ ...editing, content: e.target.value })}
                className="sheet-textarea"
                placeholder="Write your note here..."
              />
            </div>

            <div className="sheet-footer">
              <div className="sheet-footer-left">
                <div className="note-timestamp">
                  {editing ? new Date(editing.updatedAt).toLocaleString() : ''}
                </div>
              </div>
              <div className="sheet-footer-right">
                {/* Actions moved to header for a cleaner UX */}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Viewer modal (centered) */}
      <Dialog.Root open={viewerOpen} onOpenChange={(v) => { setViewerOpen(v); if (!v) setViewerId(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="viewer-overlay" />
          <Dialog.Content className="viewer-modal">
            <div className="viewer-actions">
              <button
                className="sheet-icon-btn"
                title="Edit"
                onClick={() => {
                  const note = notes.find((x) => x.id === viewerId)
                  if (!note) return
                  setEditing(note)
                  setDialogOpen(true)
                  setViewerOpen(false)
                }}
              >
                <Edit size={16} />
              </button>
              <button
                className="sheet-icon-btn"
                title="Copy"
                onClick={() => {
                  const note = notes.find((x) => x.id === viewerId)
                  if (!note) return
                  void navigator.clipboard.writeText(`${note.title}\n\n${note.content}`)
                }}
              >
                <Copy size={16} />
              </button>
              <Dialog.Close asChild>
                <button className="sheet-icon-btn" title="Close">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Title className="viewer-title">{viewerId ? (notes.find((x) => x.id === viewerId)?.title ?? '') : ''}</Dialog.Title>
            <Dialog.Description className="viewer-desc">
              {viewerId ? (notes.find((x) => x.id === viewerId)?.content ?? '') : ''}
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}