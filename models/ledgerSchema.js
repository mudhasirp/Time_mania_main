const mongoose = require('mongoose');
const { Schema } = mongoose;

const LedgerEntrySchema = new Schema({
  date: { type: Date, default: Date.now },
  description: { type: String },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  account: { type: String }, 
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 }
});

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);
