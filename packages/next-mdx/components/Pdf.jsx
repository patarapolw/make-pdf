import { Document, PDFViewer, Page, StyleSheet, Text } from '@react-pdf/renderer';

import { MDXProvider } from '@mdx-js/react';
import React from 'react';

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: '2cm'
  },
  verticalCenter: {
    alignItems: 'center',
    justifyContent: 'center'
  }
});

const mdComponents = {
  h1: props => <Text style={{color: 'tomato', display: 'flex'}} {...props} />,
  p: props => <Text style={{display: 'flex'}} {...props} />
}

// Create Document Component
const Pdf = ({ children }) => (
  <PDFViewer>
    <Document>
      <Page size="A4" style={[styles.page, styles.verticalCenter]}>
        <Text>Section #1</Text>
      </Page>
      <Page size="A4" style={styles.page}>
        <MDXProvider components={mdComponents}>
          {children}
        </MDXProvider>
      </Page>
    </Document>
  </PDFViewer>
);

export default Pdf
