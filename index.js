const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');
const dotenv = require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware
app.use(cors({ origin: ['http://localhost:5173'] }));
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
        global.userCollection = client.db("mughalDB").collection("Users");
        const propertyCollection = client.db("mughalDB").collection("Properties");

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

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
