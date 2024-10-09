const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const app = express();
const PORT = 5000;
const cors = require('cors'); // Import cors

// Define Schema
const transactionSchema = new mongoose.Schema({
  id: Number,
  title: String,
  description: String,
  price: Number,
  category: String,
  dateOfSale: Date,
  sold: Boolean,
});




// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/transactions', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

// Middleware
app.use(cors());
app.use(express.json());

// Model Declaration
const Transaction = mongoose.model('Transaction', transactionSchema);

// API to Seed Data
app.get('/api/seed', async (req, res) => {
  try {
    // Fetch data from the external API
    const { data } = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    
    // Clear the collection (optional, if you want to reset the database before seeding)
    await Transaction.deleteMany({});

    // Insert fetched data into MongoDB
    await Transaction.insertMany(data);

    res.status(200).send({ message: 'Database seeded successfully!' });
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).send({ message: 'Error seeding database' });
  }
});

// API for Listing Transactions with Pagination
app.get('/api/transactions', async (req, res) => {
  const { search, page = 1, perPage = 10, month } = req.query;

  // Create start and end dates for the month
  const startDate = new Date(`2023-${month}-01T00:00:00Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1); // Move to the next month

  const query = { dateOfSale: { $gte: startDate, $lt: endDate } };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      // Check if the search is a number to match against the price field
      ...(isNaN(search) ? [] : [{ price: parseFloat(search) }])
    ];
  }

  try {
    const transactions = await Transaction.find(query)
      .skip((page - 1) * perPage)
      .limit(parseInt(perPage));

    const total = await Transaction.countDocuments(query);
    res.json({ transactions, total });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).send('Error fetching transactions');
  }
});




// API for Statistics
app.get('/api/statistics', async (req, res) => {
  const { month } = req.query;

  // Create start and end dates for the month
  const startDate = new Date(`2023-${month}-01T00:00:00Z`); // Adjust year as necessary
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1); // Move to the next month

  try {
    const sales = await Transaction.aggregate([
      { $match: { dateOfSale: { $gte: startDate, $lt: endDate } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $cond: ['$sold', '$price', 0] } },
          totalSold: { $sum: { $cond: ['$sold', 1, 0] } },
          totalNotSold: { $sum: { $cond: ['$sold', 0, 1] } },
        },
      },
    ]);

    res.json(sales[0] || { totalSales: 0, totalSold: 0, totalNotSold: 0 });
  } catch (error) {
    res.status(500).send('Error fetching statistics');
  }
});

// API for Bar Chart Data
app.get('/api/bar-chart', async (req, res) => {
  const { month } = req.query;

  // Create start and end dates for the month
  const startDate = new Date(`2023-${month}-01T00:00:00Z`); // Adjust year as necessary
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1); // Move to the next month

  try {
    const priceRanges = await Transaction.aggregate([
      { $match: { dateOfSale: { $gte: startDate, $lt: endDate } } },
      {
        $bucket: {
          groupBy: '$price',
          boundaries: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, Infinity],
          default: '901-above',
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    res.json(priceRanges);
  } catch (error) {
    res.status(500).send('Error fetching bar chart data');
  }
});

// API for Pie Chart Data
app.get('/api/pie-chart', async (req, res) => {
  const { month } = req.query;

  // Create start and end dates for the month
  const startDate = new Date(`2023-${month}-01T00:00:00Z`); // Adjust year as necessary
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1); // Move to the next month

  try {
    const categoryCounts = await Transaction.aggregate([
      { $match: { dateOfSale: { $gte: startDate, $lt: endDate } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    res.json(categoryCounts);
  } catch (error) {
    res.status(500).send('Error fetching pie chart data');
  }
});
// Combined API
app.get('/api/combined', async (req, res) => {
  const { month } = req.query;

  const [transactions, statistics, barChart, pieChart] = await Promise.all([
    Transaction.find({ dateOfSale: { $regex: `^\\d{4}-${month}-\\d{2}` } }),
    Transaction.aggregate([
      { $match: { dateOfSale: { $regex: `^\\d{4}-${month}-\\d{2}` } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $cond: ['$sold', '$price', 0] } },
          totalSold: { $sum: { $cond: ['$sold', 1, 0] } },
          totalNotSold: { $sum: { $cond: ['$sold', 0, 1] } },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { dateOfSale: { $regex: `^\\d{4}-${month}-\\d{2}` } } },
      {
        $bucket: {
          groupBy: '$price',
          boundaries: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, Infinity],
          default: '901-above',
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { dateOfSale: { $regex: `^\\d{4}-${month}-\\d{2}` } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);

  res.json({ transactions, statistics, barChart, pieChart });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

