import dotenv from "dotenv"
import connectDB from "./config/db.js"
import app from "./app.js"

dotenv.config()


const startServer = async () => {
    try {
        await connectDB();
        const PORT = process.env.PORT || 8000;
        app.listen(PORT, () => {
            console.log(`Server is running at port: ${PORT}`);
        });
    } catch (error) {
        console.error("MongoDB connection failed!!!", error);
        process.exit(1);
    }
};

startServer();