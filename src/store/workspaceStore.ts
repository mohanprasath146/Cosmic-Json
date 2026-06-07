import { create } from 'zustand'

interface HistoryState {
  undoStack: string[]
  redoStack: string[]
  sourceText: string
  setSourceText: (next: string, track?: boolean) => void
  replaceSourceText: (next: string) => void
  undo: () => void
  redo: () => void
  resetHistory: () => void
}

export const useWorkspaceStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  sourceText: '',
  setSourceText: (next, track = true) =>
    set((state) => {
      if (state.sourceText === next) {
        return state
      }

      if (!track) {
        return {
          ...state,
          sourceText: next,
        }
      }

      const undoStack = [...state.undoStack, state.sourceText].filter(Boolean)
      return {
        sourceText: next,
        undoStack: undoStack.slice(-100),
        redoStack: [],
      }
    }),
  replaceSourceText: (next) =>
    set(() => ({
      sourceText: next,
      undoStack: [],
      redoStack: [],
    })),
  undo: () => {
    const state = get()
    const previous = state.undoStack[state.undoStack.length - 1]
    if (previous === undefined) {
      return
    }

    set({
      sourceText: previous,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, state.sourceText].slice(-100),
    })
  },
  redo: () => {
    const state = get()
    const next = state.redoStack[state.redoStack.length - 1]
    if (next === undefined) {
      return
    }

    set({
      sourceText: next,
      undoStack: [...state.undoStack, state.sourceText].slice(-100),
      redoStack: state.redoStack.slice(0, -1),
    })
  },
  resetHistory: () =>
    set((state) => ({
      ...state,
      undoStack: [],
      redoStack: [],
    })),
}))
