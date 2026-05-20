import React, {useRef, useState} from 'react'
// @ts-expect-error -- JS module in canvas-rce
import RCE from '@instructure/canvas-rce/es/rce/RCE'

export default function WithCallbacks() {
  const rceRef = useRef<any>(null)
  const [initContent, setInitContent] = useState('')
  const [changeLog, setChangeLog] = useState<string[]>([])

  return (
    <div style={{padding: 16}}>
      <RCE
        ref={rceRef}
        language="en"
        textareaId="rce-callbacks"
        defaultContent=""
        readOnly={false}
        editorOptions={{height: 300}}
        highContrastCSS={[]}
        onInitted={(editor: any) => {
          setInitContent(editor.getContent())
        }}
        onContentChange={(value: string) => {
          setChangeLog(prev => [...prev, value])
        }}
      />
      <div data-testid="init-content" style={{display: 'none'}}>
        {initContent}
      </div>
      <div data-testid="change-count" style={{display: 'none'}}>
        {changeLog.length}
      </div>
      <div data-testid="last-change" style={{display: 'none'}}>
        {changeLog[changeLog.length - 1] ?? ''}
      </div>
    </div>
  )
}
