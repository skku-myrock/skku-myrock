// Legacy single-image endpoint. The batch handler also accepts form field "image"
// and enforces staff permissions when writing site/ assets.
export {onRequestPost} from './batch.js';
