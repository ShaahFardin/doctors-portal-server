const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.il5mbbt.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



// middleware to verify the token from the client side
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).send("unauthorized access")
    }
    const token = authHeader.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {

    try {
        await client.connect();
        console.log('Mongodb database connected');

    } catch (error) {
        console.log(error.name, error.message, error.stack);
    }

}
run();

const appointmentOptionCollection = client.db('DoctorsPortal').collection('AppointmentCollections');
const bookingsCollection = client.db('DoctorsPortal').collection('bookings')
const usersCollection = client.db('DoctorsPortal').collection('users')
const doctorsCollection = client.db('DoctorsPortal').collection('doctors')


const verifyAdmin = async (req, res, next) => {

    console.log('inside verify admin', req.decoded.email);
    const decodedEmail = req.decoded.email;
    const query = { email: decodedEmail };
    const user = await usersCollection.findOne(query)

    if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
    }
    next()
}

app.get('/appointmentOptions', async (req, res) => {
    try {
        const date = req.query.date;
        const query = {};
        const options = await appointmentOptionCollection.find(query).toArray();

        const bookingQuery = { appointmentDate: date }
        const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

        options.forEach(option => {
            const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
            const bookedSlots = optionBooked.map(book => book.slot);
            const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
            option.slots = remainingSlots;
        })
        res.send(options);

    } catch (error) {
        console.log(error.name.error.message, error.stack);
        res.send({
            success: false,
            error: error.message
        })
    }
})



app.post('/bookings', async (req, res) => {

    const booking = req.body;
    const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment
    }

    const alreadyBooked = await bookingsCollection.find(query).toArray();

    if (alreadyBooked.length) {
        const message = `You already have a booking on ${booking.appointmentDate}`
        return res.send({ acknowledged: false, message })
    }


    const result = await bookingsCollection.insertOne(booking);
    res.send(result);
})


// create token
app.get('/jwt', async (req, res) => {
    const email = req.query.email;
    const query = { email: email };
    const user = await usersCollection.findOne(query);

    if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN);
        return res.send({ accessToken: token })
    }
    res.status(403).send({ accessToken: "" })

})



// Get my appointment
app.get('/bookings', verifyJWT, async (req, res) => {
    const email = req.query.email;
    const query = { email: email };
    const decodedEmail = req.decoded.email;

    if (email !== decodedEmail) {
        return res.status(403).send({ message: 'forbidden access' })
    }

    const bookings = await bookingsCollection.find(query).toArray();
    res.send(bookings)
})

// Create new user data from sign up
app.post('/users', async (req, res) => {
    const user = req.body
    const result = await usersCollection.insertOne(user)
    res.send(result)
})

// get all users
app.get('/users', async (req, res) => {
    const users = await usersCollection.find({}).toArray();
    res.send(users)
})

// check the specific user is admin or not
app.get('/users/admin/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email }
    const user = await usersCollection.findOne(query);
    res.send({ isAdmin: user?.role === 'admin' })
})

// check admin to make addmin
app.put('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {

    const id = req.params.id;
    const filter = { _id: ObjectId(id) }
    const options = { upsert: true };
    const updatedDoc = {
        $set: {
            role: 'admin'
        }
    }
    const result = await usersCollection.updateOne(filter, updatedDoc, options);
    res.send(result)
})


// Get doctors specialty by projection
app.get('/appoinment-specialty', async (req, res) => {
    const query = {};
    const result = await appointmentOptionCollection.find(query).project({ name: 1 }).toArray();
    res.send(result)
})


// Save/add doctors to the database
app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
    const doctor = req.body;
    const result = await doctorsCollection.insertOne(doctor);
    res.send(result)
})


// get all doctors
app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
    const result = await doctorsCollection.find({}).toArray();
    res.send(result)
})

// delete a doctor
app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const filter = { _id: ObjectId(id) };
    const result = await doctorsCollection.deleteOne(filter);
    res.send(result)
})


app.get('/', (req, res) => {
    res.send("Doctors portal server is running")
});
app.listen(port, () => console.log(`Doctors portal server is running on ${port}`))

app.get('/haha', ( req, res) => {
    res.json({ result: true })
})