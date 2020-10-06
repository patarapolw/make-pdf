import { PDFViewer } from '@react-pdf/renderer';
import React from 'react';

import MyDocument from './pdf';

function App() {
  return (
    <PDFViewer>
      <MyDocument />
    </PDFViewer>
  );
}

export default App;
