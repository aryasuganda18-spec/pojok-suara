import { EventEmitter } from 'node:events';

/** Penghubung antar layanan tanpa saling meng-import (menghindari ketergantungan melingkar). */
export const bus = new EventEmitter();
bus.setMaxListeners(30);

export const emitTaxonomyChange = () => bus.emit('taxonomy');
