import { Request, Response, NextFunction } from "express";
import { PostService } from "../services/post.service";
import { PostType } from "../models/community_post.model";

export const createPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const post = await PostService.createPost(req.body, req.user!.id);
        res.status(201).send(post);
    } catch (err) {
        next(err);
    }
};

export const getPosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, breed, color, minPrice, maxPrice, page, limit } = req.query;

        const result = await PostService.getPosts({
            type: type as PostType,
            breed: breed as string,
            color: color as string,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
        }, Number(page) || 1, Number(limit) || 20);

        res.send(result);
    } catch (err) {
        next(err);
    }
};

export const getPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const post = await PostService.getPostById(req.params.id);
        if (!post) {
            const { NotFoundError } = require("../errors");
            throw new NotFoundError();
        }
        res.send(post);
    } catch (err) {
        next(err);
    }
};

export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const post = await PostService.updatePost(req.params.id, req.user!.id, req.body);
        res.send(post);
    } catch (err) {
        next(err);
    }
};

export const deletePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await PostService.deletePost(req.params.id, req.user!.id);
        res.status(204).send({});
    } catch (err) {
        next(err);
    }
};

export const resolvePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const post = await PostService.markAsResolved(req.params.id, req.user!.id);
        res.send(post);
    } catch (err) {
        next(err);
    }
};
