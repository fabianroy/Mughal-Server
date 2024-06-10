const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');
const env = require('dotenv').config();

// Middleware

app.use(cors({
    origin: ['http://localhost:5173']
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});