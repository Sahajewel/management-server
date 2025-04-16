const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require('dotenv').config();
const cookieParser = require("cookie-parser")
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;



// Middleware to parse JSON request bodies
app.use(express.json());
app.use(cookieParser())
app.use(cors({
    origin:"http://localhost:5173",
    credentials:true
})); // If needed, to allow cross-origin requests

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://environmentalManagement:8B3TYa9Z0Whk3Yda@cluster0.r7awt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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
    // Connect the client to the server
    await client.connect();
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const userCollection = client.db("environmentalDB").collection("users");
    const productsCollection = client.db("environmentalDB").collection("products");
    const mobileCollection = client.db("environmentalDB").collection("mobileUser");

    // json web token vreate
    app.post("/jwt", async(req, res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.HTTP_TOKEN, {expiresIn: "1d"})
      res.cookie("token",token,{
        httpOnly:true,
        secure: false,
        
      })
      .send({success:true})
    })

    // remove cookie
    app.post("/logout", async(req, res)=>{
      res
          .cookie("token", "", {
            httpOnly:true,
            secure:false,
            expires: new Date(0)
          })
          res.status(200).json({message: "Logged out successfully"})
    })

     //  middle ware
     
    const verifyToken = (req, res, next)=>{
      const token = req.cookies?.token;
      if(!token){
        return res.status(401).json({message: "unauthorized access: token not found"})
      }
      jwt.verify(token,process.env.HTTP_TOKEN,(err, decoded)=>{
        if(err){
          return res.status(403).json({error: "Forbidden token"})
        }
        req.user= decoded
        
        next()
      })
    
    }

    //  verify admin
    const veryAdmin = async(req, res, next)=>{
      // nicher user ta verify token theke paisi  req.user= decoded
      const email = req.params.email;
      console.log("very admin", email)
      const user = await userCollection.findOne({email});
      if(!user){
        return res.status(404).json({message: "user not found"})
      }
      if(user?.role !== "admin"){
        return res.status(403).json({message: "Access denied: Admin only"})
      }
      next()
     }

     const verifyVolunteer= async(req,res,next)=>{
      const email = req.params.email;
      const user = await userCollection.findOne({email});
      if(!user){
        return res.status(404).json({message: "User not found"})
      }
      if(user?.role !=="volunteer"){
        return res.status(403).json({message:" Access denied: Volunteer only "})
      }
      next()
     }

     const verifyDonor = async(req, res, next)=>{
      const email = req.params.email;
      const user = await userCollection.findOne({email});
      if(!user){
        return res.status(404).json({message: "User not found"});
      }
      if(user?.role !=="donor"){
        return res.status(403).json({message: "Access denied: Donor only"})
      }
      next()
     }

     app.get("/admin/dashboard/:email",verifyToken,veryAdmin, (req, res)=>{
      res.json({isAdmin:true})
     })
     app.get("/volunnteer/dashboard/:email",verifyToken, verifyVolunteer, (req,res)=>{
      res.json({isVolunteer:true})
     })
     app.get("/donor/dashboard/:email",verifyToken, verifyDonor, (req,res)=>{
      res.json({isDonor:true})
     })
   

    // single api created
    app.get("/users/roles/:email",verifyToken, async(req, res)=>{
      const email = req.params.email;
      const user = await userCollection.findOne({email});
      if(!user){
        return res.status(404).json({message: "user not found"})
      }
      const roles = {
        admin: user.role === "admin",
        volunteer: user.role === "volunteer",
        donor: user.role === "donor"
      }
      console.log(roles)
      res.send(roles)
    })

   
    
    // products api
    app.get("/products",verifyToken, async(req,res)=>{
      console.log("inside the cookie parser", req.cookies?.token)
      try{
        const result = await productsCollection.find().toArray()
      res.json(result)
      }
      catch(err){
        console.log("error occured", err)
        res.status(500).json({error: "Interval server error"})
      }
    })
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users", async(req, res)=>{
      const result = await userCollection.find().toArray()
      res.send(result)
    })
    app.get("/users-profile",verifyToken, async(req, res)=>{
      const email = req.user.email;
      const result = await userCollection.findOne({email})
      console.log("uers",result)
      res.send(result)
    })
      // mobile api
app.get("/mobile", async(req, res)=>{
  const result = await mobileCollection.find().toArray()
  // console.log(result)
  res.send(result)
})
app.get("/mobile/:id", async(req,res)=>{
  const id = req.params.id;
  const cursor = {_id : new ObjectId(id)}
  const result = await mobileCollection.findOne(cursor);
  res.send(result)
})

//  strope api 
app.post("/create-payment-intent", async(req, res)=>{
  const {price} = req.body;
  const amount = parseInt(price*100);
  console.log("amount inside the price", amount)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ["card"]

  })
  res.send({clientSecret: paymentIntent.client_secret})
})


  } catch (error) {
    console.error("Error connecting to MongoDB", error);
  }
}

app.get("/", (req, res) => {
  res.send("Environmental Management");
});

app.listen(port, () => {
  console.log(`App running on port: ${port}`);
});

run().catch(console.dir);
