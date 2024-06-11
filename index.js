const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');
const env = require('dotenv').config();
const jwt = require('jsonwebtoken');

// Middleware

app.use(cors({
    origin: ['http://localhost:5173']
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is running');
});

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const verifyToken = (req, res, next) => {
    console.log('Inside verify Token', req.headers);
    if (!req.headers.authorization) {
        return res.status(401).send('Unauthorized Request');
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log('Token verification failed', err);
            return res.status(401).send('Unauthorized Request');
        }
        req.decoded = decoded;
        next();
    });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1rjt0hg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    const isAdmin = user?.role === 'admin';
    if (!isAdmin) {
        return res.status(403).send('Unauthorized Request');
    }
    next();
}

const verifyAgent = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    const isAgent = user?.role === 'agent';
    if (!isAgent) {
        return res.status(403).send('Unauthorized Request');
    }
    next();
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        global.userCollection = client.db("mughalDB").collection("Users");
        const propertyCollection = client.db("mughalDB").collection("Properties");

        // JWT API
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '24h',
            });
            res.send({ token });
        });

        // Users API

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.json(users);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send('Unauthorized Request');
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const admin = user ? user.role === 'admin' : false;
            res.send({ admin });
        });

        app.get('/users/agent/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send('Unauthorized Request');
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const agent = user ? user.role === 'agent' : false;
            res.send({ agent });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exists' });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateUser = {
                $set: { role: 'admin' }
            };
            const result = await userCollection.updateOne(filter, updateUser);
            res.send(result);
        });

        app.patch('/users/agent/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateUser = {
                $set: { role: 'agent' }
            };
            const result = await userCollection.updateOne(filter, updateUser);
            res.send(result);
        });

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        });

        // Properties API

        app.get('/properties', async (req, res) => {
            const properties = await propertyCollection.find().toArray();
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
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { ...property }
            };
            const result = await propertyCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.patch('/properties/:id/status', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const property = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateProperty = {
                $set: {
                    status: property.status,
                    propertyTitle: property.propertyTitle,
                    location: property.location,
                    priceRange: property.priceRange,
                    agentName: property.agentName,
                    agentEmail: property.agentEmail,
                }
            }
            const result = await propertyCollection.updateOne(filter, updateProperty);
            res.send(result);
        });

        app.delete('/properties/:id', verifyToken, verifyAgent, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await propertyCollection.deleteOne(query);
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});