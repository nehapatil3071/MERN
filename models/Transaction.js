const mongoose = require('mongoose');

// Define the schema for transactions
const transactionSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  title: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: { type: String, index: true },
  dateOfSale: { type: Date, required: true },
  sold: { type: Boolean, default: false },
});

// Export the model
const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
