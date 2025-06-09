import mongoose, { Schema } from "mongoose"

const subscriptionSchema = new mongoose.Schema({

    subscriber:{
        type: Schema.Types.ObjectId,  // one who is subscribing.
        ref : "User"
    },
    channel:{
        type: Schema.Types.ObjectId,   // one to whom "subscriber" subscribing.
        ref :"User"
    },
},{timestamps:true})

const Subscription = mongoose.model("Subscription",subscriptionSchema)

export default Subscription;