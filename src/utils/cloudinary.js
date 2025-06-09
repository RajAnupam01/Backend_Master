import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const resolvedPath = path.resolve(localFilePath);
    const response = await cloudinary.uploader.upload(resolvedPath, {
      resource_type: "auto",
    });

    fs.unlinkSync(resolvedPath);

    return response;

  } catch (error) {
    
    console.error("Cloudinary upload failed:", error);
    fs.unlinkSync(resolvedPath);
    return null;
  }
};

export default uploadOnCloudinary;
