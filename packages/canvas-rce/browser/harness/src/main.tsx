import React from 'react'
import ReactDOM from 'react-dom/client'
import {BrowserRouter, Route, Routes} from 'react-router-dom'
import Basic from './scenarios/Basic'
import Readonly from './scenarios/Readonly'
import WithDefaultContent from './scenarios/WithDefaultContent'
import RTL from './scenarios/RTL'
import WithCallbacks from './scenarios/WithCallbacks'
import MultipleEditors from './scenarios/MultipleEditors'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/scenarios/basic" element={<Basic />} />
      <Route path="/scenarios/readonly" element={<Readonly />} />
      <Route path="/scenarios/with-default-content" element={<WithDefaultContent />} />
      <Route path="/scenarios/rtl" element={<RTL />} />
      <Route path="/scenarios/with-callbacks" element={<WithCallbacks />} />
      <Route path="/scenarios/multiple-editors" element={<MultipleEditors />} />
      <Route
        path="/"
        element={
          <div style={{fontFamily: 'sans-serif', padding: '2rem'}}>
            <h2 style={{marginBottom: '1rem'}}>canvas-rce harness</h2>
            <ul>
              {[
                ['basic', 'Basic'],
                ['readonly', 'Readonly'],
                ['with-default-content', 'With Default Content'],
                ['rtl', 'RTL'],
                ['with-callbacks', 'With Callbacks'],
                ['multiple-editors', 'Multiple Editors'],
              ].map(([slug, label]) => (
                <li key={slug} style={{marginBottom: '0.5rem'}}>
                  <a href={`/scenarios/${slug}`}>{label}</a>
                </li>
              ))}
            </ul>
          </div>
        }
      />
    </Routes>
  </BrowserRouter>,
)
