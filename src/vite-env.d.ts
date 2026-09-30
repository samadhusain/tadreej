/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where Sufi's and Noreen's ayah files live: an absolute URL, or a
   *  same-origin path such as /tadreej-audio. Unset hides both reciters. */
  readonly VITE_EXTRA_AUDIO_BASE?: string;
}
