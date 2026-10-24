/** タブが隠れた・ページを離れたときに cb を呼ぶ（VO-04）。 */
export function watchPageHide(
  doc: Pick<Document, 'addEventListener' | 'visibilityState'>,
  win: Pick<Window, 'addEventListener'>,
  cb: () => void,
): void {
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') cb();
  });
  win.addEventListener('pagehide', cb);
}
