// Compatibility for older site-photo upload callers. Reuse the batch uploader's
// validation, staff authorization, and one-commit GitHub writing mechanism.
import {uploadImages} from './batch.js';

export const onRequestPost=context=>uploadImages(context,{legacySingle:true});
