import { Request, Response, NextFunction } from "express";
import { DogService } from "../services/dog.service";

// --- Dog Profile Management ---

export const createDog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dog = await DogService.createDog(req.body, req.user!.id);
        res.status(201).send(dog);
    } catch (err) {
        next(err);
    }
};

export const getMyDogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dogs = await DogService.getDogsByOwner(req.user!.id);
        res.send(dogs);
    } catch (err) {
        next(err);
    }
};

export const getDog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dog = await DogService.getDogById(req.params.id);
        if (!dog) {
            // Service usually handles logic, but if service returns null, controller handles 404
            // Alternatively, service throws error. In our service implementation, getDogById returns null.
            // Let's throw here or let service handle it.
            // For consistency with previous code, let's throw if null.
            const { NotFoundError } = require("../errors");
            throw new NotFoundError();
        }
        res.send(dog);
    } catch (err) {
        next(err);
    }
};

export const updateDog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dog = await DogService.updateDog(req.params.id, req.user!.id, req.body);
        res.send(dog);
    } catch (err) {
        next(err);
    }
};

export const deleteDog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await DogService.deleteDog(req.params.id, req.user!.id);
        res.status(204).send({});
    } catch (err) {
        next(err);
    }
};

// --- Health Records ---

export const addHealthRecord = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const record = await DogService.addHealthRecord(req.params.dogId, req.user!.id, req.body);
        res.status(201).send(record);
    } catch (err) {
        next(err);
    }
};

export const getHealthRecords = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const records = await DogService.getHealthRecords(req.params.dogId);
        res.send(records);
    } catch (err) {
        next(err);
    }
};

// --- Lost & Found Search ---

export const searchLostDogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { breed, color, lat, lng } = req.query;
        const dogs = await DogService.searchLostDogs({
            breed: breed as string,
            color: color as string,
            lat: lat ? Number(lat) : undefined,
            lng: lng ? Number(lng) : undefined,
        });
        res.send(dogs);
    } catch (err) {
        next(err);
    }
};
