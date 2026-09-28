// Lesson video: TTS-only pronunciation of chess notation for the Czech SAPI voice.
// Moved to src/lessons/pronounce.ts (Phase: sova čte nahlas) so the video pipeline, the
// lesson-audio pipeline (scripts/lesson-audio/build.mjs) and the app (src/lessons/voice.ts)
// share one normalisation — a text hashes to the same file everywhere. This file is now a
// thin re-export kept at its original path so storyboard.mjs's import is unaffected.
export { LETTER, DIGIT, square, ordinalF, pronounce, spokenOptions } from '../../src/lessons/pronounce.ts';
