const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');
const dotenv = require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'https://mughal-real-estate.web.app'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is running');
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1rjt0hg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send('Unauthorized Request');
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send('Unauthorized Request');
        }
        req.decoded = decoded;
        next();
    });
};

const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const user = await userCollection.findOne({ email });
    if (user?.role !== 'admin') {
        return res.status(403).send('Unauthorized Request');
    }
    next();
};

const verifyAgent = async (req, res, next) => {
    const email = req.decoded.email;
    const user = await userCollection.findOne({ email });
    if (user?.role !== 'agent') {
        return res.status(403).send('Unauthorized Request');
    }
    next();
};

async function run() {
    try {
        await client.connect();
        global.userCollection = client.db("mughalDB").collection("Users");
        const propertyCollection = client.db("mughalDB").collection("Properties");
        const wishlistCollection = client.db("mughalDB").collection("Wishlist");
        const reviewCollection = client.db("mughalDB").collection("Reviews");
        const offerCollection = client.db("mughalDB").collection("Offers");
        const paymentCollection = client.db("mughalDB").collection("Payments");

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
            res.send({ token });
        });

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.json(users);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send('Unauthorized Request');
            }
            const user = await userCollection.findOne({ email });
            res.send({ admin: user?.role === 'admin' });
        });

        app.get('/users/agent/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send('Unauthorized Request');
            }
            const user = await userCollection.findOne({ email });
            res.send({ agent: user?.role === 'agent' });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const existingUser = await userCollection.findOne({ email: user.email });
            if (existingUser) {
                return res.send({ message: 'User already exists' });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await userCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role: 'admin' } });
            res.send(result);
        });

        app.patch('/users/agent/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await userCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role: 'agent' } });
            res.send(result);
        });

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        app.get('/properties', async (req, res) => {
            const properties = await propertyCollection.find().toArray();
            res.json(properties);
        });

        app.get('/properties/:id', async (req, res) => {
            const id = req.params.id;
            const property = await propertyCollection.findOne({ _id: new ObjectId(id) });
            res.json(property);
        });

        app.get('/properties/agent/:email', verifyToken, verifyAgent, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send('Unauthorized Request');
            }
            const properties = await propertyCollection.find({ agentEmail: email }).toArray();
            res.json(properties);
        });

        app.post('/properties', verifyToken, verifyAgent, async (req, res) => {
            const property = req.body;
            const result = await propertyCollection.insertOne(property);
            res.send(result);
        });

        app.put('/properties/:id', verifyToken, verifyAgent, async (req, res) => {
            const id = req.params.id;
            const property = req.body;
            const result = await propertyCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { propertyTitle: property.propertyTitle, location: property.location, price: property.price, adminName: property.adminName, adminEmail: property.adminEmail, status: property.status } }
            );
            res.send(result);
        });

        app.patch('/properties/:id/status', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            const result = await propertyCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
            res.send(result);
        });

        app.patch('/properties/:id', verifyToken, verifyAgent, async (req, res) => {
            const id = req.params.id;
            const property = req.body;
            const result = await propertyCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: property }
            );
            res.send(result);
        });

        app.delete('/properties/:id', verifyToken, verifyAgent, async (req, res) => {
            const id = req.params.id;
            const result = await propertyCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // Wishlist API

        app.get('/wishlist/user/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send('Unauthorized Request');
            }
            const wishlist = await wishlistCollection.find({ email }).toArray();
            res.json(wishlist);
        });

        app.post('/wishlist', verifyToken, async (req, res) => {
            const wishlist = req.body;
            const result = await wishlistCollection.insertOne(wishlist);
            res.send(result);
        });

        app.delete('/wishlist/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            try {
                const result = await wishlistCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to delete wishlist item' });
            }
        });


        // Offered Properties API

        app.get('/offers/user/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const offers = await offerCollection.find({ email }).toArray();
            res.json(offers);
        });

        app.get('/offers/agent/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            try {
                const offers = await offerCollection.find({ agentEmail: email }).toArray();
                res.json(offers);
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch offers' });
            }
        });

        app.post('/offers', verifyToken, async (req, res) => {
            const offer = req.body;
            try {
                const result = await offerCollection.insertOne(offer);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to add offer' });
            }
        });

        app.patch('/offers/:id', verifyToken, verifyAgent, async (req, res) => {
            const id = req.params.id;
            const { status } = req.body; // Ensure this line is present to extract the status from the request body

            if (!status) {
                return res.status(400).send({ message: 'Status is required' });
            }

            const result = await offerCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );

            if (result.modifiedCount === 1) {
                res.send({ message: 'Status updated successfully' });
            } else {
                res.status(404).send({ message: 'Offer not found or status unchanged' });
            }
        });

        app.delete('/offers/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            try {
                const result = await offerCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to delete offer' });
            }
        });

        // Reviews API

        app.get('/reviews', async (req, res) => {
            const reviews = await reviewCollection.find().toArray();
            res.json(reviews);
        });

        app.get('/reviews/:propertyId', async (req, res) => {
            const propertyId = req.params.propertyId;
            console.log('Fetching reviews for propertyId:', propertyId);
            const reviews = await reviewCollection.find({ propertyId }).toArray();
            console.log('Fetched reviews:', reviews);
            res.json(reviews);
        });

        app.get('/reviews/user/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send('Unauthorized Request');
            }
            const reviews = await reviewCollection.find({ email }).toArray();
            res.json(reviews);
        });

        app.post('/reviews', verifyToken, async (req, res) => {
            console.log('Received review:', req.body);
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            console.log('Insert result:', result);
            res.send(result);
        });

        app.delete('/reviews/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
            if (result.deletedCount === 1) {
                res.send({ success: true });
            } else {
                res.status(404).send({ success: false, message: 'Review not found' });
            }
        });

        // Payment Intent

        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log('Amount:', amount);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'bdt',
                payment_method_types: ['card'],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // Payment API

        app.get('/payments/user/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email };
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send('Unauthorized Request');
            }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/payments', async (req, res) => {
            const id = req.params.id;
            const result = await paymentCollection.find().toArray();
            res.send(result);
        });


        app.post('/payments', verifyToken, async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            res.send(paymentResult);
        });

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (error) {
        console.error("An error occurred:", error);
    } finally {
        // Ensure the client will close when you finish/error
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
