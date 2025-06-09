import asyncHandler from "../utils/asyncHandler.js" // Wraps async functions and handles errors automatically
import ApiError from "../utils/ApiError.js" // Custom error class to throw HTTP-related errors
import User from "../models/user.model.js" // Mongoose User model
import uploadOnCloudinary from "../utils/cloudinary.js" // Utility function to upload files to Cloudinary
import ApiResponse from "../utils/ApiResponse.js" // Custom response format handler
import jwt from "jsonwebtoken" // Library to work with JWT tokens

// Utility function to generate access and refresh tokens for a user
const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId) // Fetch user by ID from DB
        const accessToken = user.generateAccessToken() // Generate short-lived access token
        const refreshToken = user.generateRefreshToken() // Generate long-lived refresh token

        user.refreshToken = refreshToken // Save refresh token in DB
        await user.save({ validateBeforeSave: true }) // Save the updated user, validating fields

        return { accessToken, refreshToken } // Return both tokens
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token") // Catch-all error
    }
}

// Controller to register a new user
export const registerUser = asyncHandler(async (req, res) => {

    const { username, email, fullname, password } = req.body // Extract required fields from request body

    // Check for any missing or empty fields
    if ([fullname, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required.")
    }

    // Check if user already exists with given username or email
    const existedUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists.")
    }

    // Get uploaded file paths for avatar and cover image
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required.") // Avatar is mandatory
    }

    // Upload images to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required.") // Double-check avatar upload success
    }

    // Create user in database with uploaded image URLs and input data
    const user = await User.create({
        fullname,
        avatar: avatar.url, // Cloudinary avatar URL
        coverImage: coverImage?.url || "", // Cover image URL or empty string
        email,
        password,
        username: username.toLowerCase() // Standardize username to lowercase
    })

    // Retrieve newly created user excluding password and refresh token
    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering a user.")
    }

    // Send success response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registerd successfully.")
    )
})

// Controller to log in a user
export const loginUser = asyncHandler(async (req, res) => {

    const { email, username, password } = req.body // Get credentials from request

    // Must provide either email or username along with password
    if (!(username || email) || !password) {
        throw new ApiError(400, "Username or email and password are required.")
    }

    // Look for user using username or email
    const user = await User.findOne({ $or: [{ username }, { email }] })
    if (!user) {
        throw new ApiError(404, "User does not exist.")
    }

    // Validate password using user model method
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    // Generate new access and refresh tokens
    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id)

    // Get safe user data (excluding password and refreshToken)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true, // Cookies not accessible via JavaScript (secure)
        secure: true    // Only sent over HTTPS
    }

    // Send tokens as cookies and also include them in response body
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged in Successfully."
            )
        )
})

// Controller to log out a user
export const logoutUser = asyncHandler(async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(401, "Unauthorized request") // User must be authenticated
    }

    // Remove the refresh token from user document in DB
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: "" } // MongoDB operator to delete a field
        },
        {
            new: true // Return updated user
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    // Clear authentication cookies and send success response
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                {},
                "User logged out successfully."
            )
        )
})

// Controller to refresh access token using a valid refresh token
export const refreshAccessToken = asyncHandler(async (req, res) => {
    // Try to get refresh token from cookie or request body
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request. Refresh Token missing.")
    }

    try {
        // Verify and decode refresh token using JWT
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id) // Fetch user using decoded token payload
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        // Check if the refresh token in cookie/body matches the one in DB
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used.")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        // Generate fresh access and refresh tokens
        const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id)

        // Set cookies and return new tokens in response
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken },
                    "Access Token refreshed"
                )
            )

    } catch (error) {
        throw new ApiError(401, error.message) // Catch JWT errors like expired/invalid token
    }
})
