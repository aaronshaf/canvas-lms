import React, {useRef} from 'react'
// @ts-expect-error -- JS module in canvas-rce
import RCE from '@instructure/canvas-rce/es/rce/RCE'
import * as fakeSource from '@instructure/canvas-rce/es/rcs/fake'

const rcsProps = {
  canUploadFiles: false,
  contextId: '1',
  contextType: 'course',
  containingContext: {contextType: 'course', contextId: '1', userId: '1'},
  filesTabDisabled: true,
  host: 'http://who.cares',
  jwt: 'fake-jwt',
  refreshToken: () => Promise.resolve({jwt: 'fake-jwt'}),
  source: fakeSource,
  themeUrl: '',
}

export default function MultipleEditors() {
  const ref1 = useRef<any>(null)
  const ref2 = useRef<any>(null)
  return (
    <div style={{padding: 16}}>
      <div data-testid="editor-1-container">
        <RCE
          ref={ref1}
          language="en"
          textareaId="rce-editor-1"
          defaultContent=""
          readOnly={false}
          editorOptions={{height: 250}}
          highContrastCSS={[]}
          rcsProps={rcsProps}
        />
      </div>
      <div data-testid="editor-2-container" style={{marginTop: 32}}>
        <RCE
          ref={ref2}
          language="en"
          textareaId="rce-editor-2"
          defaultContent=""
          readOnly={false}
          editorOptions={{height: 250}}
          highContrastCSS={[]}
          rcsProps={rcsProps}
        />
      </div>
    </div>
  )
}
