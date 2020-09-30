import domino from 'domino'

const doc = domino.createDocument(/* html */`<body>
        <div class="inner"></div>
      </body>`, true)

console.info(doc.body.appendChild)
