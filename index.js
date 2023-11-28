const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.swu9d.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ikoswdf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
    try {
      // Connect the client to the server (optional starting in v4.7)
     //   await client.connect();

    const serveyCollection = client.db("surveyDb").collection("surveyAllData");
     const userCollection = client.db("surveyDb").collection("users");
     const paymentCollection = client.db("surveyDb").collection("payments");
     const ResponseCollection = client.db("surveyDb").collection("response");


          // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' });
      res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }


     // use verify admin after verifyToken
     const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      console.log("admin email",email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }



    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

  
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.patch('/users/serveyor/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'surveyor'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/users/surveyor/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let surveyor = false;
      if (user) {
        surveyor = user?.role === 'surveyor';
      }
      res.send({ surveyor });
    })


    // users related api
     app.get('/users',verifyToken,verifyAdmin , async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists: 
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/allSurvey', async (req, res) => {
      const result = await serveyCollection.find().toArray();
      res.send(result);
    });

    app.get('/allSurvey/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await serveyCollection.findOne(query);
      res.send(result);
    })
    app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.patch('/allSurvey/:id', async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {

          title: data.title,
          category: data.category,
          deadline: data.deadline,
          description: data.description ,
        }
      }

      const result = await serveyCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })



    app.get('/survey', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await serveyCollection.find(query).toArray();
      res.send(result);
    });

// like dislike condition

    app.patch('/allSurvey/dislike/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
    
        const { dislike } = req.body;
    
        const updatedDoc = {
          $set: {
            dislike: dislike 
          }
        };
    
        const result = await serveyCollection.updateOne(filter, updatedDoc);
    
        if (result.modifiedCount > 0) {
          res.send({ success: true, modifiedCount: result.modifiedCount });
        } else {
          res.send({ success: false, message: 'No survey found with the provided ID.' });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: 'Internal server error.' });
      }
    });
    
    
    app.patch('/allSurvey/like/:id', verifyToken, async (req, res) => {
      try {
          const id = req.params.id;
          const filter = { _id: new ObjectId(id) };
  
          const { like } = req.body;
  
          const updatedDoc = {
              $set: {
                 like : like
              }
          };
  
          const result = await serveyCollection.updateOne(filter, updatedDoc);
  
          if (result.modifiedCount > 0) {
              res.send({ success: true, modifiedCount: result.modifiedCount });
          } 
      } catch (error) {
          res.status(500).send({ success: false, message: 'Internal server error.' });
      }
  });


  // condition for vote update

    app.patch('/allSurvey/YesVote/:id', verifyToken, async (req, res) => {
      try {
          const id = req.params.id;
          const filter = { _id: new ObjectId(id) };
  
          const { yesVote } = req.body;
  
          const updatedDoc = {
              $set: {
                yesVote : yesVote
              }
          };
  
          const result = await serveyCollection.updateOne(filter, updatedDoc);
  
          if (result.modifiedCount > 0) {
              res.send({ success: true, modifiedCount: result.modifiedCount });
          } 
      } catch (error) {
          res.status(500).send({ success: false, message: 'Internal server error.' });
      }
  });

    app.patch('/allSurvey/NoVote/:id', verifyToken, async (req, res) => {
      try {
          const id = req.params.id;
          const filter = { _id: new ObjectId(id) };
  
          const { NoVote } = req.body;
  
          const updatedDoc = {
              $set: {
                NoVote : NoVote
              }
          };
  
          const result = await serveyCollection.updateOne(filter, updatedDoc);
  
          if (result.modifiedCount > 0) {
              res.send({ success: true, modifiedCount: result.modifiedCount });
          } 
      } catch (error) {
          res.status(500).send({ success: false, message: 'Internal server error.' });
      }
  });
  


// condition for publish umpublish

    app.put('/survey/unpublish/:id', verifyToken, async (req, res) => {
    try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const { typeMessage } = req.body; // Assuming you send the feedback message in the request body

        const updatedDoc = {
            $set: {
                status: 'unpublished',
                feedback: typeMessage
            }
        };

        const result = await serveyCollection.updateOne(filter, updatedDoc);

        if (result.modifiedCount > 0) {
            res.send({ success: true, modifiedCount: result.modifiedCount });
        } else {
            res.status(404).send({ success: false, message: 'Survey not found or already unpublished.' });
        }
    } catch (error) {
        console.error("Error updating survey status:", error);
        res.status(500).send({ success: false, message: 'Internal server error.' });
    }
});




    app.get('/survey/data', async (req, res) => {
      const result = await serveyCollection.find({status: "published"}).toArray();
      res.send(result);
    });

      
    app.get('/survey/unpublish', verifyToken, async (req, res) => {
      try {
          const result = await serveyCollection.find({ status: "unpublished" }).toArray();
          res.send(result);
      } catch (error) {
          console.error(error);
          res.status(500).send({ error: 'Internal Server Error' });
      }
  });



    app.put('/survey/published/:id', verifyToken, async (req, res) => {
    try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const updatedDoc = {
            $set: {
                status: 'published'
            }
        };

        const result = await serveyCollection.updateOne(filter, updatedDoc);

        if (result.modifiedCount > 0) {
            res.send({ success: true, modifiedCount: result.modifiedCount });
        } else {
            res.status(404).send({ success: false, message: 'Survey not found or already published.' });
        }
    } catch (error) {
        console.error("Error updating survey status:", error);
        res.status(500).send({ success: false, message: 'Internal server error.' });
    }
});

// survey response condition

app.patch('/allSurvey/UpdateVote/:id', async (req, res) => {
  const data = req.body;
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) }
  const updatedDoc = {
    $set: {
      comment: data.comment,
     responseUserName: data.responseUserName,
     responseUserEmail: data.responseUserEmail,
    }
  }

  const result = await serveyCollection.updateOne(filter, updatedDoc)
  res.send(result);
})



    app.post('/survey', verifyToken, async (req, res) => {
      const item = req.body;
      const result = await serveyCollection.insertOne(item);
      res.send(result);
    });

    // data sorting
    app.get('/sortedByVote', async (req, res) => {
      try {
        const query = {};
        const options = {
          sort: {
            yesVote: -1 // Use -1 for descending order
          }
        };
    
        const cursor = serveyCollection.find(query, options);
        const result = await cursor.toArray();
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });
    

  

 // payment intent
 app.post('/create-payment-intent', async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price * 100);
  console.log(amount, 'amount inside the intent')

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    payment_method_types: ['card']
  });

  res.send({
    clientSecret: paymentIntent.client_secret
  })
});

    
    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };
      const deleteResult = await serveyCollection.deleteMany(query);
      
      res.send({ paymentResult, deleteResult });
    })



          // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('boss is sitting')
})

app.listen(port, () => {
  console.log(`Bistro boss is sitting on port ${port}`);
})
