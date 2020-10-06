import '../styles.css'

import React from 'react'
import dynamic from 'next/dynamic';

const Pdf = dynamic(() => import('../components/Pdf'), { ssr: false })

const App = ({ Component, pageProps }) => (
  <Pdf>
    <Component {...pageProps} />
  </Pdf>
)

export default App
