import React from 'react'
// @ts-expect-error -- JS module in canvas-rce
import RCE from '@instructure/canvas-rce/es/rce/RCE'

export default function Readonly() {
  return (
    <div style={{padding: 16}}>
      <RCE
        language="en"
        textareaId="rce-readonly"
        defaultContent="<p>This content is read-only.</p>"
        readOnly={true}
        editorOptions={{height: 350}}
        highContrastCSS={[]}
      />
    </div>
  )
}
