import { useEffect, useRef } from 'react'
import type { editor } from 'monaco-editor'

type MonacoEditor = editor.IStandaloneCodeEditor

export function useSyncScroll(leftEditor: MonacoEditor | null, rightEditor: MonacoEditor | null): void {
  const isSyncing = useRef(false)

  useEffect(() => {
    if (!leftEditor || !rightEditor) {
      return
    }

    const syncFrom = (source: MonacoEditor, target: MonacoEditor) =>
      source.onDidScrollChange((event) => {
        if (isSyncing.current || (!event.scrollTopChanged && !event.scrollLeftChanged)) {
          return
        }

        isSyncing.current = true
        target.setScrollTop(source.getScrollTop())
        target.setScrollLeft(source.getScrollLeft())
        queueMicrotask(() => {
          isSyncing.current = false
        })
      })

    const leftDispose = syncFrom(leftEditor, rightEditor)
    const rightDispose = syncFrom(rightEditor, leftEditor)

    return () => {
      leftDispose.dispose()
      rightDispose.dispose()
    }
  }, [leftEditor, rightEditor])
}
