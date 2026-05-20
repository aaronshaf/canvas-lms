import React, {useEffect} from 'react'
// @ts-expect-error -- JS module in canvas-rce
import RCE from '@instructure/canvas-rce/es/rce/RCE'

export default function RTL() {
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.setAttribute('lang', 'ar')
    return () => {
      document.documentElement.setAttribute('dir', 'ltr')
      document.documentElement.setAttribute('lang', 'en')
    }
  }, [])

  return (
    <div dir="rtl" style={{padding: 16}}>
      <RCE
        language="ar"
        textareaId="rce-rtl"
        defaultContent=""
        readOnly={false}
        editorOptions={{height: 350}}
        highContrastCSS={[]}
      />
    </div>
  )
}
