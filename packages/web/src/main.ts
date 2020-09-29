const url = new URL(location.href)
const elIFrame = document.querySelector('iframe') as HTMLIFrameElement
elIFrame.src = `/file/${url.searchParams.get('file') || 'index.md'}?format=pdf`
