import domino from 'domino'

const doc = domino.createDocument(/* html */`<body>
        <div class="inner"></div>
      </body>`, true)

console.log(doc.body.appendChild)
