/**
 * おえかき（全年齢共通）の公開 API。
 * - 画面: DrawingScreen（#/draw, #/draw/<artId>）、GalleryScreen（#/gallery）
 * - 作品の zip（無圧縮）の読み書き: 記録全体のバックアップとの統合用（review-1 #16）
 * - 文書モデル: 学習連携（X-DL）で origin 付きの作品を作るとき用
 */
export { DrawingScreen } from './DrawingScreen';
export { GalleryScreen } from './GalleryScreen';
export { writeZip, readZip, crc32, ZipError, type ZipEntry } from './zip';
export {
  bundleToZip,
  zipToBundle,
  exportArtworksZip,
  importArtworksZip,
  ART_ZIP_FORMAT,
  MAX_ZIP_BYTES,
  type ArtBundle,
} from './artZip';
export { emptyDoc, parseDoc, type ArtDoc, type ArtOrigin, type ArtItem } from './model';
