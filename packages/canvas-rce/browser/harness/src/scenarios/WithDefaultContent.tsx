import React from 'react'
// @ts-expect-error -- JS module in canvas-rce
import RCE from '@instructure/canvas-rce/es/rce/RCE'

const DEFAULT_HTML = '<p>Pre-loaded content from <strong>defaultContent</strong> prop.</p>'

export default function WithDefaultContent() {
  return (
    <div style={{padding: 16}}>
      <RCE
        language="en"
        textareaId="rce-with-default"
        defaultContent={DEFAULT_HTML}
        readOnly={false}
        editorOptions={{height: 350}}
        highContrastCSS={[]}
      />
    </div>
  )
}
