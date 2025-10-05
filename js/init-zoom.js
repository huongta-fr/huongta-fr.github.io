window.addEventListener('load', function() {
  console.log('MediumZoom loaded:', typeof mediumZoom);
  if (typeof mediumZoom === 'function') {
    mediumZoom('.zoomable', {
      background: 'rgba(0,0,0,0.8)',
      margin: 20
    });
  } else {
    console.error('MediumZoom not found');
  }
});
