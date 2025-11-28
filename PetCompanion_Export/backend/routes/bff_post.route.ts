import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateData } from "../middlewares/validation.middleware"; // Assuming this exists
import { createPostSchema, updatePostSchema } from "../validation";
import {
    createPost,
    getPosts,
    getPost,
    updatePost,
    deletePost,
    resolvePost
} from "../controllers/post.controller";

const router = express.Router();

// Public Routes
router.get("/", getPosts);
router.get("/:id", getPost);

// Protected Routes
router.post("/", authMiddleware, validateData(createPostSchema), createPost);
router.put("/:id", authMiddleware, validateData(updatePostSchema), updatePost);
router.delete("/:id", authMiddleware, deletePost);
router.patch("/:id/resolve", authMiddleware, resolvePost);

export default router;
