// Importing custom error class for throwing API errors with status codes and messages
import ApiError from "../utils/ApiError.js";

// Importing asyncHandler to wrap the async function and automatically catch errors and pass them to the error handler middleware
import asyncHandler from "../utils/asyncHandler.js";

// Importing jwt to verify and decode the JSON Web Token
import jwt from "jsonwebtoken";

// Importing User model to fetch user data from the database using the decoded user ID from the token
import User from "../models/user.model.js";


// Exporting verifyJWT as a middleware function
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    // STEP 1: Get the token from either cookie or Authorization header
    // Check if the token is available in cookies (for cookie-based auth)
    // Or in the "Authorization" header (for token-in-header auth, typically "Bearer <token>")
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    // STEP 2: If no token is provided, throw an unauthorized error
    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    // STEP 3: Verify the token using the JWT secret
    // jwt.verify checks that the token:
    // - Is signed with the correct secret
    // - Has not expired
    // - Is not tampered with
    // If valid, returns the decoded payload (e.g., { _id, iat, exp })
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // STEP 4: Using the decoded _id (stored in token payload), find the user in the database
    // We exclude sensitive fields like password and refreshToken using .select()
    const user = await User.findById(decoded?._id).select("-password -refreshToken");

    // STEP 5: If no user is found in the database, the token is considered invalid
    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }

    // STEP 6: Attach the authenticated user object to the request object
    // This makes it available to downstream controllers (like accessing req.user)
    req.user = user;

    // STEP 7: Call the next middleware/controller in the stack
    next();
  } catch (error) {
    // STEP 8: If anything goes wrong (invalid token, user not found, token expired), throw a 401 Unauthorized error
    throw new ApiError(401, error.message || "Invalid access Token");
  }
});
