// Wrapper worker served as a chrome-extension:// URL.
// As a chrome-extension URL worker (not blob), it can freely importScripts
// other chrome-extension:// files — bypassing MV3 blob worker restrictions.
importScripts(self.location.origin + '/libs/tesseract-worker.min.js');
