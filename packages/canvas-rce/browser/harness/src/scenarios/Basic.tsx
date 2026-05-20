import React, {useRef} from 'react'
// @ts-expect-error -- JS module in canvas-rce
import RCE from '@instructure/canvas-rce/es/rce/RCE'
import * as fakeSource from '@instructure/canvas-rce/es/rcs/fake'

const rcsProps = {
  canUploadFiles: true,
  contextId: '1',
  contextType: 'course',
  containingContext: {contextType: 'course', contextId: '1', userId: '1'},
  filesTabDisabled: false,
  host: 'http://who.cares',
  jwt: 'fake-jwt',
  refreshToken: () => Promise.resolve({jwt: 'fake-jwt'}),
  source: fakeSource,
  themeUrl: '',
}

export default function Basic() {
  const rceRef = useRef<any>(null)
  return (
    <div style={{padding: 16}}>
      <RCE
        ref={rceRef}
        language="en"
        textareaId="rce-basic"
        defaultContent=""
        readOnly={false}
        editorOptions={{height: 350}}
        highContrastCSS={[]}
        rcsProps={rcsProps}
      />
    </div>
  )
}
